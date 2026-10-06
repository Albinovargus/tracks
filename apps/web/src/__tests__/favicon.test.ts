// @vitest-environment node
import { describe, it, expect } from 'vitest';
import indexHtml from '../../index.html?raw';

// Every file in public/, as text, keyed by its path relative to this test.
const publicFiles = import.meta.glob<string>('../../public/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('favicon', () => {
  it('index.html links an SVG icon that public/ serves, so the browser never requests /favicon.ico', () => {
    const href = /<link rel="icon" type="image\/svg\+xml" href="\/([^"]+)" \/>/.exec(indexHtml)?.[1];
    expect(href).toBe('favicon.svg');

    const svg = publicFiles['../../public/favicon.svg'];
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 32 32">/);
  });
});
