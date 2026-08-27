import { describe, expect, it } from 'vitest';
import { buildShorthandFragment, buildShorthandLink, parseShorthandFragment } from './shorthand.ts';
import type { MapIntent } from './types.ts';

describe('parseShorthandFragment', () => {
  it('parses a minimal required-only intent', () => {
    const intent = parseShorthandFragment('#q=catalog=https://hfu.github.io/layers-martin/catalog.json&req=lcmfc2');
    expect(intent).not.toBeNull();
    expect(intent!.catalog_context.active_catalogs[0]).toEqual({
      id: 'catalog',
      type: 'layers_txt',
      uri: 'https://hfu.github.io/layers-martin/catalog.json'
    });
    expect(intent!.required_layers).toEqual([{ source_id: 'lcmfc2' }]);
    expect(intent!.optional_layers).toBeUndefined();
    expect(intent!.goal).toBe('');
  });

  it('parses required, optional, bbox, name, goal, and a custom catalog type together', () => {
    const hash =
      '#q=catalog=https://stars.optgeo.org/catalog&type=martin&req=a,b&opt=c&bbox=130.45,32.35,130.75,32.65&name=' +
      encodeURIComponent('八代市周辺') +
      '&goal=' +
      encodeURIComponent('テスト用の goal');
    const intent = parseShorthandFragment(hash);
    expect(intent).not.toBeNull();
    expect(intent!.catalog_context.active_catalogs[0].type).toBe('martin');
    expect(intent!.required_layers).toEqual([{ source_id: 'a' }, { source_id: 'b' }]);
    expect(intent!.optional_layers).toEqual([{ source_id: 'c' }]);
    expect(intent!.area).toEqual({ name: '八代市周辺', bbox: [130.45, 32.35, 130.75, 32.65] });
    expect(intent!.goal).toBe('テスト用の goal');
  });

  // DECISIONS.md D19: req/opt entries may carry a label after "|".
  it('parses source_id|label entries, mixed with bare source_ids, in req and opt', () => {
    const hash =
      '#q=catalog=https://example.org/catalog.json&req=' +
      encodeURIComponent('a|Aラベル') +
      ',b&opt=' +
      encodeURIComponent('c|Cラベル');
    const intent = parseShorthandFragment(hash);
    expect(intent!.required_layers).toEqual([{ source_id: 'a', label: 'Aラベル' }, { source_id: 'b' }]);
    expect(intent!.optional_layers).toEqual([{ source_id: 'c', label: 'Cラベル' }]);
  });

  it('decodes a comma inside a label that survived on the wire as double-encoded ("%252C")', () => {
    // location.hash gives parseShorthandFragment the fragment exactly as it
    // appears in the URL bar (browsers don't auto-decode it); the first
    // decode happens right here, inside `new URLSearchParams(body)`. So a
    // label's literal comma has to reach this function as "%252C" (what
    // encodeRef + URLSearchParams.toString() actually produce together, see
    // the buildShorthandFragment "round-trips a label containing a literal
    // comma" test below) -- one decode strips it to "%2C" (still inert,
    // doesn't match the split-on-"," below), the second (parseRefEntry's
    // decodeURIComponent) recovers the real ",".
    const intent = parseShorthandFragment('#q=catalog=https://example.org/catalog.json&req=a|A%252CB,b');
    expect(intent!.required_layers).toEqual([{ source_id: 'a', label: 'A,B' }, { source_id: 'b' }]);
  });

  it('documents the limitation: a hand-typed label with only a single level of "%2C" (or a bare ",") still splits', () => {
    // This is exactly why GENNAI_PROMPT.md/STAFF_PROMPT.md tell Staff to
    // avoid literal commas in labels rather than expecting them to reason
    // about double percent-encoding by hand.
    const bare = parseShorthandFragment('#q=catalog=https://example.org/catalog.json&req=a|A,B,b');
    expect(bare!.required_layers).toEqual([{ source_id: 'a', label: 'A' }, { source_id: 'B' }, { source_id: 'b' }]);
    const singleEncoded = parseShorthandFragment('#q=catalog=https://example.org/catalog.json&req=a|A%2CB,b');
    expect(singleEncoded!.required_layers).toEqual([{ source_id: 'a', label: 'A' }, { source_id: 'B' }, { source_id: 'b' }]);
  });

  it('falls back to the raw label text when it is not validly percent-encoded (lone "%")', () => {
    const intent = parseShorthandFragment('#q=catalog=https://example.org/catalog.json&req=a|50%25off');
    // decodeURIComponent('50%25off') succeeds and yields '50%off' here since
    // %25 is itself a valid escape (literal "%"); this case exercises the
    // malformed-escape fallback with a truly invalid sequence instead.
    expect(intent!.required_layers).toEqual([{ source_id: 'a', label: '50%off' }]);
    const malformed = parseShorthandFragment('#q=catalog=https://example.org/catalog.json&req=a|50%zzoff');
    expect(malformed!.required_layers).toEqual([{ source_id: 'a', label: '50%zzoff' }]);
  });

  it('accepts optional-only (no req)', () => {
    const intent = parseShorthandFragment('#q=catalog=https://example.org/catalog.json&opt=x');
    expect(intent).not.toBeNull();
    expect(intent!.required_layers).toBeUndefined();
    expect(intent!.optional_layers).toEqual([{ source_id: 'x' }]);
  });

  // DECISIONS.md D20: rstyle/ostyle mirror req/opt but resolve to
  // required_styles/optional_styles (StyleRef, keyed on style_id).
  it('parses rstyle/ostyle, including style_id|label entries, mixed together with req/opt', () => {
    const hash =
      '#q=catalog=https://stars.optgeo.org/catalog&type=martin&req=seamlessphoto512&rstyle=' +
      encodeURIComponent('vlcm|火山土地条件図') +
      '&ostyle=vbm';
    const intent = parseShorthandFragment(hash);
    expect(intent).not.toBeNull();
    expect(intent!.required_layers).toEqual([{ source_id: 'seamlessphoto512' }]);
    expect(intent!.required_styles).toEqual([{ style_id: 'vlcm', label: '火山土地条件図' }]);
    expect(intent!.optional_styles).toEqual([{ style_id: 'vbm' }]);
  });

  it('accepts a styles-only intent with no req/opt at all', () => {
    const intent = parseShorthandFragment('#q=catalog=https://stars.optgeo.org/catalog&type=martin&rstyle=vlcm');
    expect(intent).not.toBeNull();
    expect(intent!.required_layers).toBeUndefined();
    expect(intent!.optional_layers).toBeUndefined();
    expect(intent!.required_styles).toEqual([{ style_id: 'vlcm' }]);
  });

  it('returns null when req/opt/rstyle/ostyle are all absent', () => {
    expect(parseShorthandFragment('#q=catalog=https://example.org/catalog.json')).toBeNull();
    expect(parseShorthandFragment('#q=catalog=https://example.org/catalog.json&req=&opt=&rstyle=&ostyle=')).toBeNull();
  });

  // DECISIONS.md D22: basemap is a single StyleRef (not comma-separated like
  // rstyle/ostyle), same "style_id|label" entry syntax.
  it('parses basemap with a label, alongside req', () => {
    const hash =
      '#q=catalog=https://stars.optgeo.org/catalog&type=martin&req=seamlessphoto512&basemap=' +
      encodeURIComponent('openstreetmap_jp_planet|OSM');
    const intent = parseShorthandFragment(hash);
    expect(intent!.basemap).toEqual({ style_id: 'openstreetmap_jp_planet', label: 'OSM' });
    expect(intent!.required_layers).toEqual([{ source_id: 'seamlessphoto512' }]);
  });

  it('parses a bare basemap (no label)', () => {
    const intent = parseShorthandFragment(
      '#q=catalog=https://stars.optgeo.org/catalog&type=martin&req=seamlessphoto512&basemap=openstreetmap_jp_planet'
    );
    expect(intent!.basemap).toEqual({ style_id: 'openstreetmap_jp_planet' });
  });

  it('omits basemap when absent, and does not let basemap alone satisfy the req/opt/rstyle/ostyle guard', () => {
    const withoutBasemap = parseShorthandFragment('#q=catalog=https://example.org/catalog.json&req=a');
    expect(withoutBasemap!.basemap).toBeUndefined();
    expect(parseShorthandFragment('#q=catalog=https://example.org/catalog.json&basemap=openstreetmap_jp_planet')).toBeNull();
  });

  it('tolerates an unencoded catalog URI (no reserved query characters)', () => {
    const intent = parseShorthandFragment('#q=catalog=https://hfu.github.io/layers-martin/catalog.json&req=lcmfc2');
    expect(intent!.catalog_context.active_catalogs[0].uri).toBe('https://hfu.github.io/layers-martin/catalog.json');
  });

  it('returns null for the wrong prefix', () => {
    expect(parseShorthandFragment('#m=zAAAA')).toBeNull();
    expect(parseShorthandFragment('#intent=AAAA')).toBeNull();
    expect(parseShorthandFragment('')).toBeNull();
  });

  it('returns null when catalog is missing', () => {
    expect(parseShorthandFragment('#q=req=a,b')).toBeNull();
  });

  it('returns null when neither req nor opt has any ids', () => {
    expect(parseShorthandFragment('#q=catalog=https://example.org/catalog.json')).toBeNull();
    expect(parseShorthandFragment('#q=catalog=https://example.org/catalog.json&req=&opt=')).toBeNull();
  });

  it('returns null for a malformed bbox by dropping it rather than failing outright', () => {
    const intent = parseShorthandFragment('#q=catalog=https://example.org/catalog.json&req=a&bbox=not,a,bbox');
    expect(intent).not.toBeNull();
    expect(intent!.area).toBeUndefined();
  });

  // DECISIONS.md D7: render_hints as literal lat/lng/zoom/bearing/pitch.
  it('parses lat/lng/zoom/bearing/pitch into render_hints', () => {
    const intent = parseShorthandFragment(
      '#q=catalog=https://example.org/catalog.json&req=a&lat=32.5&lng=130.6&zoom=11&bearing=45&pitch=30'
    );
    expect(intent!.render_hints).toEqual({ center: [130.6, 32.5], zoom: 11, bearing: 45, pitch: 30 });
  });

  it('ignores zoom/bearing/pitch when lat or lng is missing (no center to hang them on)', () => {
    const intent = parseShorthandFragment('#q=catalog=https://example.org/catalog.json&req=a&zoom=11');
    expect(intent!.render_hints).toBeUndefined();
  });

  it('parses missing/unrenderable into cartographer_feedback', () => {
    const intent = parseShorthandFragment(
      '#q=catalog=https://example.org/catalog.json&req=a&missing=x,y&unrenderable=z'
    );
    expect(intent!.cartographer_feedback).toEqual({ missing_layers: ['x', 'y'], unrenderable_layers: ['z'] });
  });

  it('omits cartographer_feedback entirely when neither missing nor unrenderable is present', () => {
    const intent = parseShorthandFragment('#q=catalog=https://example.org/catalog.json&req=a');
    expect(intent!.cartographer_feedback).toBeUndefined();
  });
});

describe('buildShorthandFragment', () => {
  const baseIntent: MapIntent = {
    spec_version: 'map-intent/v2',
    goal: 'テスト',
    catalog_context: {
      active_catalogs: [{ id: 'catalog', type: 'layers_txt', uri: 'https://hfu.github.io/layers-martin/catalog.json' }]
    },
    required_layers: [{ source_id: 'lcmfc2', label: '治水地形分類図' }],
    sharing_policy: { url_share: true, intent_share: true },
    provenance: { generated_by: 'test', generated_at: '2026-08-03T00:00:00Z', intent_id: 'test' }
  };
  const live = { center: [130.6, 32.5] as [number, number], zoom: 11, bearing: 45, pitch: 30, missing: [], unrenderable: [] };

  it('serializes a fitting intent back into #q= wire format, round-tripping through parseShorthandFragment', () => {
    const frag = buildShorthandFragment(baseIntent, live);
    expect(frag).not.toBeNull();
    expect(frag!.startsWith('#q=')).toBe(true);

    const roundTripped = parseShorthandFragment(frag!);
    expect(roundTripped!.catalog_context.active_catalogs[0].uri).toBe(baseIntent.catalog_context.active_catalogs[0].uri);
    // D19: labels now round-trip (previously dropped, D6's original accepted lossiness).
    expect(roundTripped!.required_layers).toEqual([{ source_id: 'lcmfc2', label: '治水地形分類図' }]);
    expect(roundTripped!.render_hints).toEqual({ center: [130.6, 32.5], zoom: 11, bearing: 45, pitch: 30 });
    expect(roundTripped!.goal).toBe('テスト');
  });

  it('round-trips a label containing a literal comma without corrupting adjacent req entries', () => {
    const intent: MapIntent = {
      ...baseIntent,
      required_layers: [
        { source_id: 'lcmfc2', label: '治水地形分類図, 詳細版' },
        { source_id: '01_flood_l2_shinsuishin_data' }
      ]
    };
    const frag = buildShorthandFragment(intent, live);
    const roundTripped = parseShorthandFragment(frag!);
    expect(roundTripped!.required_layers).toEqual([
      { source_id: 'lcmfc2', label: '治水地形分類図, 詳細版' },
      { source_id: '01_flood_l2_shinsuishin_data' }
    ]);
  });

  it('includes missing/unrenderable when present', () => {
    const frag = buildShorthandFragment(baseIntent, { ...live, missing: ['a'], unrenderable: ['b', 'c'] });
    const roundTripped = parseShorthandFragment(frag!);
    expect(roundTripped!.cartographer_feedback).toEqual({ missing_layers: ['a'], unrenderable_layers: ['b', 'c'] });
  });

  it('returns null for more than one active catalog (falls back to #m=)', () => {
    const intent: MapIntent = {
      ...baseIntent,
      catalog_context: { active_catalogs: [...baseIntent.catalog_context.active_catalogs, { id: 'b', type: 'martin', uri: 'https://example.org/b' }] }
    };
    expect(buildShorthandFragment(intent, live)).toBeNull();
  });

  // DECISIONS.md D20: required_styles/optional_styles now round-trip via
  // rstyle/ostyle, same single-catalog condition as req/opt.
  it('serializes required_styles/optional_styles via rstyle/ostyle, round-tripping alongside required_layers', () => {
    const intent: MapIntent = {
      ...baseIntent,
      required_styles: [{ style_id: 'vlcm', label: '火山土地条件図' }],
      optional_styles: [{ style_id: 'vbm' }]
    };
    const frag = buildShorthandFragment(intent, live);
    expect(frag).not.toBeNull();
    const roundTripped = parseShorthandFragment(frag!);
    expect(roundTripped!.required_layers).toEqual([{ source_id: 'lcmfc2', label: '治水地形分類図' }]);
    expect(roundTripped!.required_styles).toEqual([{ style_id: 'vlcm', label: '火山土地条件図' }]);
    expect(roundTripped!.optional_styles).toEqual([{ style_id: 'vbm' }]);
  });

  it('serializes a styles-only intent (no required_layers/optional_layers at all)', () => {
    const intent: MapIntent = { ...baseIntent, required_layers: undefined, required_styles: [{ style_id: 'vlcm' }] };
    const frag = buildShorthandFragment(intent, live);
    expect(frag).not.toBeNull();
    const roundTripped = parseShorthandFragment(frag!);
    expect(roundTripped!.required_layers).toBeUndefined();
    expect(roundTripped!.required_styles).toEqual([{ style_id: 'vlcm' }]);
  });

  // DECISIONS.md D22: basemap round-trips via a single basemap= entry,
  // alongside required_layers and required_styles/optional_styles.
  it('serializes basemap via basemap=, round-tripping alongside required_layers and required_styles', () => {
    const intent: MapIntent = {
      ...baseIntent,
      required_styles: [{ style_id: 'vlcm' }],
      basemap: { style_id: 'openstreetmap_jp_planet', label: 'OSM' }
    };
    const frag = buildShorthandFragment(intent, live);
    expect(frag).not.toBeNull();
    const roundTripped = parseShorthandFragment(frag!);
    expect(roundTripped!.basemap).toEqual({ style_id: 'openstreetmap_jp_planet', label: 'OSM' });
    expect(roundTripped!.required_layers).toEqual([{ source_id: 'lcmfc2', label: '治水地形分類図' }]);
    expect(roundTripped!.required_styles).toEqual([{ style_id: 'vlcm' }]);
  });

  it('omits basemap= entirely when the intent has no basemap', () => {
    const frag = buildShorthandFragment(baseIntent, live);
    expect(frag).not.toContain('basemap=');
  });

  it('returns null for an explicit sharing_policy override (D7: cited as a remaining #m=-only gap)', () => {
    const intent: MapIntent = { ...baseIntent, sharing_policy: { url_share: false, intent_share: true } };
    expect(buildShorthandFragment(intent, live)).toBeNull();
  });

  it('returns null when neither required_layers nor optional_layers is present', () => {
    const intent: MapIntent = { ...baseIntent, required_layers: undefined };
    expect(buildShorthandFragment(intent, live)).toBeNull();
  });
});

describe('buildShorthandLink', () => {
  const baseIntent: MapIntent = {
    spec_version: 'map-intent/v2',
    goal: 'テスト',
    catalog_context: {
      active_catalogs: [{ id: 'catalog', type: 'layers_txt', uri: 'https://hfu.github.io/layers-martin/catalog.json' }]
    },
    required_layers: [{ source_id: 'lcmfc2' }],
    sharing_policy: { url_share: true, intent_share: true },
    provenance: { generated_by: 'test', generated_at: '2026-08-03T00:00:00Z', intent_id: 'test' }
  };

  it('builds a #q= link with no view params when render_hints is absent (cold start, spiccato-mcp use case)', () => {
    const link = buildShorthandLink(baseIntent);
    expect(link).not.toBeNull();
    expect(link!.startsWith('#q=')).toBe(true);
    const roundTripped = parseShorthandFragment(link!);
    expect(roundTripped!.required_layers).toEqual([{ source_id: 'lcmfc2' }]);
    expect(roundTripped!.render_hints).toBeUndefined();
    expect(roundTripped!.cartographer_feedback).toBeUndefined();
  });

  it('honors intent.render_hints when the caller already pinned an initial view', () => {
    const intent: MapIntent = { ...baseIntent, render_hints: { center: [130.6, 32.5], zoom: 11 } };
    const link = buildShorthandLink(intent);
    const roundTripped = parseShorthandFragment(link!);
    expect(roundTripped!.render_hints).toEqual({ center: [130.6, 32.5], zoom: 11 });
  });

  it('builds an rstyle= link for required_styles (D20), unlike the multi-catalog/sharing_policy cases which still fall back to #m=', () => {
    const link = buildShorthandLink({ ...baseIntent, required_styles: [{ style_id: 'vlcm', label: '火山土地条件図' }] });
    expect(link).not.toBeNull();
    const roundTripped = parseShorthandFragment(link!);
    expect(roundTripped!.required_styles).toEqual([{ style_id: 'vlcm', label: '火山土地条件図' }]);
  });

  it('builds a basemap= link (D22), e.g. spiccato-mcp constructing a link for an area outside bvmap coverage', () => {
    const link = buildShorthandLink({ ...baseIntent, basemap: { style_id: 'openstreetmap_jp_planet', label: 'OSM' } });
    expect(link).not.toBeNull();
    const roundTripped = parseShorthandFragment(link!);
    expect(roundTripped!.basemap).toEqual({ style_id: 'openstreetmap_jp_planet', label: 'OSM' });
    expect(roundTripped!.required_layers).toEqual([{ source_id: 'lcmfc2' }]);
  });

  it('returns null under the remaining fitness conditions (multi-catalog, explicit sharing_policy override)', () => {
    expect(
      buildShorthandLink({
        ...baseIntent,
        catalog_context: { active_catalogs: [...baseIntent.catalog_context.active_catalogs, { id: 'b', type: 'martin', uri: 'https://example.org/b' }] }
      })
    ).toBeNull();
    expect(buildShorthandLink({ ...baseIntent, sharing_policy: { url_share: false, intent_share: true } })).toBeNull();
  });
});
