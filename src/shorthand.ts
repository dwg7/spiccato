import type { Area, LayerRef, MapIntent, RenderHints, StyleRef } from './types.ts';

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
//   req         (optional)  comma-separated required_layers[*], each entry
//                            either a bare source_id or "source_id|label"
//                            (DECISIONS.md D19 -- Issue #5 pointed out that
//                            the Cartographer panel had nothing but the raw
//                            source_id to display; render.ts already falls
//                            back to `label ?? source_id`, so carrying label
//                            here was the only missing piece). The "|" was
//                            chosen to match the "id|name" convention
//                            GENNAI_PROMPT.md's embedded catalog listing
//                            already uses (scripts/build-gennai-prompt.mjs),
//                            so Staff sees one convention, not two.
//   opt         (optional)  comma-separated optional_layers[*], same
//                            "source_id" / "source_id|label" entry syntax
//   rstyle      (optional)  comma-separated required_styles[*], each entry
//                            either a bare style_id or "style_id|label" --
//                            same wire shape as req/opt (StyleRef has the
//                            same "id + optional label" structure as
//                            LayerRef, DECISIONS.md D20). Only resolvable
//                            when the single active catalog is a real
//                            Martin server (catalog_type "martin"); against
//                            a layers_txt catalog this just resolves to
//                            "missing" like any other bad id, no special
//                            validation needed here (at least one of
//                            req/opt/rstyle/ostyle must be non-empty)
//   ostyle      (optional)  comma-separated optional_styles[*], same
//                            "style_id" / "style_id|label" entry syntax
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
// catalogs, explicit sharing_policy overrides. required_styles/
// optional_styles were also on this list until D20 added rstyle/ostyle --
// see DECISIONS.md D7/D8 for the original two-gaps framing and D20 for why
// closing the styles half turned out to be a small, additive change (D6/D8
// already resolve required_styles/optional_styles against the *same*
// active_catalogs array as required_layers/optional_layers -- no separate
// "style catalog" concept exists to complicate the single-catalog
// restriction below).
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

// A req/opt entry is "source_id" or "source_id|label" (D19). The label half
// is percent-encoded on write (buildRefEntry below) so a label containing a
// literal "," or "|" can never be mistaken for the entry/id separators --
// without this, a single label with a stray comma would silently split into
// a bogus extra "layer" (its tail) that fails to resolve against the
// catalog. Staff agents constructing this by hand (no code execution) can't
// run encodeURIComponent themselves, so GENNAI_PROMPT.md/STAFF_PROMPT.md
// separately tell them to just avoid literal commas in labels -- this
// decode path is the safety net for links built by code (openweb/,
// mcp/src/linkBuilder.ts), not a substitute for that guidance.
function parseRefEntry(entry: string): LayerRef {
  const sep = entry.indexOf('|');
  if (sep === -1) return { source_id: entry };
  const source_id = entry.slice(0, sep);
  const rawLabel = entry.slice(sep + 1);
  if (rawLabel === '') return { source_id };
  try {
    return { source_id, label: decodeURIComponent(rawLabel) };
  } catch {
    // Malformed percent-encoding (e.g. a hand-typed label with a lone "%")
    // -- fall back to the raw text rather than reject the whole link,
    // same Postel's-law-leaning policy as normalizeIntent.ts.
    return { source_id, label: rawLabel };
  }
}

function parseRefList(raw: string | null): LayerRef[] {
  return parseIdList(raw).map(parseRefEntry);
}

function buildRefEntry(ref: LayerRef): string {
  return ref.label ? `${ref.source_id}|${encodeURIComponent(ref.label)}` : ref.source_id;
}

// Style-ref counterpart of parseRefEntry/buildRefEntry/parseRefList above --
// same "id[|label]" wire shape, just keyed on style_id instead of source_id
// (D20). Kept as separate concrete functions rather than a generalized
// helper: the two ref shapes are only accidentally similar (LayerRef vs.
// StyleRef are distinct, non-interchangeable types), and the duplication is
// three short functions, not worth abstracting over.
function parseStyleRefEntry(entry: string): StyleRef {
  const sep = entry.indexOf('|');
  if (sep === -1) return { style_id: entry };
  const style_id = entry.slice(0, sep);
  const rawLabel = entry.slice(sep + 1);
  if (rawLabel === '') return { style_id };
  try {
    return { style_id, label: decodeURIComponent(rawLabel) };
  } catch {
    return { style_id, label: rawLabel };
  }
}

function parseStyleRefList(raw: string | null): StyleRef[] {
  return parseIdList(raw).map(parseStyleRefEntry);
}

function buildStyleRefEntry(ref: StyleRef): string {
  return ref.label ? `${ref.style_id}|${encodeURIComponent(ref.label)}` : ref.style_id;
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

  const required = parseRefList(params.get('req'));
  const optional = parseRefList(params.get('opt'));
  const requiredStyles = parseStyleRefList(params.get('rstyle'));
  const optionalStyles = parseStyleRefList(params.get('ostyle'));
  if (required.length === 0 && optional.length === 0 && requiredStyles.length === 0 && optionalStyles.length === 0) {
    return null;
  }

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
    ...(required.length > 0 ? { required_layers: required } : {}),
    ...(optional.length > 0 ? { optional_layers: optional } : {}),
    ...(requiredStyles.length > 0 ? { required_styles: requiredStyles } : {}),
    ...(optionalStyles.length > 0 ? { optional_styles: optionalStyles } : {}),
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

// Shared by buildShorthandFragment (live reflection) and buildShorthandLink
// (cold-start construction, spiccato-mcp): checks whether intent's shape
// fits within what #q= can represent at all, and if so builds the params
// common to both (catalog/req/opt/rstyle/ostyle/bbox/name/goal). Returns
// null when the intent falls outside #q='s scope (DECISIONS.md D6/D7/D20)
// -- callers must fall back to encodeIntentFragment (#m=) in that case:
//   - more than one active catalog (required_styles/optional_styles
//     resolve against this same array, per resolveStyles in catalog.ts --
//     there's no separate "style catalog" to reason about here, so a
//     single active catalog is the only condition either kind of ref needs)
//   - an explicit sharing_policy that isn't #q='s own implicit default
//     ({ url_share: true, intent_share: true }, what parseShorthandFragment
//     always produces) -- D7 calls this out by name as a case #q= can't
//     carry, and silently normalizing a declared url_share:false away on
//     the next open would lose the advisory in render.ts
// Deliberately does NOT check relationships_to_highlight/resolution_policy/
// per-catalog `version` -- current example intents don't exercise the first
// two, and D6/D19 already treat the lack of a per-catalog version pin as an
// accepted simplification of this format (labels round-trip since D19; only
// `version` is still dropped).
function buildShorthandParams(intent: MapIntent): URLSearchParams | null {
  const catalogs = intent.catalog_context.active_catalogs;
  if (catalogs.length !== 1) return null;

  const required = intent.required_layers ?? [];
  const optional = intent.optional_layers ?? [];
  const requiredStyles = intent.required_styles ?? [];
  const optionalStyles = intent.optional_styles ?? [];
  if (required.length === 0 && optional.length === 0 && requiredStyles.length === 0 && optionalStyles.length === 0) {
    return null;
  }

  const policy = intent.sharing_policy;
  if (policy && (policy.url_share !== true || policy.intent_share !== true)) return null;

  const params = new URLSearchParams();
  params.set('catalog', catalogs[0].uri);
  if (catalogs[0].type !== 'layers_txt') params.set('type', catalogs[0].type);
  if (required.length > 0) params.set('req', required.map(buildRefEntry).join(','));
  if (optional.length > 0) params.set('opt', optional.map(buildRefEntry).join(','));
  if (requiredStyles.length > 0) params.set('rstyle', requiredStyles.map(buildStyleRefEntry).join(','));
  if (optionalStyles.length > 0) params.set('ostyle', optionalStyles.map(buildStyleRefEntry).join(','));
  if (intent.area?.bbox) params.set('bbox', intent.area.bbox.join(','));
  if (intent.area?.name) params.set('name', intent.area.name);
  if (intent.goal) params.set('goal', intent.goal);
  return params;
}

// The write side of the live-reflection round-trip: serializes the
// *current* live map state (center/zoom/bearing/pitch, current
// missing/unrenderable) back into "#q=..." wire format, for render.ts's
// updateFragment to use in place of #m= when it can.
export function buildShorthandFragment(
  intent: MapIntent,
  live: { center: [number, number]; zoom: number; bearing: number; pitch: number; missing: string[]; unrenderable: string[] }
): string | null {
  const params = buildShorthandParams(intent);
  if (params === null) return null;

  params.set('lat', String(live.center[1]));
  params.set('lng', String(live.center[0]));
  params.set('zoom', String(live.zoom));
  params.set('bearing', String(live.bearing));
  params.set('pitch', String(live.pitch));
  if (live.missing.length > 0) params.set('missing', live.missing.join(','));
  if (live.unrenderable.length > 0) params.set('unrenderable', live.unrenderable.join(','));

  return `${HASH_PREFIX}${params.toString()}`;
}

// Cold-start counterpart to buildShorthandFragment: builds a "#q=" link for
// an intent with no live map view yet (nobody has panned/zoomed) -- e.g.
// spiccato-mcp's build_spiccato_link tool constructing a first-open link
// (see ../mcp/src/linkBuilder.ts). Honors intent.render_hints if the caller
// already set one (so a Staff-style caller can still pin an initial view),
// but never writes cartographer_feedback -- there's nothing to report yet
// on a link nobody has opened. Returns null under the same conditions as
// buildShorthandFragment (see buildShorthandParams above).
export function buildShorthandLink(intent: MapIntent): string | null {
  const params = buildShorthandParams(intent);
  if (params === null) return null;

  const hints = intent.render_hints;
  if (hints?.center) {
    params.set('lng', String(hints.center[0]));
    params.set('lat', String(hints.center[1]));
    if (hints.zoom !== undefined) params.set('zoom', String(hints.zoom));
    if (hints.bearing !== undefined) params.set('bearing', String(hints.bearing));
    if (hints.pitch !== undefined) params.set('pitch', String(hints.pitch));
  }

  return `${HASH_PREFIX}${params.toString()}`;
}
