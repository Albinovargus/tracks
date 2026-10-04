import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';
import type { FastifyReply, FastifyRequest } from 'fastify';

let jwtSecret: Uint8Array | undefined;
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function getJwtSecret(): Uint8Array {
  if (!jwtSecret) {
    const secret = process.env['SUPABASE_JWT_SECRET'];
    if (!secret) {
      throw new Error('Missing SUPABASE_JWT_SECRET environment variable');
    }
    jwtSecret = new TextEncoder().encode(secret);
  }
  return jwtSecret;
}

// Supabase signing keys (ES256/RS256) are published at the project's JWKS endpoint
function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  if (!jwks) {
    const supabaseUrl = process.env['SUPABASE_URL'];
    if (!supabaseUrl) {
      throw new Error('Missing SUPABASE_URL environment variable');
    }
    jwks = createRemoteJWKSet(
      new URL('/auth/v1/.well-known/jwks.json', supabaseUrl)
    );
  }
  return jwks;
}

// Legacy projects sign with the shared HS256 secret; newer ones use asymmetric keys
async function verifyToken(token: string): Promise<JWTPayload> {
  const { alg } = decodeProtectedHeader(token);
  if (alg === 'HS256') {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ['HS256'],
    });
    return payload;
  }
  const { payload } = await jwtVerify(token, getJwks(), {
    algorithms: ['ES256', 'RS256'],
  });
  return payload;
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization header',
      },
    });
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyToken(token);

    request.user = {
      id: payload.sub ?? '',
      email: (payload.email as string | undefined) ?? '',
      role: (payload.role as string | undefined) ?? 'authenticated',
    };
  } catch {
    return reply.code(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    });
  }
}
