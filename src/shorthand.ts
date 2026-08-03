import type { Area, LayerRef, MapIntent } from './types.ts';

// A hand-writable alternative to the compressed #m= format (DECISIONS.md
// D3), aimed at Staff agents without code execution: no binary encoding at
// all, just a catalog URI and literal source_ids (already verified against
// that catalog) joined by commas -- ordinary query-string syntax that any
// text-generating model can produce character-for-character correctly. See
// DECISIONS.md D6 for the full rationale and the "why this isn't a second
// schema" argument: this expands into a real MapIntent object and flows
// through the exact same resolveLayers/buildStyle/renderMapView pipeline as
// any other intent -- it's an alternate wire encoding of a subset of Map
// Intent, not a competing format.
//
// Wire format (everything after "#q="): a standard query string.
//   catalog   (required)  catalog_context.active_catalogs[0].uri
//   type      (optional)  catalog_type, default "layers_txt"
//   req       (optional)  comma-separated required_layers[*].source_id
//   opt       (optional)  comma-separated optional_layers[*].source_id
//                          (at least one of req/opt must be non-empty)
//   bbox      (optional)  "west,south,east,north"
//   name      (optional)  area.name
//   goal      (optional)  free text; if omitted, main.ts synthesizes one
//                          from the resolved layers' own catalog names
//                          once resolution completes (no Japanese-text
//                          escaping required from Staff at all in the
//                          common case)
//
// Deliberately NOT supported here (use #m= instead when needed): multiple
// catalogs, required_styles/optional_styles, render_hints, sharing_policy
// overrides, cartographer_feedback round-trip.
const HASH_PREFIX = '#q=';

function parseBbox(raw: string | null): [number, number, number, number] | undefined {
  if (!raw) return undefined;
  const parts = raw.split(',').map((s) => Number(s.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return undefined;
  return parts as [number, number, number, number];
}

function parseIdList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Returns null for anything unusable (wrong prefix, missing catalog, no
// layers at all) so callers can fall back to the paste form, same
// convention as decodeIntentFragment.
export function parseShorthandFragment(hash: string): MapIntent | null {
  if (!hash.startsWith(HASH_PREFIX)) return null;
  const body = hash.slice(HASH_PREFIX.length);
  if (body === '') return null;

  const params = new URLSearchParams(body);
  const catalogUri = params.get('catalog');
  if (!catalogUri) return null;

  const required = parseIdList(params.get('req'));
  const optional = parseIdList(params.get('opt'));
  if (required.length === 0 && optional.length === 0) return null;

  const bbox = parseBbox(params.get('bbox'));
  const areaName = params.get('name');
  const goal = params.get('goal');
  const catalogType = params.get('type') || 'layers_txt';

  let area: Area | undefined;
  if (areaName || bbox) {
    area = {};
    if (areaName) area.name = areaName;
    if (bbox) area.bbox = bbox;
  }

  const toRefs = (ids: string[]): LayerRef[] => ids.map((source_id) => ({ source_id }));
  const now = new Date().toISOString();

  const intent: MapIntent = {
    spec_version: 'map-intent/v2',
    // Empty string is the sentinel main.ts looks for to synthesize a goal
    // from resolved layer names post-resolution -- see renderIntent().
    goal: goal ?? '',
    ...(area ? { area } : {}),
    catalog_context: {
      active_catalogs: [{ id: 'catalog', type: catalogType, uri: catalogUri }]
    },
    ...(required.length > 0 ? { required_layers: toRefs(required) } : {}),
    ...(optional.length > 0 ? { optional_layers: toRefs(optional) } : {}),
    sharing_policy: { url_share: true, intent_share: true },
    provenance: {
      generated_by: 'spiccato-shorthand',
      generated_at: now,
      intent_id: `shorthand-${now}`
    }
  };

  return intent;
}
