import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const ok = (msg: string) => console.log(`${GREEN}✓${RESET} ${msg}`);
const warn = (msg: string) => console.log(`${YELLOW}⚠${RESET} ${msg}`);
const fail = (msg: string) => console.log(`${RED}✗${RESET} ${msg}`);
const heading = (n: number, title: string) =>
  console.log(`\n${BOLD}${CYAN}── Step ${n}: ${title} ──${RESET}\n`);
const dim = (msg: string) => `${DIM}${msg}${RESET}`;

// ── Paths ─────────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

// ── Target files for replacement (hardcoded, verified) ────────────────────────
const TARGET_FILES = [
  // Package configs
  'package.json',
  'apps/api/package.json',
  'apps/web/package.json',
  'packages/types/package.json',
  'packages/config/package.json',
  // Build/deploy configs
  'apps/api/eslint.config.js',
  'apps/web/eslint.config.js',
  'apps/web/vercel.json',
  'apps/api/Dockerfile',
  '.github/workflows/deploy-staging.yml',
  // Test config
  'playwright.config.ts',
  // API source
  'apps/api/src/plugins/health.ts',
  'apps/api/src/plugins/users.ts',
  'apps/api/src/plugins/uploads.ts',
  'apps/api/src/plugins/auth-callback.ts',
  'apps/api/src/jobs/send-welcome-email.job.ts',
  'apps/api/src/emails/welcome.email.ts',
  'apps/api/src/services/email.service.ts',
  // Web source
  'apps/web/index.html',
  'apps/web/capacitor.config.ts',
  'apps/web/src/components/layout/Sidebar.tsx',
  // Supabase
  'supabase/config.toml',
  // Docs
  'README.md',
  '.claude/CLAUDE.md',
  'apps/api/CLAUDE.md',
  'apps/web/CLAUDE.md',
  'packages/types/CLAUDE.md',
  // Claude Code config + skills
  '.claude/settings.json',
  '.claude/skills/new-feature.md',
  '.claude/skills/new-route.md',
  '.claude/skills/sync-types.md',
];

// ── Types ─────────────────────────────────────────────────────────────────────
interface ProjectNames {
  scope: string;
  displayName: string;
  slug: string;
  appId: string;
  supabaseId: string;
  emailDomain: string;
}

interface SupabaseCredentials {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  jwtSecret: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isAlreadyPersonalized(): boolean {
  const pkg = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8');
  return !pkg.includes('"@myapp/');
}

function capitalize(s: string): string {
  return s
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

function toLowerSlug(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function shell(cmd: string): string | null {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

async function ask(
  rl: readline.Interface,
  prompt: string,
  defaultValue?: string,
  validate?: (v: string) => string | null,
): Promise<string> {
  const suffix = defaultValue ? ` ${dim(`(${defaultValue})`)}` : '';
  while (true) {
    const answer = (await rl.question(`  ${prompt}${suffix}: `)).trim();
    const value = answer || defaultValue || '';
    if (!value) {
      console.log(`    ${RED}Required.${RESET}`);
      continue;
    }
    if (validate) {
      const err = validate(value);
      if (err) {
        console.log(`    ${RED}${err}${RESET}`);
        continue;
      }
    }
    return value;
  }
}

async function confirm(rl: readline.Interface, prompt: string): Promise<boolean> {
  const answer = (await rl.question(`  ${prompt} ${dim('(Y/n)')}: `)).trim().toLowerCase();
  return answer !== 'n' && answer !== 'no';
}

// ── Step 1: Collect project names ─────────────────────────────────────────────

async function collectProjectNames(rl: readline.Interface): Promise<ProjectNames> {
  heading(1, 'Project Naming');
  console.log('  Configure your project identity. Smart defaults are derived from your scope.\n');

  const scope = await ask(rl, 'Package scope (without @)', undefined, (v) =>
    /^[a-z][a-z0-9-]*$/.test(v) ? null : 'Lowercase letters, numbers, hyphens only. Must start with a letter.',
  );

  const defaultDisplay = capitalize(scope);
  const displayName = await ask(rl, 'Display name', defaultDisplay, (v) =>
    v.length > 0 ? null : 'Cannot be empty.',
  );

  const defaultSlug = toLowerSlug(displayName);
  const slug = await ask(rl, 'Lowercase slug', defaultSlug, (v) =>
    /^[a-z][a-z0-9]*$/.test(v) ? null : 'Lowercase letters and numbers only. Must start with a letter.',
  );

  const defaultAppId = `com.${slug}.app`;
  const appId = await ask(rl, 'Capacitor app ID', defaultAppId, (v) =>
    /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/.test(v) ? null : 'Must be reverse domain notation (e.g. com.acme.app).',
  );

  const defaultSupabaseId = `${slug}_app`;
  const supabaseId = await ask(rl, 'Supabase project ID', defaultSupabaseId, (v) =>
    /^[a-z][a-z0-9_]*$/.test(v) ? null : 'Lowercase letters, numbers, underscores only.',
  );

  const defaultDomain = `${slug}.com`;
  const emailDomain = await ask(rl, 'Email domain', defaultDomain, (v) =>
    v.includes('.') ? null : 'Must contain a dot (e.g. acme.com).',
  );

  console.log(`\n  ${BOLD}Configuration:${RESET}`);
  console.log(`  ┌──────────────────────┬──────────────────────────────┐`);
  console.log(`  │ Package scope        │ @${scope}${' '.repeat(Math.max(0, 27 - scope.length - 1))}│`);
  console.log(`  │ Display name         │ ${displayName}${' '.repeat(Math.max(0, 28 - displayName.length))}│`);
  console.log(`  │ Slug                 │ ${slug}${' '.repeat(Math.max(0, 28 - slug.length))}│`);
  console.log(`  │ Capacitor app ID     │ ${appId}${' '.repeat(Math.max(0, 28 - appId.length))}│`);
  console.log(`  │ Supabase project ID  │ ${supabaseId}${' '.repeat(Math.max(0, 28 - supabaseId.length))}│`);
  console.log(`  │ Email domain         │ ${emailDomain}${' '.repeat(Math.max(0, 28 - emailDomain.length))}│`);
  console.log(`  └──────────────────────┴──────────────────────────────┘`);

  const proceed = await confirm(rl, 'Proceed with these values?');
  if (!proceed) {
    console.log('\n  Aborted. Run again to restart.');
    process.exit(0);
  }

  return { scope, displayName, slug, appId, supabaseId, emailDomain };
}

// ── Step 2: Perform replacements + install ────────────────────────────────────

function performReplacements(names: ProjectNames): void {
  heading(2, 'Replacing Placeholders');

  // Ordered most-specific first to avoid partial matches
  const replacements: [string, string][] = [
    ['noreply@myapp.com', `noreply@${names.emailDomain}`],
    ['com.myapp.starter', names.appId],
    ['myapp_starter', names.supabaseId],
    ['MyApp', names.displayName],
    ['@myapp', `@${names.scope}`],
  ];

  // Bare "myapp" replacements only in README.md directory references
  const readmeBarReplacements: [RegExp, string][] = [
    [/\bmyapp\//g, `${names.slug}/`],
    [/cd myapp\b/g, `cd ${names.slug}`],
  ];

  let filesChanged = 0;
  let totalReplacements = 0;

  for (const relPath of TARGET_FILES) {
    const absPath = path.join(ROOT, relPath);
    if (!fs.existsSync(absPath)) {
      warn(`Skipped (not found): ${relPath}`);
      continue;
    }

    let content = fs.readFileSync(absPath, 'utf-8');
    const original = content;

    for (const [search, replace] of replacements) {
      const count = content.split(search).length - 1;
      if (count > 0) {
        content = content.replaceAll(search, replace);
        totalReplacements += count;
      }
    }

    // Bare myapp in README only
    if (relPath === 'README.md') {
      for (const [pattern, replace] of readmeBarReplacements) {
        const matches = content.match(pattern);
        if (matches) {
          content = content.replace(pattern, replace);
          totalReplacements += matches.length;
        }
      }
    }

    if (content !== original) {
      fs.writeFileSync(absPath, content, 'utf-8');
      filesChanged++;
      ok(relPath);
    }
  }

  console.log(`\n  ${BOLD}${filesChanged}${RESET} files updated, ${BOLD}${totalReplacements}${RESET} replacements made.`);
}

function installDeps(): void {
  console.log(`\n  Running ${BOLD}pnpm install${RESET} to update lockfile...\n`);
  try {
    execSync('pnpm install', { cwd: ROOT, stdio: 'inherit' });
    ok('Dependencies installed.');
  } catch {
    warn('pnpm install had issues. You may need to run it manually.');
  }
}

// ── Step 3: Prerequisites check ──────────────────────────────────────────────

function checkPrerequisites(): void {
  heading(3, 'Prerequisites Check');

  // Node.js
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1), 10);
  if (nodeMajor >= 22) {
    ok(`Node.js ${nodeVersion}`);
  } else {
    fail(`Node.js ${nodeVersion} — requires ≥22`);
  }

  // pnpm
  const pnpmVersion = shell('pnpm --version');
  if (pnpmVersion) {
    const pnpmMajor = parseInt(pnpmVersion.split('.')[0]!, 10);
    if (pnpmMajor >= 9) {
      ok(`pnpm ${pnpmVersion}`);
    } else {
      fail(`pnpm ${pnpmVersion} — requires ≥9`);
    }
  } else {
    fail('pnpm not found — install: https://pnpm.io/installation');
  }

  // Docker
  const dockerVersion = shell('docker --version');
  if (dockerVersion) {
    ok(`Docker ${dockerVersion.replace('Docker version ', '').replace(',', '')}`);
  } else {
    warn('Docker not found — needed for Redis');
  }

  // Supabase CLI
  const supabaseVersion = shell('supabase --version');
  if (supabaseVersion) {
    ok(`Supabase CLI ${supabaseVersion}`);
  } else {
    warn('Supabase CLI not found — install: https://supabase.com/docs/guides/local-development/cli/getting-started#installing-the-supabase-cli');
  }
}

// ── Step 4: Start Supabase ────────────────────────────────────────────────────

async function startSupabase(rl: readline.Interface): Promise<SupabaseCredentials | null> {
  heading(4, 'Supabase');

  // Check if already running
  const statusJson = shell('supabase status -o json');
  if (statusJson) {
    try {
      const status = JSON.parse(statusJson);
      if (status.API_URL || status.API?.URL) {
        ok('Supabase is already running.');
        return parseSupabaseStatus(status);
      }
    } catch {
      // Not valid JSON, Supabase not running
    }
  }

  // Check if Supabase CLI exists
  if (!shell('supabase --version')) {
    warn('Supabase CLI not installed. Skipping.');
    return null;
  }

  const shouldStart = await confirm(rl, 'Start Supabase locally? (requires Docker)');
  if (!shouldStart) {
    warn('Skipped. Run `supabase start` manually later.');
    return null;
  }

  console.log(`\n  Starting Supabase... ${dim('(this may take a minute on first run)')}\n`);
  try {
    execSync('supabase start', { cwd: ROOT, stdio: 'inherit' });
  } catch {
    fail('Failed to start Supabase. Ensure Docker is running and try `supabase start` manually.');
    return null;
  }

  // Parse credentials from status
  const postStatus = shell('supabase status -o json');
  if (!postStatus) {
    warn('Could not read Supabase status after start.');
    return null;
  }

  try {
    const parsed = JSON.parse(postStatus);
    const creds = parseSupabaseStatus(parsed);
    if (creds) {
      ok('Supabase started successfully.');
      console.log(`  ${dim('API URL:')}       ${creds.apiUrl}`);
      console.log(`  ${dim('Anon key:')}      ${creds.anonKey.slice(0, 20)}...`);
      console.log(`  ${dim('Service role:')}   ${creds.serviceRoleKey.slice(0, 20)}...`);
    }
    return creds;
  } catch {
    warn('Could not parse Supabase credentials.');
    return null;
  }
}

function parseSupabaseStatus(status: Record<string, unknown>): SupabaseCredentials | null {
  // supabase status -o json can have flat keys or nested objects depending on version
  const apiUrl = (status.API_URL ?? status['API URL'] ?? '') as string;
  const anonKey = (status.ANON_KEY ?? status['anon key'] ?? '') as string;
  const serviceRoleKey = (status.SERVICE_ROLE_KEY ?? status['service_role key'] ?? '') as string;
  const jwtSecret = (status.JWT_SECRET ?? status['JWT secret'] ?? '') as string;

  if (!apiUrl || !anonKey || !serviceRoleKey) return null;
  return { apiUrl, anonKey, serviceRoleKey, jwtSecret };
}

// ── Step 5: Start Redis ───────────────────────────────────────────────────────

async function startRedis(rl: readline.Interface): Promise<void> {
  heading(5, 'Redis');

  // Check if already running
  const ping = shell('docker exec $(docker compose ps -q redis 2>/dev/null) redis-cli ping 2>/dev/null');
  if (ping === 'PONG') {
    ok('Redis is already running.');
    return;
  }

  if (!shell('docker --version')) {
    warn('Docker not installed. Skipping Redis.');
    return;
  }

  const shouldStart = await confirm(rl, 'Start Redis via Docker Compose?');
  if (!shouldStart) {
    warn('Skipped. Run `docker compose up -d` manually later.');
    return;
  }

  console.log();
  try {
    execSync('docker compose up -d', { cwd: ROOT, stdio: 'inherit' });
  } catch {
    fail('Failed to start Redis. Try `docker compose up -d` manually.');
    return;
  }

  // Wait for health check
  let retries = 10;
  while (retries > 0) {
    const check = shell('docker exec $(docker compose ps -q redis 2>/dev/null) redis-cli ping 2>/dev/null');
    if (check === 'PONG') {
      ok('Redis is healthy.');
      return;
    }
    retries--;
    execSync('sleep 1');
  }
  warn('Redis container started but health check did not pass. Check with `docker compose ps`.');
}

// ── Step 6: Configure environment ─────────────────────────────────────────────

async function configureEnvironment(
  rl: readline.Interface,
  creds: SupabaseCredentials | null,
): Promise<void> {
  heading(6, 'Environment Files');

  await writeEnvFile(rl, 'apps/api/.env', 'apps/api/.env.example', (content) => {
    if (!creds) return content;
    return content
      .replace('<from supabase start>', creds.serviceRoleKey)
      .replace(
        'SUPABASE_JWT_SECRET=<from supabase start>',
        `SUPABASE_JWT_SECRET=${creds.jwtSecret}`,
      )
      .replace('SUPABASE_URL=http://127.0.0.1:54321', `SUPABASE_URL=${creds.apiUrl}`);
  });

  await writeEnvFile(rl, 'apps/web/.env', 'apps/web/.env.example', (content) => {
    if (!creds) return content;
    return content
      .replace('<from supabase start>', creds.anonKey)
      .replace('VITE_SUPABASE_URL=http://127.0.0.1:54321', `VITE_SUPABASE_URL=${creds.apiUrl}`);
  });
}

async function writeEnvFile(
  rl: readline.Interface,
  envRelPath: string,
  exampleRelPath: string,
  transform: (content: string) => string,
): Promise<void> {
  const envPath = path.join(ROOT, envRelPath);
  const examplePath = path.join(ROOT, exampleRelPath);

  if (!fs.existsSync(examplePath)) {
    warn(`${exampleRelPath} not found. Skipping.`);
    return;
  }

  if (fs.existsSync(envPath)) {
    const overwrite = await confirm(rl, `${envRelPath} already exists. Overwrite?`);
    if (!overwrite) {
      warn(`Skipped ${envRelPath}.`);
      return;
    }
  }

  let content = fs.readFileSync(examplePath, 'utf-8');
  content = transform(content);
  fs.writeFileSync(envPath, content, 'utf-8');
  ok(envRelPath);
}

// ── Step 7: Verify & next steps ───────────────────────────────────────────────

function verifySetup(): void {
  heading(7, 'Summary & Next Steps');

  // Check if services are reachable
  const apiHealth = shell('curl -sf http://localhost:3000/health 2>/dev/null');
  if (apiHealth) {
    ok('API server is running at http://localhost:3000');
  } else {
    console.log(`  ${DIM}API:${RESET}              http://localhost:3000 ${dim('(not running)')}`);
  }

  const webCheck = shell('curl -sf http://localhost:5173 2>/dev/null');
  if (webCheck) {
    ok('Web app is running at http://localhost:5173');
  } else {
    console.log(`  ${DIM}Web:${RESET}              http://localhost:5173 ${dim('(not running)')}`);
  }

  console.log(`  ${DIM}Supabase Studio:${RESET}  http://localhost:54323`);
  console.log(`  ${DIM}Inbucket (email):${RESET} http://localhost:54324`);

  console.log(`\n  ${BOLD}Next steps:${RESET}`);
  console.log(`  1. ${CYAN}pnpm dev${RESET}           Start all services`);
  console.log(`  2. Open ${CYAN}http://localhost:5173${RESET} in your browser`);
  console.log(`  3. Open ${CYAN}http://localhost:54323${RESET} for Supabase Studio`);
  console.log(`  4. See ${CYAN}README.md${RESET} for the full development guide`);
  console.log();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${BOLD}${CYAN}🚀 Project Initialization${RESET}\n`);

  const rl = readline.createInterface({ input, output });

  try {
    // Steps 1-2: Project naming & replacements (skip if already personalized)
    let creds: SupabaseCredentials | null = null;

    if (isAlreadyPersonalized()) {
      ok('Project already personalized (no @myapp references found). Skipping naming.\n');
    } else {
      const names = await collectProjectNames(rl);
      performReplacements(names);
      installDeps();
    }

    // Step 3: Prerequisites
    checkPrerequisites();

    // Step 4: Supabase
    creds = await startSupabase(rl);

    // Step 5: Redis
    await startRedis(rl);

    // Step 6: Environment files
    await configureEnvironment(rl, creds);

    // Step 7: Summary
    verifySetup();
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(`\n${RED}Fatal error:${RESET}`, err);
  process.exit(1);
});
