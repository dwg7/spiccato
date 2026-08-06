import { parseMapIntent } from './mapIntent.ts';
import { normalizeIntent } from './normalizeIntent.ts';
import { resolveLayers, resolveStyles } from './catalog.ts';
import { buildStyle, computeInitialView } from './style.ts';
import { renderFormView, renderMapView } from './render.ts';
import { decodeIntentFragment } from './fragment.ts';
import { parseShorthandFragment } from './shorthand.ts';
import { dump as yamlDump } from 'js-yaml';
import type { MapIntent } from './types.ts';
// Fetched at build time (scripts/fetch-staff-prompt.mjs), bundled as a plain
// string. Ported from hfu/faceless-cartographer D19; see DECISIONS.md D1.
import staffPromptMarkdown from './staff-prompt.txt?raw';
// Generated at build time (scripts/build-gennai-prompt.mjs) from the live
// hfu/layers-martin + stars-optgeo catalogs -- the standalone, offline-only
// Staff prompt variant (D10/D12) for AI that can save a system prompt but
// has no internet access. Lives at the repo root (not src/) since it's a
// real, reviewable document in its own right, same tier as DECISIONS.md.
import gennaiPromptMarkdown from '../GENNAI_PROMPT.md?raw';

const app = document.getElementById('app');
if (!app) throw new Error('#app root element not found');

function showForm(opts: { prefill?: string; error?: string } = {}) {
  renderFormView(app!, { ...opts, staffPromptMarkdown, gennaiPromptMarkdown, onSubmit: handleSubmit });
}

// Shared by the full-YAML path (handleSubmit) and the shorthand path
// (bootstrap's #q= branch, DECISIONS.md D6) -- both end up with a real
// MapIntent object and just run the same resolve/build/render pipeline.
// rawIntent is null only for shorthand, where there's no original text to
// preserve; it's synthesized here (after goal synthesis below) instead of
// upfront, so "Copy Map Intent" reflects the same goal text the panel shows.
async function renderIntent(intent: MapIntent, rawIntent: string | null): Promise<void> {
  const [{ resolved, missing: missingLayers }, { resolved: resolvedStyles, missing: missingStyles }] = await Promise.all([
    resolveLayers(intent),
    resolveStyles(intent)
  ]);
  const missing = [...missingLayers, ...missingStyles];

  // An empty goal (always true for shorthand-constructed intents, D6;
  // possible but unusual for a pasted/decoded one too) gets a readable
  // summary synthesized from whatever actually resolved, using each
  // catalog's own layer name -- so a Staff agent using the shorthand format
  // never has to write free-text Japanese prose at all in the common case.
  if (intent.goal === '') {
    const names = [
      ...resolved.map((r) => r.tilejson.name ?? r.source_id),
      ...resolvedStyles.map((s) => s.label ?? s.style_id)
    ];
    intent.goal = names.length > 0 ? `${names.join('、')} を表示。` : '(表示するレイヤーが指定されていません)';
  }

  const { style, unrenderable, styleLayerIds, clickableLayerIds } = buildStyle(intent, resolved, resolvedStyles);
  const view = computeInitialView(intent, resolved);

  renderMapView(app!, {
    rawIntent: rawIntent ?? yamlDump(intent),
    intent,
    view,
    style,
    resolved,
    resolvedStyles,
    styleLayerIds,
    clickableLayerIds,
    missing,
    unrenderable,
    onBack: () => {
      // Leaving the map view for the paste form also clears the URL back to
      // a bare path -- "Back" means "start over", not "keep sharing this".
      history.replaceState(null, '', location.pathname + location.search);
      showForm();
    }
  });
}

async function handleSubmit(rawIntent: string): Promise<void> {
  // DECISIONS.md D14: fills in ceremonial-but-unread fields (spec_version,
  // provenance.*, catalog id/type) before validation, so Staff agents that
  // skip them aren't rejected on schema ceremony rather than substance.
  // rawIntent itself (passed through below) stays as the author wrote it --
  // only the copy fed to parseMapIntent is normalized.
  const parsed = parseMapIntent(normalizeIntent(rawIntent));
  if (!parsed.ok) {
    showForm({ prefill: rawIntent, error: parsed.error });
    return;
  }
  await renderIntent(parsed.intent, rawIntent);
}

// DECISIONS.md D2: unlike hfu/faceless-cartographer's one-shot, cleared-on-
// load fragment (D32 there), a spiccato URL is read on load and then kept
// live -- the fragment is never cleared, and renderMapView's own listeners
// (moveend, layer toggles) keep rewriting it via history.replaceState as
// the map changes. Opening the URL a second time reproduces the same map,
// by design.
//
// Two decode formats are tried in order: the rich, compressed #m= format
// (full Map Intent fidelity, needs code execution to construct -- D3), then
// the plain #q= shorthand (no encoding at all, hand-writable -- D6, extended
// with render_hints/cartographer_feedback query params in D7). Once
// rendered, ongoing live reflection (renderMapView's updateFragment) stays
// on #q= for as long as the intent's shape fits there (single catalog, no
// styles, no explicit sharing_policy override) and only falls back to #m=
// once it doesn't -- so a simple #q= link now stays a #q= link even as the
// map is panned/zoomed/toggled.
async function bootstrap(): Promise<void> {
  const decoded = await decodeIntentFragment(location.hash);
  if (decoded !== null) {
    await handleSubmit(decoded);
    return;
  }

  const shorthandIntent = parseShorthandFragment(location.hash);
  if (shorthandIntent !== null) {
    await renderIntent(shorthandIntent, null);
    return;
  }

  showForm();
}

bootstrap();
