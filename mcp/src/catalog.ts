// Live catalog access for spiccato-mcp's tools (search_catalog, get_layer_info,
// list_catalogs). Deliberately independent of ../../src/catalog.ts (which
// resolves a whole MapIntent against a set of active_catalogs for rendering)
// -- this module answers a narrower question a Staff-style caller actually
// asks before it has a MapIntent yet: "what source_ids/style_ids exist, and
// what do they mean?" See DECISIONS.md D10.

export interface KnownCatalog {
  id: string;
  uri: string;
  type: 'layers_txt' | 'martin';
  description: string;
}

// The two catalogs this project's Map Intent examples and STAFF_PROMPT.md
// already treat as the well-known pair (DECISIONS.md D6/D8's examples,
// STAFF_PROMPT.md's "別カタログ: stars.optgeo.org" section). Not exhaustive
// -- search_catalog/get_layer_info accept any catalog_uri, this is only the
// convenience default list_catalogs returns.
export const KNOWN_CATALOGS: KnownCatalog[] = [
  {
    id: 'layers-martin',
    uri: 'https://hfu.github.io/layers-martin/catalog.json',
    type: 'layers_txt',
    description: '国土地理院ほかの日本の地理空間データ全般(ハザードマップ・地形分類図・空中写真等)、約1,800件のsource_id。'
  },
  {
    id: 'stars-optgeo',
    uri: 'https://stars.optgeo.org/catalog',
    type: 'martin',
    description: 'bvmap背景地図・全国空中写真・火山土地条件図/火山基本図(vlcm/vbmのrequired_styles)。実運用中のMartinサーバー。'
  }
];

function catalogBaseUrl(uri: string): string {
  return uri.replace(/\/catalog(\.json)?\/?$/, '');
}

export interface CatalogSearchHit {
  kind: 'tile' | 'style';
  id: string;
  name: string;
  path?: string[];
}

interface RawCatalogEntry {
  name?: string;
  path?: string[];
}

interface RawCatalogDocument {
  tiles?: Record<string, RawCatalogEntry>;
  styles?: Record<string, RawCatalogEntry | null>;
}

// Mirrors STAFF_PROMPT.md's own "カタログの引き方" step 1: fetch the
// catalog document, match query against name/path/id substrings. Real
// source_ids/style_ids only -- a caller can never receive a fabricated one
// through this tool, which is the structural fix for the "source_id を
// 捏造しないこと" failure mode STAFF_PROMPT.md documents for cloud LLMs
// operating from memory alone.
export async function searchCatalog(catalogUri: string, query: string, limit = 20): Promise<CatalogSearchHit[]> {
  const res = await fetch(catalogUri);
  if (!res.ok) throw new Error(`catalog fetch failed: ${res.status} ${res.statusText} (${catalogUri})`);
  const data = (await res.json()) as RawCatalogDocument;

  const q = query.toLowerCase();
  const matches = (id: string, entry: RawCatalogEntry | null | undefined): boolean => {
    if (id.toLowerCase().includes(q)) return true;
    if (entry?.name?.toLowerCase().includes(q)) return true;
    if (entry?.path?.some((p) => p.toLowerCase().includes(q))) return true;
    return false;
  };

  const hits: CatalogSearchHit[] = [];
  for (const [id, entry] of Object.entries(data.tiles ?? {})) {
    if (matches(id, entry)) {
      hits.push({ kind: 'tile', id, name: entry?.name ?? id, path: entry?.path });
      if (hits.length >= limit) return hits;
    }
  }
  for (const [id, entry] of Object.entries(data.styles ?? {})) {
    if (matches(id, entry)) {
      hits.push({ kind: 'style', id, name: entry?.name ?? id, path: entry?.path });
      if (hits.length >= limit) return hits;
    }
  }
  return hits;
}

// TileJSON for a single source_id (catalog.ts's fetchTileJson, minus the
// resolved-against-a-MapIntent framing -- this returns the raw document for
// a Staff-style caller to read bounds/legend_pdf_url/etc. directly).
export async function getLayerInfo(catalogUri: string, sourceId: string): Promise<Record<string, unknown> | null> {
  const base = catalogBaseUrl(catalogUri);
  const res = await fetch(`${base}/${sourceId}`);
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown>;
}
