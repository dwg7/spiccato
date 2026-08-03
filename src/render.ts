// maplibre-gl 6.x dropped its default export in favor of named exports
// (see its own export list: `Map$1 as Map, Map$1 as MapLibreMap`) -- using
// the `MapLibreMap` alias it ships for exactly this reason, since a plain
// `Map` import would shadow the built-in Map class used throughout this
// file (layerIdsBySourceId, visibility, legendBySourceId, ...).
import { MapLibreMap, NavigationControl, AttributionControl, TerrainControl, Popup } from 'maplibre-gl';
import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import { LayerControl } from 'maplibre-gl-layer-control';
import 'maplibre-gl-layer-control/style.css';
import type { MapIntent, ResolvedLayer, ResolvedStyle } from './types.ts';
import type { InitialView, MapLibreStyle } from './style.ts';
import { encodeIntentFragment } from './fragment.ts';
import { buildShorthandFragment } from './shorthand.ts';

// UI structure (panel layout, layer checkboxes, legend, feature-click
// popups, layer search, LayerControl integration) is ported from
// hfu/faceless-cartographer (2nd gen, commit a016206) -- see DECISIONS.md D1
// for the lineage note. The URL-reflection mechanics are rewritten: no
// per-session opt-in toggle, no "faceless vs idempotent" mode split (see
// DECISIONS.md D2) -- the fragment is always kept live.

interface MapIntentExample {
  id: string;
  menuLabel: string;
  sampleQuestionEn: string;
  sampleQuestionJa: string;
  yaml: string;
}

// Kumamoto listed first -- the actual Staff-generated intent that motivated
// this repository (see DECISIONS.md D1): a real disaster-response orthophoto,
// verified against hfu/layers-martin's catalog the day after the quake.
//
// The layers-martin catalog URI below deliberately uses the ".json" suffix,
// not the extensionless "/catalog" alias -- hfu.github.io serves the same
// bytes either way, but with content-type: application/octet-stream for the
// extensionless form vs application/json for ".json" (confirmed via curl).
// A Staff agent fetching the catalog to verify source_ids before writing a
// Map Intent is more likely to have that fetch handled as text/JSON, not a
// binary download, when the URL is unambiguous about its content type.
// Cartographer's own resolution (catalog.ts, catalogBaseUrl) is unaffected
// either way -- it strips both forms to the same base URL and never fetches
// the catalog root itself.
const EXAMPLES: MapIntentExample[] = [
  {
    id: 'kumamoto-orthophoto',
    menuLabel: '令和8年熊本地震・八代地区正射画像（速報）',
    sampleQuestionEn: 'I want to see the latest disaster-response orthophoto for the Kumamoto earthquake.',
    sampleQuestionJa: '令和8年熊本地震の災害対応正射画像（速報）を見たい。',
    yaml: `spec_version: "map-intent/v2"
goal: "令和8年（2026年）熊本地震（2026-07-28発生）に関する国土地理院の災害対応正射画像（速報）を、背景の地形とともに示す。"
area:
  name: "熊本県八代市周辺"
  bbox: [130.45, 32.35, 130.75, 32.65]
catalog_context:
  active_catalogs:
    - id: "layers-martin"
      type: "layers_txt"
      uri: "https://hfu.github.io/layers-martin/catalog.json"
required_layers:
  - source_id: "20260729kumamoto_yatsushiro_0729do_sokuho"
    label: "八代地区正射画像（速報、2026/7/29撮影）"
sharing_policy:
  url_share: true
  intent_share: true
provenance:
  generated_by: "staff-agent-demo"
  generated_at: "2026-08-03T00:00:00Z"
  intent_id: "demo-kumamoto-orthophoto-001"
`
  },
  {
    id: 'ishikari-flood-control',
    menuLabel: '石狩川の治水（レイヤー構成）',
    sampleQuestionEn: 'I want to explore flood control of the Ishikari River.',
    sampleQuestionJa: '石狩川の治水について考えたい。',
    yaml: `spec_version: "map-intent/v2"
goal: "石狩川下流域（石狩平野）の治水を考えるため、治水地形分類図（旧河道・自然堤防・後背湿地などの地形）と洪水浸水想定区域を重ね、地形条件と想定される浸水範囲の関係を背景地形とともに示す。"
area:
  name: "石狩川下流域（石狩平野）"
  bbox: [141.25, 43.0, 141.85, 43.4]
catalog_context:
  active_catalogs:
    - id: "layers-martin"
      type: "layers_txt"
      uri: "https://hfu.github.io/layers-martin/catalog.json"
      version: "2026-07-09T00:00:00Z"
required_layers:
  - source_id: "lcmfc2"
    label: "治水地形分類図"
  - source_id: "01_flood_l2_shinsuishin_data"
    label: "洪水浸水想定区域（想定最大規模）"
optional_layers:
  - source_id: "01_flood_l1_shinsuishin_newlegend_data"
    label: "洪水浸水想定区域（計画規模）"
relationships_to_highlight:
  - "治水地形分類図が示す旧河道・後背湿地などの低地地形と、想定浸水範囲の対応関係"
sharing_policy:
  url_share: true
  intent_share: true
provenance:
  generated_by: "spiccato"
  generated_at: "2026-07-09T00:00:00Z"
  intent_id: "example-ishikari-flood-control"
`
  },
  {
    id: 'volcano-land-condition-map',
    menuLabel: '北海道の火山土地条件図（スタイル参照）',
    sampleQuestionEn: 'I want to see the volcanic land condition map of Hokkaido.',
    sampleQuestionJa: '北海道の火山土地条件図を見たい。',
    yaml: `spec_version: "map-intent/v2"
goal: "北海道（道央）の火山土地条件図を、地形とともに示す。"
area:
  name: "有珠山・洞爺湖周辺"
  bbox: [140.6, 42.4, 141.1, 42.8]
catalog_context:
  active_catalogs:
    - id: "stars-optgeo"
      type: "martin"
      uri: "https://stars.optgeo.org/catalog"
required_styles:
  - style_id: "vlcm"
    label: "火山土地条件図"
optional_styles:
  - style_id: "vbm"
    label: "火山基本図"
sharing_policy:
  url_share: true
  intent_share: true
provenance:
  generated_by: "spiccato"
  generated_at: "2026-07-21T00:00:00Z"
  intent_id: "example-volcano-land-condition-map"
`
  }
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Feature-click attribute popups, ported from hfu/faceless-cartographer D41
// (see that repo's DECISIONS.md for the validation against four independent
// vector catalogs).
export function isInternalPropertyKey(key: string): boolean {
  return /code|コード/i.test(key);
}

export function shouldShowProperty(key: string, value: unknown): boolean {
  return typeof value !== 'number' && !isInternalPropertyKey(key);
}

export function buildPopupHtml(properties: Record<string, unknown>): string | null {
  const entries = Object.entries(properties).filter(([key, value]) => shouldShowProperty(key, value));
  if (entries.length === 0) return null;
  const rows = entries
    .map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value))}</dd>`)
    .join('');
  return `<dl class="feature-popup">${rows}</dl>`;
}

async function copyToClipboard(button: HTMLButtonElement, text: string): Promise<void> {
  const label = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = 'Copied!';
  } catch {
    button.textContent = 'Copy failed';
  }
  setTimeout(() => {
    button.textContent = label;
  }, 1500);
}

function extractStaffPromptBlock(markdown: string): string {
  const match = markdown.match(/````text\n([\s\S]*?)\n````/);
  return (match ? match[1] : markdown).trim();
}

// Fallback entry point for anyone who lands here without a link already in
// hand (e.g. testing a Staff prompt manually). The primary flow is opening
// a `#m=...` URL a Staff agent handed you directly -- see main.ts bootstrap()
// -- which skips this screen entirely.
export function renderFormView(
  container: HTMLElement,
  opts: { prefill?: string; error?: string; staffPromptMarkdown: string; onSubmit: (rawIntent: string) => void }
): void {
  const value = escapeHtml(opts.prefill ?? EXAMPLES[0].yaml);
  const errorBlock = opts.error ? `<div class="notice error">${escapeHtml(opts.error)}</div>` : '';
  const staffPromptRaw = extractStaffPromptBlock(opts.staffPromptMarkdown);
  const staffPrompt = escapeHtml(staffPromptRaw);

  container.innerHTML = `
<div class="form-view">
  <div class="wrap">
    <div class="card">
      <h1>Spiccato</h1>
      <p>Open a link, see the map. Usually you won't see this page at all -- your AI hands you a URL, you click it, the map is already there. This form is the fallback for setting things up, or for pasting a Map Intent by hand.</p>
    </div>
    <div class="card">
      <div class="step-header">
        <button id="copy-staff-prompt" type="button" class="dads-button" data-type="outline" data-size="sm">Copy</button>
        <h2 class="card-step">1. Prompt your AI</h2>
      </div>
      <p>Copy this prompt and give it to your AI (for example, Claude or ChatGPT). It teaches your AI to write a Map Intent.</p>
      <details class="dads-disclosure">
        <summary class="dads-disclosure__summary">
          <svg class="dads-disclosure__icon" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="11" fill="currentcolor"/>
            <circle class="dads-disclosure__icon-circle" cx="12" cy="12" r="8" fill="currentcolor"/>
            <path class="dads-disclosure__icon-triangle" d="M17 10H7L12 15L17 10Z" fill="Canvas"/>
          </svg>
          See the prompt
        </summary>
        <div class="dads-disclosure__content">
          <p style="font-size:0.82rem;color:#555;">Prompt source: <a href="https://github.com/hfu/layers-martin/blob/main/STAFF_PROMPT.md" target="_blank" rel="noreferrer">hfu/layers-martin STAFF_PROMPT.md</a></p>
          <pre>${staffPrompt}</pre>
        </div>
      </details>
    </div>
    <div class="card">
      <h2 class="card-step">2. Ask your AI</h2>
      <p>Now ask your AI a map question. For example:</p>
      <select id="example-select" class="dads-text-input" style="width:100%;margin-bottom:.5rem;padding:0.4rem 0.6rem;">
        ${EXAMPLES.map((ex) => `<option value="${escapeHtml(ex.id)}">${escapeHtml(ex.menuLabel)}</option>`).join('\n')}
      </select>
      <div class="sample" id="sample-question">
        <p>${escapeHtml(EXAMPLES[0].sampleQuestionEn)}</p>
        <p>${escapeHtml(EXAMPLES[0].sampleQuestionJa)}</p>
      </div>
    </div>
    <div class="card">
      <h2 class="card-step">3. Get a link, or paste</h2>
      <p>A Spiccato-aware AI can build <code>https://dwg7.github.io/spiccato/#m=...</code> directly and just give you that link. If yours doesn't yet, paste the Map Intent it wrote for you here instead.</p>
      ${errorBlock}
      <form id="intent-form">
        <textarea name="map_intent" rows="22">${value}</textarea>
        <p><button type="submit" class="dads-button" data-type="solid-fill" data-size="md">Render</button></p>
      </form>
    </div>
  </div>
</div>`;

  const copyPromptButton = container.querySelector<HTMLButtonElement>('#copy-staff-prompt')!;
  copyPromptButton.addEventListener('click', () => copyToClipboard(copyPromptButton, staffPromptRaw));

  const form = container.querySelector<HTMLFormElement>('#intent-form')!;
  const textarea = form.querySelector<HTMLTextAreaElement>('textarea[name=map_intent]')!;

  const exampleSelect = container.querySelector<HTMLSelectElement>('#example-select')!;
  const sampleQuestionDiv = container.querySelector<HTMLElement>('#sample-question')!;
  exampleSelect.addEventListener('change', () => {
    const selected = EXAMPLES.find((ex) => ex.id === exampleSelect.value) ?? EXAMPLES[0];
    sampleQuestionDiv.innerHTML = `<p>${escapeHtml(selected.sampleQuestionEn)}</p><p>${escapeHtml(selected.sampleQuestionJa)}</p>`;
    textarea.value = selected.yaml;
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    opts.onSubmit(textarea.value);
  });
}

// Renders the map for a validated, resolved Map Intent. Full-bleed map with
// a floating panel overlaid top-left (layout pattern from
// hfu/faceless-cartographer D11/D33). Unlike that repo, the URL fragment is
// kept live unconditionally from the moment this view is entered -- see
// DECISIONS.md D2 for why that's the whole point of this repository.
export function renderMapView(
  container: HTMLElement,
  opts: {
    rawIntent: string;
    intent: MapIntent;
    view: InitialView;
    style: MapLibreStyle;
    resolved: ResolvedLayer[];
    resolvedStyles: ResolvedStyle[];
    styleLayerIds: Record<string, string[]>;
    clickableLayerIds: string[];
    missing: string[];
    unrenderable: string[];
    onBack: () => void;
  }
): void {
  const { rawIntent, intent, view, style, resolved, resolvedStyles, styleLayerIds, clickableLayerIds, missing, unrenderable, onBack } = opts;

  const missingNotice =
    missing.length > 0
      ? `<div class="notice"><strong>見つからないレイヤー/スタイル(missing_layers)</strong>: ${missing.map(escapeHtml).join(', ')}</div>`
      : '';
  const unrenderableNotice =
    unrenderable.length > 0
      ? `<div class="notice"><strong>描画をスキップしたレイヤー/スタイル</strong>: ${unrenderable
          .map(escapeHtml)
          .join(', ')}(vector_layers が catalog 側に無い、またはスタイルに描画可能な layers が無いため、描画に必要な情報を復元できません)</div>`
      : '';
  // DECISIONS.md D2: sharing_policy.url_share doesn't gate anything here
  // (spiccato always reflects state to the URL) -- it's re-read as an
  // advisory the intent's author declared about *this content*, surfaced so
  // a human forwarding the link can factor it in before they do.
  const urlShareAdvisory =
    intent.sharing_policy?.url_share === false
      ? `<div class="notice info">この Map Intent は <code>sharing_policy.url_share: false</code>(URL共有を想定しない)と宣言されています。spiccato は常にURLへ地図状態を反映するため、共有前にこのURLの内容を確認してください。</div>`
      : '';

  const allLayerCheckboxes = resolved
    .map(
      (r) =>
        `<div class="layer-item">
          <label class="dads-checkbox" data-size="sm">
            <span class="dads-checkbox__checkbox">
              <input class="dads-checkbox__input" type="checkbox" data-layer-toggle="${escapeHtml(r.source_id)}"${r.required ? ' checked' : ''}>
            </span>
            <span class="dads-checkbox__label">${escapeHtml(r.label ?? r.source_id)}</span>
          </label>
          <div class="legend-item-inline" data-legend-for="${escapeHtml(r.source_id)}" style="display:none;margin-top:.3rem;">
            <img src="" alt="${escapeHtml(r.label ?? r.source_id)}" style="max-width:100%;display:block;">
          </div>
          <div class="legend-pdf-inline" data-legend-pdf-for="${escapeHtml(r.source_id)}" style="display:none;margin-top:.3rem;">
            <a href="" target="_blank" rel="noreferrer">凡例 (PDF)</a>
          </div>
        </div>`
    )
    .join('\n');

  const allStyleCheckboxes = resolvedStyles
    .map(
      (s) =>
        `<div class="layer-item">
          <label class="dads-checkbox" data-size="sm">
            <span class="dads-checkbox__checkbox">
              <input class="dads-checkbox__input" type="checkbox" data-layer-toggle="${escapeHtml(s.style_id)}"${s.required ? ' checked' : ''}>
            </span>
            <span class="dads-checkbox__label">${escapeHtml(s.label ?? s.style_id)}</span>
          </label>
        </div>`
    )
    .join('\n');

  container.innerHTML = `
<div class="map-view">
  <div id="map"></div>
  <div class="panel" data-collapsed="false">
    <button id="panel-toggle" class="panel__toggle" type="button" aria-expanded="true" aria-label="パネルを折りたたむ/展開する">
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" style="display:inline-block;">
        <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    <div class="panel__content">
      <h1>Spiccato</h1>
      <p>${escapeHtml(intent.goal)}</p>
      ${missingNotice}
      ${unrenderableNotice}
      ${urlShareAdvisory}
      ${resolved.length > 0 || resolvedStyles.length > 0 ? `
      <div class="layer-search-wrapper" style="margin: .5rem 0;">
        <input type="text" id="layer-search" placeholder="🔍 Search layers..." class="dads-text-input" style="width: 100%; font-size: 0.88rem; padding: 0.4rem 0.6rem; border: 1px solid rgba(0, 0, 0, 0.2); border-radius: var(--border-radius-4);">
      </div>
      <div class="layers">${allLayerCheckboxes}${allStyleCheckboxes}</div>
      ` : ''}
      <div class="actions">
        <button id="copy-intent" type="button" class="dads-button" data-type="solid-fill" data-size="md">Copy Map Intent</button>
        <button id="copy-link" type="button" class="dads-button" data-type="outline" data-size="md">Copy Link</button>
        <button id="back-button" type="button" class="dads-button" data-type="outline" data-size="md">Back</button>
      </div>
    </div>
  </div>
</div>`;

  const map = new MapLibreMap({
    container: container.querySelector('#map') as HTMLElement,
    style: style as StyleSpecification,
    center: view.center,
    zoom: view.zoom,
    bearing: view.bearing,
    pitch: view.pitch,
    attributionControl: false,
    localIdeographFontFamily: 'sans-serif'
  });
  if (view.bounds) {
    map.fitBounds(view.bounds, { padding: 40, duration: 0 });
  }
  // No error surface existed for map-level failures (bad tiles, style
  // issues) before this -- worth keeping even though it was added while
  // diagnosing a background-tab rendering artifact in an automated browser
  // tool, not a real bug (see DECISIONS.md).
  map.on('error', (e) => console.error('MapLibre error:', e.error?.message ?? e));
  map.addControl(new NavigationControl());
  map.addControl(new AttributionControl({ compact: true }), 'bottom-right');
  map.addControl(new TerrainControl({ source: 'mapterhorn', exaggeration: 1 }), 'top-right');

  try {
    const thematicSourceIds = new Set(resolved.map((r) => r.source_id));
    const thematicLayerIds = style.layers
      .filter((layer) => {
        const source = layer.source as string | undefined;
        return source && thematicSourceIds.has(source);
      })
      .map((layer) => layer.id as string);
    const styleContributedLayerIds = Object.values(styleLayerIds).flat();

    const layerControl = new LayerControl({
      collapsed: true,
      layers: [...thematicLayerIds, ...styleContributedLayerIds]
    });
    map.addControl(layerControl, 'top-right');
  } catch (e) {
    console.warn('LayerControl initialization failed; proceeding without layer panel', e);
  }

  if (clickableLayerIds.length > 0) {
    map.on('mousemove', (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: clickableLayerIds });
      map.getCanvas().style.cursor = features.length > 0 ? 'pointer' : '';
    });
    map.on('click', (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: clickableLayerIds });
      if (features.length === 0) return;
      const html = buildPopupHtml(features[0].properties ?? {});
      if (!html) return;
      new Popup({ closeButton: true, maxWidth: '18rem' }).setLngLat(e.lngLat).setHTML(html).addTo(map);
    });
  }

  const legendBySourceId = new Map(
    resolved.filter((r) => r.tilejson.legend_image_url).map((r) => [r.source_id, { url: r.tilejson.legend_image_url!, label: r.label ?? r.source_id }])
  );
  const legendPdfBySourceId = new Map(
    resolved
      .filter((r) => r.tilejson.legend_pdf_url && !r.tilejson.legend_image_url)
      .map((r) => [r.source_id, r.tilejson.legend_pdf_url!])
  );
  const visibility = new Map<string, boolean>();
  legendBySourceId.forEach((_v, id) => visibility.set(id, false));
  legendPdfBySourceId.forEach((_v, id) => visibility.set(id, false));
  resolved.filter((r) => r.required).forEach((r) => visibility.set(r.source_id, true));

  function updateLegendDisplay() {
    resolved.forEach((r) => {
      const isVisible = visibility.get(r.source_id) ?? false;

      const legendEl = container.querySelector<HTMLElement>(`[data-legend-for="${escapeHtml(r.source_id)}"]`);
      if (legendEl) {
        const hasLegend = legendBySourceId.has(r.source_id);
        if (isVisible && hasLegend) {
          const entry = legendBySourceId.get(r.source_id)!;
          legendEl.style.display = 'block';
          const img = legendEl.querySelector('img') as HTMLImageElement;
          img.src = entry.url;
          img.alt = entry.label;
          img.loading = 'lazy';
        } else {
          legendEl.style.display = 'none';
        }
      }

      const pdfEl = container.querySelector<HTMLElement>(`[data-legend-pdf-for="${escapeHtml(r.source_id)}"]`);
      if (pdfEl) {
        const hasPdf = legendPdfBySourceId.has(r.source_id);
        if (isVisible && hasPdf) {
          pdfEl.style.display = 'block';
          const a = pdfEl.querySelector('a') as HTMLAnchorElement;
          a.href = legendPdfBySourceId.get(r.source_id)!;
        } else {
          pdfEl.style.display = 'none';
        }
      }
    });
  }
  updateLegendDisplay();

  const layerIdsBySourceId = new Map<string, string[]>();
  for (const styleLayer of style.layers) {
    const source = (styleLayer as { source?: string }).source;
    const id = (styleLayer as { id: string }).id;
    if (!source) continue;
    const list = layerIdsBySourceId.get(source) ?? [];
    list.push(id);
    layerIdsBySourceId.set(source, list);
  }
  for (const [styleId, ids] of Object.entries(styleLayerIds)) {
    layerIdsBySourceId.set(styleId, ids);
  }

  container.querySelectorAll<HTMLInputElement>('[data-layer-toggle]').forEach((el) => {
    el.addEventListener('change', () => {
      const id = el.getAttribute('data-layer-toggle')!;
      const layerIds = layerIdsBySourceId.get(id) ?? [];
      for (const layerId of layerIds) {
        map.setLayoutProperty(layerId, 'visibility', el.checked ? 'visible' : 'none');
      }
      visibility.set(id, el.checked);
      updateLegendDisplay();
      updateFragment();
    });
  });

  const searchInput = container.querySelector<HTMLInputElement>('#layer-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const searchText = searchInput.value.toLowerCase().trim();
      const layerItems = container.querySelectorAll<HTMLElement>('.layer-item');

      layerItems.forEach((item) => {
        const labelElement = item.querySelector('.dads-checkbox__label');
        const layerLabel = labelElement?.textContent?.toLowerCase() ?? '';
        const matches = !searchText || layerLabel.includes(searchText);
        item.style.display = matches ? '' : 'none';
      });
    });
  }

  map.on('moveend', () => {
    updateFragment();
  });

  const panelElement = container.querySelector<HTMLElement>('.panel')!;
  const panelToggle = container.querySelector<HTMLButtonElement>('#panel-toggle')!;
  panelToggle.addEventListener('click', () => {
    const isCollapsed = panelElement.dataset.collapsed === 'true';
    panelElement.dataset.collapsed = isCollapsed ? 'false' : 'true';
    panelToggle.setAttribute('aria-expanded', isCollapsed ? 'true' : 'false');
  });

  container.querySelector<HTMLButtonElement>('#back-button')!.addEventListener('click', onBack);

  // Builds the Map Intent YAML with the *current* view baked into
  // render_hints (map-intent-vnext.md §5), same cartographer_feedback
  // embedding as hfu/faceless-cartographer D15. Ported verbatim.
  function buildCurrentIntentYaml(): string {
    try {
      const doc = (yamlLoad(rawIntent) as Record<string, unknown>) || {};
      const center = map.getCenter();
      doc.render_hints = {
        ...(doc.render_hints as Record<string, unknown> | undefined),
        center: [center.lng, center.lat],
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch()
      };
      if (missing.length > 0 || unrenderable.length > 0) {
        doc.cartographer_feedback = {
          missing_layers: missing,
          unrenderable_layers: unrenderable
        };
      }
      return yamlDump(doc);
    } catch (e) {
      console.error('Could not update render_hints; using the original Map Intent instead.', e);
      return rawIntent;
    }
  }

  // DECISIONS.md D2/D3/D7: the fragment is rewritten unconditionally, every
  // time -- no per-session opt-in, no sharing_policy gate. Prefer the plain
  // #q= shorthand (D7's extension of D6: render_hints/cartographer_feedback
  // as literal query params, no encoding) when the current intent's shape
  // fits within it -- single catalog, no styles, no explicit sharing_policy
  // override (buildShorthandFragment enforces this, see its own doc
  // comment). That case is synchronous, so it skips the fragment-generation
  // dance entirely. Only intents #q= can't represent (multiple catalogs,
  // required_styles/optional_styles, sharing_policy overrides) fall back to
  // #m=; encodeIntentFragment is async (it compresses via CompressionStream),
  // so a generation counter discards a stale in-flight encode if a newer map
  // change starts a fresh one before it resolves (e.g. a fast pan followed
  // immediately by a layer toggle) -- otherwise the slower of the two could
  // win and silently overwrite the URL with outdated state.
  let fragmentGeneration = 0;
  function updateFragment(): void {
    const generation = ++fragmentGeneration;
    const center = map.getCenter();
    const shorthand = buildShorthandFragment(intent, {
      center: [center.lng, center.lat],
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
      missing,
      unrenderable
    });
    if (shorthand !== null) {
      history.replaceState(null, '', `${location.pathname}${location.search}${shorthand}`);
      return;
    }

    const yaml = buildCurrentIntentYaml();
    encodeIntentFragment(yaml)
      .then((encoded) => {
        if (generation !== fragmentGeneration) return; // superseded by a newer change
        history.replaceState(null, '', `${location.pathname}${location.search}#m=${encoded}`);
      })
      .catch((e) => {
        console.error('Could not update the URL fragment.', e);
      });
  }
  updateFragment(); // populate the URL immediately -- state-in-URL is the default, not an opt-in

  const copyIntentButton = container.querySelector<HTMLButtonElement>('#copy-intent')!;
  copyIntentButton.addEventListener('click', () => copyToClipboard(copyIntentButton, buildCurrentIntentYaml()));

  const copyLinkButton = container.querySelector<HTMLButtonElement>('#copy-link')!;
  copyLinkButton.addEventListener('click', () => copyToClipboard(copyLinkButton, location.href));
}
