import type { Area, LayerRef, MapIntent, RenderHints } from './types.ts';

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
//   catalog     (required)  catalog_context.active_catalogs[0].uri
//   type        (optional)  catalog_type, default "layers_txt"
//   req         (optional)  comma-separated required_layers[*].source_id
//   opt         (optional)  comma-separated optional_layers[*].source_id
//                            (at least one of req/opt must be non-empty)
//   bbox        (optional)  "west,south,east,north"
//   name        (optional)  area.name
//   goal        (optional)  free text; if omitted, main.ts synthesizes one
//                            from the resolved layers' own catalog names
//                            once resolution completes (no Japanese-text
//                            escaping required from Staff at all in the
//                            common case)
//   lat/lng     (optional)  render_hints.center (note: lat,lng order to
//                            match how a Staff agent would say it in
//                            prose -- render_hints.center itself stays
//                            [lng, lat], GeoJSON order, internally)
//   zoom/bearing/pitch
//               (optional)  render_hints.{zoom,bearing,pitch}; only read
//                            when lat/lng are both present, matching
//                            computeInitialView's own precondition (style.ts)
//   missing / unrenderable
//               (optional)  comma-separated ids; round-tripped into
//                            cartographer_feedback.{missing_layers,
//                            unrenderable_layers} for symmetry with what
//                            buildShorthandFragment writes back (below) --
//                            not consumed by resolution itself (that's
//                            always recomputed from the live catalog)
//
// Deliberately NOT supported here (use #m= instead when needed): multiple
// catalogs, required_styles/optional_styles, explicit sharing_policy
// overrides (DECISIONS.md D7 lists this as one of the two remaining gaps,
// alongside multi-catalog/styles).
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

function parseNumber(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
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

  // DECISIONS.md D7: render_hints as plain numbers, no encoding needed.
  // Only meaningful once both halves of the center coordinate are present,
  // mirroring computeInitialView's own `hints?.center` precondition
  // (style.ts) -- a lone zoom/bearing/pitch with no center wouldn't know
  // what to center on, so it's silently ignored rather than guessed at.
  const lat = parseNumber(params.get('lat'));
  const lng = parseNumber(params.get('lng'));
  let renderHints: RenderHints | undefined;
  if (lat !== undefined && lng !== undefined) {
    renderHints = { center: [lng, lat] };
    const zoom = parseNumber(params.get('zoom'));
    const bearing = parseNumber(params.get('bearing'));
    const pitch = parseNumber(params.get('pitch'));
    if (zoom !== undefined) renderHints.zoom = zoom;
    if (bearing !== undefined) renderHints.bearing = bearing;
    if (pitch !== undefined) renderHints.pitch = pitch;
  }

  const missing = parseIdList(params.get('missing'));
  const unrenderable = parseIdList(params.get('unrenderable'));

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
    ...(renderHints ? { render_hints: renderHints } : {}),
    ...(missing.length > 0 || unrenderable.length > 0
      ? { cartographer_feedback: { missing_layers: missing, unrenderable_layers: unrenderable } }
      : {}),
    sharing_policy: { url_share: true, intent_share: true },
    provenance: {
      generated_by: 'spiccato-shorthand',
      generated_at: now,
      intent_id: `shorthand-${now}`
    }
  };

  return intent;
}

// The write side of the same round-trip: serializes the *current* live map
// state (center/zoom/bearing/pitch, current missing/unrenderable) back into
// "#q=..." wire format, for render.ts's updateFragment to use in place of
// #m= when it can. Returns null when the intent's shape falls outside what
// #q= can represent (DECISIONS.md D6/D7) -- callers must fall back to
// encodeIntentFragment (#m=) in that case:
//   - more than one active catalog
//   - any required_styles/optional_styles (no wire representation at all)
//   - an explicit sharing_policy that isn't #q='s own implicit default
//     ({ url_share: true, intent_share: true }, what parseShorthandFragment
//     always produces) -- D7 calls this out by name as a case #q= can't
//     carry, and silently normalizing a declared url_share:false away on
//     the next open would lose the advisory in render.ts
// Deliberately does NOT check relationships_to_highlight/resolution_policy/
// per-catalog `version` -- current example intents don't exercise the first
// two, and D6 already treats source_id-only layer refs (no label, no
// per-catalog version pin) as an accepted simplification of this format.
export function buildShorthandFragment(
  intent: MapIntent,
  live: { center: [number, number]; zoom: number; bearing: number; pitch: number; missing: string[]; unrenderable: string[] }
): string | null {
  const catalogs = intent.catalog_context.active_catalogs;
  if (catalogs.length !== 1) return null;
  if ((intent.required_styles?.length ?? 0) > 0 || (intent.optional_styles?.length ?? 0) > 0) return null;

  const required = intent.required_layers ?? [];
  const optional = intent.optional_layers ?? [];
  if (required.length === 0 && optional.length === 0) return null;

  const policy = intent.sharing_policy;
  if (policy && (policy.url_share !== true || policy.intent_share !== true)) return null;

  const params = new URLSearchParams();
  params.set('catalog', catalogs[0].uri);
  if (catalogs[0].type !== 'layers_txt') params.set('type', catalogs[0].type);
  if (required.length > 0) params.set('req', required.map((r) => r.source_id).join(','));
  if (optional.length > 0) params.set('opt', optional.map((r) => r.source_id).join(','));
  if (intent.area?.bbox) params.set('bbox', intent.area.bbox.join(','));
  if (intent.area?.name) params.set('name', intent.area.name);
  if (intent.goal) params.set('goal', intent.goal);

  params.set('lat', String(live.center[1]));
  params.set('lng', String(live.center[0]));
  params.set('zoom', String(live.zoom));
  params.set('bearing', String(live.bearing));
  params.set('pitch', String(live.pitch));
  if (live.missing.length > 0) params.set('missing', live.missing.join(','));
  if (live.unrenderable.length > 0) params.set('unrenderable', live.unrenderable.join(','));

  return `${HASH_PREFIX}${params.toString()}`;
}
