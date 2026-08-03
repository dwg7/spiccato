// Transport-agnostic MCP server factory, shared by both the local stdio
// entrypoint (src/stdio.ts, npx-installed) and the Cloudflare Workers
// remote entrypoint (../../worker/src/index.ts). Only the transport differs
// between the two -- see DECISIONS.md D10 for why this split exists.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { KNOWN_CATALOGS, getLayerInfo, searchCatalog } from './catalog.ts';
import { buildSpiccatoLink } from './linkBuilder.ts';

const layerRefShape = z.object({
  source_id: z.string(),
  label: z.string().optional()
});

const styleRefShape = z.object({
  style_id: z.string(),
  label: z.string().optional()
});

const catalogRefShape = z.object({
  id: z.string().optional(),
  type: z.enum(['layers_txt', 'martin']).optional(),
  uri: z.string()
});

const areaShape = z.object({
  name: z.string().optional(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional()
});

const renderHintsShape = z.object({
  center: z.tuple([z.number(), z.number()]),
  zoom: z.number().optional(),
  bearing: z.number().optional(),
  pitch: z.number().optional()
});

function textResult(value: unknown) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: 'text' as const, text }] };
}

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

export function createSpiccatoServer(): McpServer {
  const server = new McpServer({
    name: 'spiccato',
    version: '0.1.0',
    description:
      'カタログ検索とspiccato(https://dwg7.github.io/spiccato/)リンク構築を行うツール群。Staff役(UNopenGIS/staccato-spec)を担う生成AIが、Map Intentのsource_id/style_idを実カタログで検証しながら、貼り付け不要のリンクを直接構築するために使う。'
  });

  server.registerTool(
    'list_catalogs',
    {
      title: 'List known catalogs',
      description:
        'よく使う2つのカタログ(layers-martin: 国土地理院ほかの一般的な地理空間データ、stars-optgeo: bvmap背景地図・空中写真・火山土地条件図等のrequired_styles)のURIと概要を返す。他のカタログURIも search_catalog/get_layer_info に直接渡せる(この一覧に限定されない)。'
    },
    async () => textResult(KNOWN_CATALOGS)
  );

  server.registerTool(
    'search_catalog',
    {
      title: 'Search a catalog for real source_id/style_id values',
      description:
        '指定したカタログ(catalog/catalog.json または martin互換の/catalogエンドポイント)を実際に取得し、name/path/idにqueryが部分一致するsource_id(tiles)・style_id(styles)を返す。これ以外の方法でsource_id/style_idを推測・捏造してはならない(STAFF_PROMPT.mdの「source_idを捏造しないこと」参照) -- 見つからない場合は空配列を返すので、その場合は利用者に正直に伝えること。',
      inputSchema: {
        catalog_uri: z.string().describe('カタログのURI。例: https://hfu.github.io/layers-martin/catalog.json'),
        query: z.string().describe('検索語(日本語可)。source_idの部分文字列にもname/pathの部分文字列にもマッチする。'),
        limit: z.number().int().positive().max(100).optional().describe('最大件数(既定20)')
      }
    },
    async ({ catalog_uri, query, limit }) => {
      try {
        const hits = await searchCatalog(catalog_uri, query, limit);
        return textResult(hits);
      } catch (e) {
        return errorResult(e instanceof Error ? e.message : String(e));
      }
    }
  );

  server.registerTool(
    'get_layer_info',
    {
      title: 'Get full TileJSON for a source_id',
      description:
        '指定カタログ・source_idのTileJSON全体(name/bounds/legend_pdf_url/minzoom/maxzoom等)を返す。範囲(bounds)や凡例の有無を確認する際に使う。source_idが存在しない場合はnullを返す。',
      inputSchema: {
        catalog_uri: z.string(),
        source_id: z.string()
      }
    },
    async ({ catalog_uri, source_id }) => {
      const info = await getLayerInfo(catalog_uri, source_id);
      return textResult(info);
    }
  );

  server.registerTool(
    'build_spiccato_link',
    {
      title: 'Build a spiccato map link',
      description:
        'カタログ・source_id/style_id・範囲・目的文からspiccatoの完成済みリンク(https://dwg7.github.io/spiccato/#q=... または #m=...)を構築して返す。単一カタログでrequired_styles/optional_stylesを使わない場合は短い#q=形式を、複数カタログやスタイル参照を使う場合は圧縮された#m=形式を自動選択する(spiccato側のupdateFragmentと同じロジック)。返るURLはそのままユーザーに提示してよい -- 手で組み立てたり、日本語の長いgoalをやり取りに含めたりしないこと(伝送経路での文字化けの原因になる、DECISIONS.md D8/D9のfeedback参照)。',
      inputSchema: {
        catalogs: z.array(catalogRefShape).min(1).describe('通常は1件。search_catalogで使ったcatalog_uriと同じものを指定する。'),
        required_layers: z.array(layerRefShape).optional(),
        optional_layers: z.array(layerRefShape).optional(),
        required_styles: z.array(styleRefShape).optional(),
        optional_styles: z.array(styleRefShape).optional(),
        area: areaShape.optional().describe('area.nameは短い地名を推奨(長い説明文はリンクを不要に長くする)'),
        goal: z.string().optional().describe('省略推奨。省略した場合、spiccato側で解決済みレイヤー名から自動生成される。'),
        render_hints: renderHintsShape.optional().describe('初期表示位置を明示したい場合のみ指定。省略時はarea.bboxまたはレイヤーのboundsから自動計算される。')
      }
    },
    async (params) => {
      try {
        const result = await buildSpiccatoLink(params);
        return textResult(result);
      } catch (e) {
        return errorResult(e instanceof Error ? e.message : String(e));
      }
    }
  );

  return server;
}
