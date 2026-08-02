import { parseMapIntent } from './mapIntent.ts';
import { resolveLayers, resolveStyles } from './catalog.ts';
import { buildStyle, computeInitialView } from './style.ts';
import { renderFormView, renderMapView } from './render.ts';
import { decodeIntentFragment } from './fragment.ts';
// Fetched at build time (scripts/fetch-staff-prompt.mjs), bundled as a plain
// string. Ported from hfu/faceless-cartographer D19; see DECISIONS.md D1.
import staffPromptMarkdown from './staff-prompt.txt?raw';

const app = document.getElementById('app');
if (!app) throw new Error('#app root element not found');

function showForm(opts: { prefill?: string; error?: string } = {}) {
  renderFormView(app!, { ...opts, staffPromptMarkdown, onSubmit: handleSubmit });
}

async function handleSubmit(rawIntent: string): Promise<void> {
  const parsed = parseMapIntent(rawIntent);
  if (!parsed.ok) {
    showForm({ prefill: rawIntent, error: parsed.error });
    return;
  }

  const { intent } = parsed;
  const [{ resolved, missing: missingLayers }, { resolved: resolvedStyles, missing: missingStyles }] = await Promise.all([
    resolveLayers(intent),
    resolveStyles(intent)
  ]);
  const missing = [...missingLayers, ...missingStyles];
  const { style, unrenderable, styleLayerIds, clickableLayerIds } = buildStyle(intent, resolved, resolvedStyles);
  const view = computeInitialView(intent, resolved);

  renderMapView(app!, {
    rawIntent,
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

// DECISIONS.md D2: unlike hfu/faceless-cartographer's one-shot, cleared-on-
// load fragment (D32 there), a spiccato URL is read on load and then kept
// live -- the fragment is never cleared, and renderMapView's own listeners
// (moveend, layer toggles) keep rewriting it via history.replaceState as
// the map changes. Opening the URL a second time reproduces the same map,
// by design.
async function bootstrap(): Promise<void> {
  const decoded = await decodeIntentFragment(location.hash);
  if (decoded !== null) {
    await handleSubmit(decoded);
    return;
  }
  showForm();
}

bootstrap();
