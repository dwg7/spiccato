# HANDOVER.md

セッションを引き継ぐ人(未来の自分、または別のClaude Codeセッション)向けの状態記録。設計判断の理由は[DECISIONS.md](DECISIONS.md)が正だが、ここでは「今どこまで進んでいて、次に何をすべきか」を先に把握できるようにする。

## これは何か

`dwg7/spiccato` — `hfu/faceless-cartographer`(staccatoアーキテクチャの第二世代Cartographer)の第三世代実装。Map Intent(YAML)をURLフラグメントに直接埋め込み、リンクを開くだけで地図が描画される「link-native」なCartographer。中核パイプライン(Map Intent解析・カタログ解決・MapLibreスタイル構築)は`hfu/faceless-cartographer`からvendoring、URL状態の扱いは全面的に書き直し([DECISIONS.md](DECISIONS.md) D1・D2)。

**現在地**: https://dwg7.github.io/spiccato/ で公開中、動作確認済み。

## 現在の状態(2026-08-03時点、MCPスタイル(stdio・Workers版)実装後)

**進行中の大きめの取り組み**: Staffを使う「スタイル」をノーマル(コピペ)以外に増やす作業に着手した(源内スタイル・MCPスタイル・オープンウェブスタイル)。計画の全体像は`/Users/hfu/.claude/plans/scalable-snacking-spring.md`(このセッション間で消えない可能性が高いパス、消えていたら[DECISIONS.md](DECISIONS.md) D10の記述から復元できる)。**実装順序はstdio → Workers → 源内 → (完成後に)オープンウェブの分解を深める**、と明確化済み。MCPスタイル(stdio・Workers、D10)・源内スタイル(`GENNAI_PROMPT.md`、D12、**このリポジトリ自身に置く形に確定**)は実装完了。次はオープンウェブスタイルの分解の深掘り。

### 実装済み・動作確認済み

- 中核パイプライン(`src/types.ts`/`mapIntent.ts`/`catalog.ts`/`style.ts`/`base-style.json`)はfaceless-cartographer(commit `a016206`)からvendoring、無改修
- URLフラグメント、2形式:
  - `#m=` — 圧縮(`CompressionStream` deflate-raw)+ base64url。フル機能(複数catalog、`required_styles`、`render_hints`等)。コード実行環境が無いと構築できない(D3)。実際に必要なのは複数カタログ・`required_styles`/`optional_styles`・`sharing_policy`明示的上書きを使うケースのみに縮小した(D8)
  - `#q=` — 無圧縮のquery string(`catalog=...&req=...&opt=...&bbox=...&goal=...`、D6)。**D8で拡張**: `lat=...&lng=...&zoom=...&bearing=...&pitch=...`(render_hints相当)と`missing=...&unrenderable=...`(cartographer_feedback相当)も、バイト単位の変換不要な数値・ID列挙のまま追加した
- ライブ状態反映(`src/render.ts`の`updateFragment`): **D8で変更** — まず`#q=`(`buildShorthandFragment`)を試し、intentの形が収まる場合(単一カタログ・スタイル無し・`sharing_policy`が既定値)は同期的に`#q=`のまま書き戻す。収まらない場合のみ従来通り`#m=`(`encodeIntentFragment`、非同期)にフォールバックする。**開き方に関わらず**形が収まれば`#q=`を維持する(貼り付け/`#m=`経由で開いたintentでも、単一カタログ・スタイル無しなら`#q=`のまま反映される)。実機検証(本番相当ビルド)で、熊本地震の例(単一カタログ)は`#q=`のまま、火山土地条件図の例(`required_styles`使用)は従来通り`#m=`にフォールバックすることを確認済み
- 実機検証: 熊本地震オルソ画像・全国津波浸水想定・御嶽山噴火(2014)衛星SAR画像のいずれも、リアルタイムでStaff役を演じてカタログ照会→Map Intent構築→リンク生成→本番サイトでの描画確認まで完了
- GitHub Pages公開済み、`.github/workflows/build-docs.yml`でmainへのpush時に自動ビルド・デプロイ
- **MCPスタイル(D10、2026-08-03実装)**: `mcp/`(ローカルstdio版)・`worker/`(Cloudflare Workers版、Streamable HTTP・ステートレス)の2トランスポート。共通ロジック(`mcp/src/server.ts`/`catalog.ts`/`linkBuilder.ts`)は完全共有、`src/shorthand.ts`に`buildShorthandLink`(ライブビュー不要な#q=構築、`render.ts`用の`buildShorthandFragment`とロジック共有)を新設して再利用。4ツール(`list_catalogs`/`search_catalog`/`get_layer_info`/`build_spiccato_link`)。stdioは子プロセス越しの生JSON-RPCで、Workersは`wrangler dev`+`curl`で、それぞれ`initialize`→`tools/call`の実通信を確認済み。生成された`#q=`/`#m=`両方のリンクを本番相当ビルドで開いて描画確認済み(欠落レイヤー無し、コンソールエラー無し)

### 直近で直したバグ(重要、再発に注意)

**背景地図(bvmapグレースケール)・Mapterhorn地形が描画されない問題**、2段階で解決した([DECISIONS.md](DECISIONS.md) D5):

1. `maplibre-gl` 6.xはベクトルタイル解析・raster-dem(地形)デコードをWeb Workerに委譲する。`maplibre-gl-worker.mjs`は`vite-plugin-singlefile`のインライン化対象にならず、`docs/`に存在しなかった(404) → `public/maplibre-gl-worker.mjs`として配置して解決
2. **これだけでは不十分だった**。`maplibre-gl-worker.mjs`自身が`maplibre-gl-shared.mjs`(約470KB、メインバンドルとワーカーの共有コード)を`import`しており、これも`public/`に無いとワーカー初期化自体が失敗する(Vite×MapLibre 6のコミュニティ既知の落とし穴)。`public/maplibre-gl-shared.mjs`も配置して完全に解決した

**教訓**: 依存パッケージの大きなバージョンアップ(今回はmaplibre-gl 5→6)の後は、ビルド成果物(`docs/`)に実行時参照される全ファイルが揃っているか確認する。特に「動的に構築されるURL経由で読み込まれる補助ファイル」(Worker、WASM等)はViteのバンドル対象外になりがちで見落としやすい。将来`maplibre-gl`を更新する際は、`node_modules/maplibre-gl/dist/`から`maplibre-gl-worker.mjs`・`maplibre-gl-shared.mjs`(それぞれ`.map`含む)を再コピーする必要がある。

**検証方法の教訓**: このセッションで使った自動化ブラウザツールは、タブが`document.hidden: true`として扱われ`requestAnimationFrame`がほぼ発火しないという別の制約があり、スクリーンショットによる目視確認だけでは「まだ直っていない」のか「ツールの制約で見えないだけ」なのか切り分けられなかった。**次回この種の問題を調査する際は、目視確認より先に`map.isSourceLoaded('<source-id>')`をコンソールから直接呼ぶ方法を使うこと** — レンダーループの制約を受けにくく、ブール値で即座に確認できる。

### 未着手・フォローアップ

1. **オープンウェブスタイルの深掘り(次のステップ)** — 源内完成につき着手可能。「決定的検索(`mcp/src/catalog.ts`のブラウザ移植)+極小LLMでの意図解釈(検索キーワード抽出のみ)+決定的ジオコーディング+人間が候補を選ぶUI」という分解の設計メモは計画ファイルに記録済み。まだプロトタイプ段階にすら入っていない
2. **`#m=`の非推奨化(obsolete化)** — D7の条件1(`#q=`のrender_hints/cartographer_feedback拡張)はD8で実装済み。残りの条件(実用上十分な期間の安定稼働確認 → STAFF_PROMPT案内の更新 → 実際のコード削除の判断)はまだ。急ぐ必要は無い(D7参照)
3. **`hfu/layers-martin`のSTAFF_PROMPT.md更新提案** — 適用していない(別リポジトリのため提案のみ)。提案文は下記の場所に保存している(セッション間で引き継がれない一時ディレクトリのため、消えていたら再作成が必要):
   `/private/tmp/claude-501/-Users-hfu-faceless-cartographer/a4d543ce-4068-4052-92eb-b85d46f8d7bd/scratchpad/staff_prompt_spiccato_proposal.md`
   要旨: 「正しいやりとりの形」第3項・第5項の差し替え案、`#q=`(推奨)→`#m=`(高機能時)→貼り付け(最終手段)の3段階フォールバックの明記、`.json`付きカタログURL使用の推奨。**D8・D10を踏まえた更新が必要**: `#m=`が本当に必要なのは複数カタログ・`required_styles`/`optional_styles`・`sharing_policy`明示的上書きの3ケースだけだと明記できるようになった。**MCPスタイル(D10)の案内も追加すべき** — コード実行環境が無くても`#q=`が使えるようになった今、STAFF_PROMPT.mdの3段階フォールバックに「MCP対応クライアントなら`mcp/`/`worker/`のツールを使う」という4つ目の選択肢を足すのが筋が良い
4. **`hfu/faceless-cartographer`のDECISIONS.mdへのクロスリファレンス提案** — 適用していない(同上、提案のみ)。保存場所:
   `/private/tmp/claude-501/-Users-hfu-faceless-cartographer/a4d543ce-4068-4052-92eb-b85d46f8d7bd/scratchpad/faceless_cartographer_decisions_addendum_proposal.md`

### 完了(参考)

- **背景地図(bvmap)の表示/非表示トグル**(D9、2026-08-03実装) — パネルに「背景地図(bvmap)を表示」チェックボックス(既定ON)を追加。既存の`layerIdsBySourceId`/`[data-layer-toggle]`汎用ハンドラ(`src/render.ts`)をそのまま流用でき、新規JSロジックは不要だった(HTMLテンプレートへの1ブロック追加のみ)。可視状態はURLに永続化しない(既存の主題レイヤートグルと同じ挙動)。3D地形は従来通り`TerrainControl`(右上の山アイコン)でON/OFF。
- **源内スタイル**(D10〜D12、2026-08-03実装、最終形はD12) — `GENNAI_PROMPT.md`は紆余曲折を経て以下の形に確定した:
  1. 最初`hfu/layers-martin`に、`STAFF_PROMPT.md`を抜粋・圧縮した精選版(3,966字)として置いた(D10、同リポジトリD28)。
  2. フォーム画面から発見できなかったため`scripts/fetch-gennai-prompt.mjs`でUIに配線した(D11)。
  3. ユーザー判断により方針転換: (a)`hfu/layers-martin`のD23判断(全カタログ埋め込みは保守負荷過大)を今回は踏み越え、カタログを既知のノイズ系統を除き全件埋め込むべき、(b)内容がspiccato固有のインタフェースに依存するため、`hfu/layers-martin`ではなくこのリポジトリに置くべき、との指摘を受け、D12で全面作り直し。`hfu/layers-martin`側のD28はSupersededにした。
  - **現状**(D12): `scripts/build-gennai-prompt.mjs`(新設、`fetch-gennai-prompt.mjs`を置き換え)が`prebuild`のたびにlayers-martin・stars-optgeoの実カタログをfetchし、既知のノイズ系統(`disasterhist_*`、液状化イラスト4件、`\d{4}_\d{2}[-_]`パターンの過去災害イラスト60件 — 3つ目は監査中に新規発見、ユーザー確認済み)を除いた全件(layers-martin 1,682件+stars-optgeo 7件、計66,860字)を`GENNAI_PROMPT.md`(リポジトリルート)に埋め込む。`src/main.ts`は`../GENNAI_PROMPT.md?raw`を直接import。フォーム画面のdisclosure UI自体はD11のまま。
  - spiccatoサイトに埋め込まれた3件のサンプル質問(熊本地震オルソ画像・石狩川治水・北海道火山土地条件図)で実機検証済み(D11時点、内容は変わってもリンク構築ロジックは同じなので引き続き妥当)。
- **MCPスタイル stdio・Workers版**(D10、2026-08-03実装) — 上記参照。

## リポジトリ構成

```
spiccato/
├── DECISIONS.md          # ADR、D1〜D10。設計判断の正
├── HANDOVER.md            # このファイル
├── README.md
├── index.html
├── src/
│   ├── types.ts / mapIntent.ts / catalog.ts / style.ts / base-style.json
│   │                      # vendored from faceless-cartographer、無改修(D1)
│   ├── dads-components.css
│   ├── fragment.ts        # #m= コーデック(圧縮)、D3。mcp/worker双方から再利用(D10)
│   ├── shorthand.ts       # #q= コーデック(無圧縮)、D6/D8。buildShorthandLinkはD10でmcp/worker用に新設
│   ├── main.ts             # bootstrap: #m= → #q= → 貼り付けフォームの順で試す
│   ├── render.ts           # UI、ライブ状態反映(D8: #q=優先、収まらなければ#m=)
│   └── *.test.ts
├── public/
│   ├── .nojekyll
│   ├── maplibre-gl-worker.mjs(.map)   # node_modules由来、手動vendoring(D5)
│   └── maplibre-gl-shared.mjs(.map)   # 同上
├── mcp/                    # MCPサーバー、ローカルstdio版(D10)
│   ├── src/{catalog,linkBuilder,server,stdio}.ts
│   └── test/
├── worker/                 # MCPサーバー、Cloudflare Workers版(D10、mcp/src/server.tsを再利用)
│   ├── src/index.ts
│   └── wrangler.toml
├── scripts/fetch-staff-prompt.mjs   # prebuildフック(D19 in faceless-cartographer由来)
└── .github/workflows/build-docs.yml
```

## 開発コマンド

```bash
cd /Users/hfu/spiccato
npm install
npm run typecheck
npm test
npm run build        # docs/ に出力
npm run preview -- --port 4321 --strictPort   # ローカル確認用
```

ローカルでブラウザ確認する際、vite dev serverではなく`npm run build && npm run preview`(本番相当のsinglefileビルド)で確認すること — worker関連の問題(D5)はdevサーバーでは再現しないことがある。

## 再開用プロンプト

新しいセッションでこの続きから作業する場合、以下をそのまま貼り付けて開始できる:

---

`/Users/hfu/spiccato` で作業を続けます。このリポジトリは `hfu/faceless-cartographer`(staccatoアーキテクチャの第二世代Cartographer)の第三世代実装で、Map IntentをURLフラグメントに直接埋め込んで開くlink-nativeなCartographerです。まず `HANDOVER.md` と `DECISIONS.md`(特にD1・D2・D6・D7・D8・D9・D10)、および計画ファイル `/Users/hfu/.claude/plans/scalable-snacking-spring.md`(Staffの複数スタイル導入計画、残っていれば)を読んで状況を把握してください。

直近のフォローアップ候補(優先順は状況次第で判断してよい):
1. **オープンウェブスタイルの深掘り**(次のステップ) — 「決定的検索+極小LLM意図解釈」分解の詳細化・小さなプロトタイプ着手。計画ファイルの該当節参照
2. `#m=`の非推奨化計画(D7)の続き — 急ぎではない
3. `hfu/layers-martin`のSTAFF_PROMPT.md更新提案、`hfu/faceless-cartographer`のDECISIONS.mdクロスリファレンス提案 — 前回セッションでscratchpadに書いたが未適用(HANDOVER.mdのパス参照、消えていたら再作成が必要)。D8・D10を踏まえた更新が必要(MCPスタイルの案内追加も)

bvmap背景地図の表示/非表示トグル(D9)、MCPスタイルstdio・Workers版(D10)、源内スタイル(`GENNAI_PROMPT.md`、このリポジトリ自身に置く全カタログ埋め込み版、D12)は実装済み。

作業前に必ず `npm run build && npm run preview -- --port 4321 --strictPort` でローカルの本番相当ビルドを確認すること。ブラウザでの目視確認より先に、コンソールから `map.isSourceLoaded('<source-id>')` を直接呼ぶ方法を使うこと(HANDOVER.mdの教訓参照)。`mcp/`・`worker/`はそれぞれ独立した`npm install`が必要(ルートの`npm install`ではインストールされない)。

---
