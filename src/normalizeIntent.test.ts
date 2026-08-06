import { describe, expect, it } from 'vitest';
import { load as yamlLoad } from 'js-yaml';
import { normalizeIntent } from './normalizeIntent.ts';
import { parseMapIntent } from './mapIntent.ts';

const MINIMAL_NO_CEREMONY = `
catalog_context:
  active_catalogs:
    - uri: "https://hfu.github.io/layers-martin/catalog.json"
required_layers:
  - source_id: "lcmfc2"
`;

describe('normalizeIntent', () => {
  it('fills in spec_version, catalog id/type, and provenance when entirely absent', () => {
    const normalized = normalizeIntent(MINIMAL_NO_CEREMONY);
    const doc = yamlLoad(normalized) as Record<string, unknown>;
    expect(doc.spec_version).toBe('map-intent/v2');
    expect(doc.goal).toBe('');
    const catalogs = (doc.catalog_context as { active_catalogs: Array<Record<string, unknown>> }).active_catalogs;
    expect(catalogs[0].id).toBe('catalog-0');
    expect(catalogs[0].type).toBe('layers_txt');
    expect(catalogs[0].uri).toBe('https://hfu.github.io/layers-martin/catalog.json');
    const provenance = doc.provenance as Record<string, unknown>;
    expect(provenance.generated_by).toBe('unknown');
    expect(typeof provenance.generated_at).toBe('string');
    expect(typeof provenance.intent_id).toBe('string');
  });

  it('makes a ceremony-free intent pass parseMapIntent, which rejects the original', () => {
    expect(parseMapIntent(MINIMAL_NO_CEREMONY).ok).toBe(false);
    const result = parseMapIntent(normalizeIntent(MINIMAL_NO_CEREMONY));
    expect(result.ok).toBe(true);
  });

  it('does not overwrite fields the author already provided', () => {
    const withProvenance = `
spec_version: "map-intent/v2"
goal: "既存のgoal"
catalog_context:
  active_catalogs:
    - id: "my-catalog"
      type: "martin"
      uri: "https://example.org/catalog"
required_layers:
  - source_id: "x"
provenance:
  generated_by: "real-staff"
  generated_at: "2026-01-01T00:00:00Z"
  intent_id: "real-id"
`;
    const normalized = normalizeIntent(withProvenance);
    const doc = yamlLoad(normalized) as Record<string, unknown>;
    const provenance = doc.provenance as Record<string, unknown>;
    expect(provenance.generated_by).toBe('real-staff');
    expect(provenance.intent_id).toBe('real-id');
    expect(doc.goal).toBe('既存のgoal');
    const catalogs = (doc.catalog_context as { active_catalogs: Array<Record<string, unknown>> }).active_catalogs;
    expect(catalogs[0].id).toBe('my-catalog');
    expect(catalogs[0].type).toBe('martin');
  });

  it('returns the input unchanged when nothing needs filling in (no unnecessary re-dump)', () => {
    const complete = `
spec_version: "map-intent/v2"
goal: "g"
catalog_context:
  active_catalogs:
    - id: "c"
      type: "layers_txt"
      uri: "https://example.org/catalog"
required_layers:
  - source_id: "x"
provenance:
  generated_by: "staff"
  generated_at: "2026-01-01T00:00:00Z"
  intent_id: "id-1"
`;
    expect(normalizeIntent(complete)).toBe(complete);
  });

  it('returns invalid YAML unchanged, letting parseMapIntent report the real error', () => {
    const broken = 'not: valid: yaml: [';
    const normalized = normalizeIntent(broken);
    expect(normalized).toBe(broken);
    expect(parseMapIntent(normalized).ok).toBe(false);
  });

  it('returns a non-mapping document (e.g. a bare list) unchanged', () => {
    const notAMapping = '- a\n- b\n';
    expect(normalizeIntent(notAMapping)).toBe(notAMapping);
  });

  it('fills provenance even when the field is present but not a mapping', () => {
    const badProvenance = `
catalog_context:
  active_catalogs:
    - uri: "https://example.org/catalog"
required_layers:
  - source_id: "x"
provenance: "not a mapping"
`;
    const doc = yamlLoad(normalizeIntent(badProvenance)) as Record<string, unknown>;
    const provenance = doc.provenance as Record<string, unknown>;
    expect(provenance.generated_by).toBe('unknown');
  });
});
