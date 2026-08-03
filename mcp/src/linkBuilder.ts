// Builds a ready-to-open https://dwg7.github.io/spiccato/ link from Map
// Intent components, for the build_spiccato_link tool. Reuses spiccato's
// own src/shorthand.ts and src/fragment.ts unmodified (both are
// environment-independent pure functions -- CompressionStream/
// DecompressionStream are standard in Node 18+ and Cloudflare Workers, see
// DECISIONS.md D3's Consequences note), so link construction here can never
// drift from what the browser-side app actually decodes. See DECISIONS.md
// D10 for why this exists: a tool returning a short, correctly-encoded
// string is immune to the chat-transport mojibake failure mode a
// hand-typed, hand-percent-encoded link hit in this project's own history.
import { dump as yamlDump } from 'js-yaml';
import type { LayerRef, MapIntent, RenderHints, StyleRef } from '../../src/types.ts';
import { buildShorthandLink } from '../../src/shorthand.ts';
import { encodeIntentFragment } from '../../src/fragment.ts';

const SPICCATO_BASE_URL = 'https://dwg7.github.io/spiccato/';

export interface BuildLinkParams {
  catalogs: Array<{ id?: string; type?: string; uri: string }>;
  required_layers?: LayerRef[];
  optional_layers?: LayerRef[];
  required_styles?: StyleRef[];
  optional_styles?: StyleRef[];
  area?: { name?: string; bbox?: [number, number, number, number] };
  goal?: string;
  render_hints?: RenderHints;
}

export interface BuildLinkResult {
  url: string;
  // Which wire format was actually used. "q" is always preferred when the
  // intent's shape fits (single catalog, no styles, default sharing_policy
  // -- see buildShorthandLink's own doc comment in shorthand.ts); "m" is the
  // fallback for multi-catalog/required_styles/optional_styles intents,
  // mirroring render.ts's updateFragment (D8).
  format: 'q' | 'm';
}

export async function buildSpiccatoLink(params: BuildLinkParams): Promise<BuildLinkResult> {
  if (params.catalogs.length === 0) {
    throw new Error('catalogs must have at least one entry');
  }
  const hasAnyLayerOrStyle =
    (params.required_layers?.length ?? 0) > 0 ||
    (params.optional_layers?.length ?? 0) > 0 ||
    (params.required_styles?.length ?? 0) > 0 ||
    (params.optional_styles?.length ?? 0) > 0;
  if (!hasAnyLayerOrStyle) {
    throw new Error('at least one of required_layers/optional_layers/required_styles/optional_styles is required');
  }

  const now = new Date().toISOString();
  const intent: MapIntent = {
    spec_version: 'map-intent/v2',
    goal: params.goal ?? '',
    ...(params.area ? { area: params.area } : {}),
    catalog_context: {
      active_catalogs: params.catalogs.map((c, i) => ({
        id: c.id ?? `catalog-${i}`,
        type: c.type ?? 'layers_txt',
        uri: c.uri
      }))
    },
    ...(params.required_layers?.length ? { required_layers: params.required_layers } : {}),
    ...(params.optional_layers?.length ? { optional_layers: params.optional_layers } : {}),
    ...(params.required_styles?.length ? { required_styles: params.required_styles } : {}),
    ...(params.optional_styles?.length ? { optional_styles: params.optional_styles } : {}),
    ...(params.render_hints ? { render_hints: params.render_hints } : {}),
    sharing_policy: { url_share: true, intent_share: true },
    provenance: {
      generated_by: 'spiccato-mcp',
      generated_at: now,
      intent_id: `mcp-${now}`
    }
  };

  const shorthand = buildShorthandLink(intent);
  if (shorthand !== null) {
    return { url: `${SPICCATO_BASE_URL}${shorthand}`, format: 'q' };
  }

  const yaml = yamlDump(intent);
  const encoded = await encodeIntentFragment(yaml);
  return { url: `${SPICCATO_BASE_URL}#m=${encoded}`, format: 'm' };
}
