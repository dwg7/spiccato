import { describe, expect, it } from 'vitest';
import { parseShorthandFragment } from './shorthand.ts';

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
});
