#!/usr/bin/env node
// Runs as a `prebuild` step, sibling to fetch-staff-prompt.mjs. Refreshes
// src/gennai-prompt.txt from the live hfu/layers-martin GENNAI_PROMPT.md
// (DECISIONS.md D10/D28 in that repo) -- the tight, offline-only Staff
// prompt variant for AI that can save a system prompt but has no internet
// access (e.g. 政府AI「源内」). On failure, leaves the existing file
// untouched, same fallback behavior as fetch-staff-prompt.mjs.

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = 'https://raw.githubusercontent.com/hfu/layers-martin/main/GENNAI_PROMPT.md';
const TARGET = fileURLToPath(new URL('../src/gennai-prompt.txt', import.meta.url));

try {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  await writeFile(TARGET, text, 'utf-8');
  console.log(`fetch-gennai-prompt: updated ${TARGET} from ${SOURCE_URL}`);
} catch (e) {
  console.error(`fetch-gennai-prompt: could not fetch ${SOURCE_URL}, keeping existing snapshot.`, e);
}
