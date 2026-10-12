#!/usr/bin/env node
/*
 * Privacy guard: fail the build if the app's own source introduces a network
 * API. The runtime guarantee is the strict CSP (`connect-src 'none'`); this is
 * the belt-and-suspenders that catches a regression in our code at CI time,
 * before it ever ships.
 *
 * Scope: webview-ui/src only (our code). Third-party code is covered at runtime
 * by the CSP. The service worker (public-web/sw.js) legitimately uses fetch to
 * cache the same-origin app shell and is intentionally not scanned.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

const FORBIDDEN = [
  { re: /\bfetch\s*\(/, name: 'fetch()' },
  { re: /\bXMLHttpRequest\b/, name: 'XMLHttpRequest' },
  { re: /\.sendBeacon\s*\(/, name: 'navigator.sendBeacon()' },
  { re: /\bnew\s+WebSocket\b/, name: 'WebSocket' },
  { re: /\bnew\s+EventSource\b/, name: 'EventSource' },
  { re: /\bnavigator\.connection\b/, name: 'navigator.connection' },
];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      yield* walk(full);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
      yield full;
    }
  }
}

const hits = [];
for (const file of walk(SRC)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, ''); // ignore line comments
    for (const { re, name } of FORBIDDEN) {
      if (re.test(code)) {
        hits.push(`${file}:${i + 1}  ${name}  →  ${line.trim()}`);
      }
    }
  });
}

if (hits.length > 0) {
  console.error('✗ no-network guard failed — the web app must make zero network calls:\n');
  console.error(hits.map((h) => '  ' + h).join('\n'));
  console.error('\nIf this is legitimate, it almost certainly still violates the privacy promise.');
  process.exit(1);
}

console.log('✓ no-network guard passed — no network APIs in webview-ui/src.');
