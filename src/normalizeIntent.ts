import { load as yamlLoad, dump as yamlDump } from 'js-yaml';

// Fills in the "ceremonial" fields parseMapIntent (mapIntent.ts, vendored
// verbatim from hfu/faceless-cartographer, D1) requires for schema
// validity but that nothing downstream ever reads: spec_version,
// catalog_context.active_catalogs[*].id/type, and provenance.*. Real-world
// testing (both by hand and by AI Staff agents, including GENNAI_PROMPT.md
// users) kept hitting validation errors on exactly these fields rather
// than on anything that actually affects rendering -- see DECISIONS.md
// D14.
//
// Deliberately does NOT touch mapIntent.ts itself. This is Postel's Law
// applied to Cartographer alone, not a schema change: UNopenGIS/
// staccato-spec's Map Intent schema is unchanged, and Staff remains free
// to write these fields -- spiccato just stops requiring it to. Runs
// *before* parseMapIntent, producing normalized YAML text that already
// satisfies its checks whenever the fields that actually matter (a
// catalog uri, and at least one required_layers/required_styles entry)
// are present. On anything this function isn't confident about (invalid
// YAML, a non-mapping document), it returns the input unchanged and lets
// parseMapIntent produce its own, more specific error -- normalization
// only ever adds fields, never removes or reinterprets existing ones.
const DEFAULT_SPEC_VERSION = 'map-intent/v2';
const DEFAULT_CATALOG_TYPE = 'layers_txt';

function isMapping(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

export function normalizeIntent(yamlText: string): string {
  let doc: unknown;
  try {
    doc = yamlLoad(yamlText);
  } catch {
    return yamlText;
  }
  if (!isMapping(doc)) return yamlText;

  let changed = false;

  // Sentinel main.ts's renderIntent() already looks for -- see its own
  // "an empty goal ... gets a readable summary synthesized" comment -- so
  // a missing goal reuses that existing auto-synthesis path rather than
  // needing one of its own here.
  if (typeof doc.spec_version !== 'string') {
    doc.spec_version = DEFAULT_SPEC_VERSION;
    changed = true;
  }
  if (typeof doc.goal !== 'string') {
    doc.goal = '';
    changed = true;
  }

  if (isMapping(doc.catalog_context) && Array.isArray(doc.catalog_context.active_catalogs)) {
    doc.catalog_context.active_catalogs.forEach((entry: unknown, i: number) => {
      if (!isMapping(entry)) return;
      if (!isNonEmptyString(entry.id)) {
        entry.id = `catalog-${i}`;
        changed = true;
      }
      if (!isNonEmptyString(entry.type)) {
        entry.type = DEFAULT_CATALOG_TYPE;
        changed = true;
      }
    });
  }

  if (!isMapping(doc.provenance)) {
    doc.provenance = {};
    changed = true;
  }
  const provenance = doc.provenance as Record<string, unknown>;
  const now = new Date().toISOString();
  if (!isNonEmptyString(provenance.generated_by)) {
    provenance.generated_by = 'unknown';
    changed = true;
  }
  if (!isNonEmptyString(provenance.generated_at)) {
    provenance.generated_at = now;
    changed = true;
  }
  if (!isNonEmptyString(provenance.intent_id)) {
    provenance.intent_id = `normalized-${now}`;
    changed = true;
  }

  return changed ? yamlDump(doc) : yamlText;
}
