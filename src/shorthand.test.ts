import { describe, expect, it } from 'vitest';
import { buildShorthandFragment, parseShorthandFragment } from './shorthand.ts';
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

  it('accepts optional-only (no req)', () => {
    const intent = parseShorthandFragment('#q=catalog=https://example.org/catalog.json&opt=x');
    expect(intent).not.toBeNull();
    expect(intent!.required_layers).toBeUndefined();
    expect(intent!.optional_layers).toEqual([{ source_id: 'x' }]);
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
    expect(roundTripped!.required_layers).toEqual([{ source_id: 'lcmfc2' }]); // label is dropped, D6's accepted lossiness
    expect(roundTripped!.render_hints).toEqual({ center: [130.6, 32.5], zoom: 11, bearing: 45, pitch: 30 });
    expect(roundTripped!.goal).toBe('テスト');
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

  it('returns null when required_styles/optional_styles are present (no wire representation)', () => {
    const intent: MapIntent = { ...baseIntent, required_styles: [{ style_id: 'vlcm' }] };
    expect(buildShorthandFragment(intent, live)).toBeNull();
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
