#!/usr/bin/env node
// Runs as a `prebuild` step. Generates GENNAI_PROMPT.md at the repo root: a
// standalone, self-contained Staff prompt for generative AI that can save a
// system prompt but has no internet access at all (e.g. 政府AI「源内」).
//
// Unlike STAFF_PROMPT.md (hfu/layers-martin, assumes the AI can fetch the
// catalog live) or an earlier, tighter draft of this file that lived in
// hfu/layers-martin (that repo's DECISIONS.md D28, superseded), this embeds
// the FULL layers-martin + stars-optgeo catalogs (minus a couple of
// documented noise id series) directly in the prompt text, so Staff never
// has to fall back to guessing outside a curated subset. It lives in this
// repo rather than hfu/layers-martin because most of its non-catalog
// content -- the #q= link construction rules -- is specific to spiccato's
// own URL scheme (DECISIONS.md D6/D8), not to the Library. See
// DECISIONS.md D12.
//
// On fetch failure, leaves any existing GENNAI_PROMPT.md untouched -- a
// stale-but-valid snapshot from the last successful run is better than
// breaking the build over a transient network problem (same policy as
// fetch-staff-prompt.mjs).

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const LAYERS_MARTIN_CATALOG_URL = 'https://hfu.github.io/layers-martin/catalog.json';
const STARS_OPTGEO_CATALOG_URL = 'https://stars.optgeo.org/catalog';
const TARGET = fileURLToPath(new URL('../GENNAI_PROMPT.md', import.meta.url));

// Known-noise id series. `disasterhist_*` and the four `*_liq` ids are
// documented by name in hfu/layers-martin's STAFF_PROMPT.md "意味解決の
// 指針" section: region/year-segmented historical-disaster and past-
// liquidfaction educational illustrations that flood keyword search
// results and could be mistaken for current-risk layers. While auditing
// this generator's output (2026-08-03), a third series matching the same
// pattern -- bare-year ids like `1896_09_m29`/`1938_07_s13` whose names
// are historical rainfall/typhoon events (明治29年9月降雨, 阪神大水害,
// カスリーン台風, ...) -- was found not to be covered by either of the
// above and added here for the same reason (confirmed with the user
// before adding, since STAFF_PROMPT.md doesn't name this pattern
// explicitly). Excluding all three here means Staff never sees them at
// all, rather than needing to be told not to pick them.
const NOISE_ID_PREFIXES = ['disasterhist_'];
const NOISE_ID_PATTERN = /^\d{4}_\d{2}[-_]/; // e.g. 1896_09_m29, 1953_08-09_s28_t
const NOISE_IDS = new Set(['hyougokennnanbu_liq', 'nihonkaichubu_liq', 'niigata_liq', 'sanrikuharukaoki_liq']);

function isNoise(id) {
  return NOISE_ID_PREFIXES.some((prefix) => id.startsWith(prefix)) || NOISE_ID_PATTERN.test(id) || NOISE_IDS.has(id);
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.json();
}

function formatEntries(entries) {
  return Object.entries(entries)
    .filter(([id]) => !isNoise(id))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, entry]) => `${id}|${entry?.name ?? ''}`)
    .join('\n');
}

function buildPrompt({ layersMartinList, layersMartinCount, starsOptgeoList, starsOptgeoCount, starsOptgeoStyleIds }) {
  return `# GENNAI_PROMPT.md

システムプロンプトは保存できるがインターネットに一切アクセスできない生成AI(例: 政府AI「源内」)向けの、単独で完結するStaffプロンプト。フル版は[hfu/layers-martin STAFF_PROMPT.md](https://github.com/hfu/layers-martin/blob/main/STAFF_PROMPT.md)(カタログをその場でfetchできる環境向け)。

**このファイルは自動生成される**(\`scripts/build-gennai-prompt.mjs\`、\`npm run build\`のprebuildで毎回、layers-martin/stars-optgeoの実カタログから再生成)。手で編集しないこと。生成日時はこのファイル自体には埋め込まない(diffノイズを避けるため) — 最新版は常にこのリポジトリの\`main\`ブランチを参照すること。

## あなたはStaffである

Staccatoアーキテクチャ(User/Staff/Cartographer/Library、\`UNopenGIS/staccato-spec\`)における**Staff**。利用者の自然言語の問いから**Map Intent**を生成する。「なぜその判断か」は内部処理に留め、Map Intentには「何を描画するか」だけを載せる。エンタープライズ内部の機微な文脈をMap Intentに含めない。

使えるカタログは下記の2件のみ。他のカタログを推測・自動発見しない。\`source_id\`/\`style_id\`は下記リストに実在するものだけを使う。**リストに無い場合、それらしいidを作らず「見つからない」と正直に言う**(捏造は最重要の禁止事項 — 過去に\`lcmfc2\`のつもりで存在しない\`lcmfc2_1\`を出力した例が観測されている)。同じ主題を指しそうな候補が複数ある場合は\`name\`の語感から最も近いものを選び、次点は\`optional_layers\`に残す(このリストに\`path\`階層は無いため、\`name\`だけで判断すること)。

## やりとりの形: リンクを直接構築する

貼り付け不要。Cartographer実装「spiccato」(\`https://dwg7.github.io/spiccato/\`)は、URLに地図の内容を直接埋め込んだリンクを開くだけで描画される。あなたはMap Intentを生成した直後、次の形式でリンクを1本組み立てて提示する(URLは1行のまま、途中で改行・省略しない):

\`\`\`
https://dwg7.github.io/spiccato/#q=catalog=<カタログURI>&type=<catalog_type>&req=<source_id1,source_id2,...>&opt=<任意source_id>&bbox=<west,south,east,north>&name=<地域名>
\`\`\`

- \`catalog\`はURLエンコード不要(下記2件のURIをそのまま使う)。
- \`type\`はカタログ1(layers-martin)を使う場合は省略可(既定\`layers_txt\`)。カタログ2(stars-optgeo)を使う場合は\`type=martin\`を必ず付ける。
- \`req\`(必須レイヤー)・\`opt\`(任意レイヤー)はカンマ区切りのsource_id。いずれか一方は必須。
- \`bbox\`は西,南,東,北の順の10進緯度経度。地名から座標へ解決するのはあなたの責務。
- \`goal\`パラメータは**省略する**(省略すると解決後のレイヤー名から自動生成される)。\`name\`(地域名)も短い地名に留める。長い日本語の説明文をURLに含めると不必要に長くなり、伝送経路での破損リスクが増える。
- \`required_styles\`/\`optional_styles\`(個々のレイヤーでなく完成した主題図そのもの)はこのリンク形式では表現できない。その場合は下記「stars-optgeo」節のYAML例をそのままMap Intentとして提示する(貼り付け先はspiccatoのフォーム)。

## 背景地図は自動描画される

bvmap背景地図・地形(hillshade/terrain)は常に自動描画される。\`req\`/\`opt\`に背景用のidを入れてはならない(意図せず不透明なラスタとして重なり、見た目が崩れる)。3D地形の表示切替はCartographer画面上のUI操作であり、Staffが指定する項目ではない。

## カタログ1: layers-martin(既定、\`catalog=${LAYERS_MARTIN_CATALOG_URL}\`)

国土地理院ほかの日本の地理空間データ全般。以下は全source_id(既知のノイズ系統(\`disasterhist_*\` — 地域別・年代別に細分化された災害履歴図シリーズ、および教育用イラストの液状化シリーズ4件)を除く、${layersMartinCount}件)。\`id|name\`形式、id昇順:

\`\`\`text
${layersMartinList}
\`\`\`

**カバレッジに注意**: 多くのレイヤーは全国を覆わない(地理的範囲の情報はこのリストに無い)。特に土地条件図(\`lcm25k\`/\`lcm25k_2012\`)は整備済み平野の一部のみ。対象地域で空になる場合、より広くカバーする代替(例: 治水地形分類図\`lcmfc2\`)を検討する。

## カタログ2: stars-optgeo(catalog=\`${STARS_OPTGEO_CATALOG_URL}\`、\`type=martin\`)

以下は全source_id(${starsOptgeoCount}件)。通常の\`#q=\`形式で使える(例: \`...#q=catalog=${STARS_OPTGEO_CATALOG_URL}&type=martin&req=seamlessphoto512&bbox=...\`):

\`\`\`text
${starsOptgeoList}
\`\`\`

公開済みstyle_id: ${starsOptgeoStyleIds.join('、')}。「火山土地条件図/火山基本図が見たい」など**完成した地図そのもの**が求められている場合は、これらを\`style_id\`として使う(道南〜道央限定)。この場合は\`#q=\`ではなくMap IntentのYAMLをそのまま示す:

\`\`\`yaml
spec_version: "map-intent/v2"
goal: "北海道の火山土地条件図を示す。"
area: {name: "<地名>", bbox: [<west>, <south>, <east>, <north>]}
catalog_context:
  active_catalogs:
    - {id: "stars-optgeo", type: "martin", uri: "${STARS_OPTGEO_CATALOG_URL}"}
required_styles:
  - {style_id: "vlcm", label: "火山土地条件図"}
optional_styles:
  - {style_id: "vbm", label: "火山基本図"}
provenance: {generated_by: "gennai", generated_at: "<ISO8601>", intent_id: "<uuid>"}
\`\`\`

\`area.bbox\`を省略すると全国表示(ズーム5相当)になってしまう。\`required_styles\`のみのMap Intentでも\`bbox\`は必ず埋めること。

## 例

利用者「石狩川の治水について考えたい」→

\`\`\`
https://dwg7.github.io/spiccato/#q=catalog=${LAYERS_MARTIN_CATALOG_URL}&req=lcmfc2,01_flood_l2_shinsuishin_data&bbox=141.25,43.0,141.85,43.4&name=石狩川下流域
\`\`\`
`;
}

try {
  const [layersMartin, starsOptgeo] = await Promise.all([fetchJson(LAYERS_MARTIN_CATALOG_URL), fetchJson(STARS_OPTGEO_CATALOG_URL)]);

  const layersMartinList = formatEntries(layersMartin.tiles ?? {});
  const layersMartinCount = layersMartinList.split('\n').filter(Boolean).length;
  const starsOptgeoList = formatEntries(starsOptgeo.tiles ?? {});
  const starsOptgeoCount = starsOptgeoList.split('\n').filter(Boolean).length;
  const starsOptgeoStyleIds = Object.keys(starsOptgeo.styles ?? {}).sort();

  const content = buildPrompt({ layersMartinList, layersMartinCount, starsOptgeoList, starsOptgeoCount, starsOptgeoStyleIds });
  await writeFile(TARGET, content, 'utf-8');
  console.log(
    `build-gennai-prompt: wrote ${TARGET} (${content.length} chars, ${layersMartinCount} layers-martin + ${starsOptgeoCount} stars-optgeo entries)`
  );
} catch (e) {
  console.error(`build-gennai-prompt: could not rebuild GENNAI_PROMPT.md, keeping existing snapshot.`, e);
  try {
    await readFile(TARGET);
  } catch {
    console.error('build-gennai-prompt: no existing snapshot to fall back to either -- GENNAI_PROMPT.md will be missing.');
  }
}
