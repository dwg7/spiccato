# HANDOVER.md

セッションを引き継ぐ人(未来の自分、または別のClaude Codeセッション)向けの状態記録。設計判断の理由は[DECISIONS.md](DECISIONS.md)が正だが、ここでは「今どこまで進んでいて、次に何をすべきか」を先に把握できるようにする。

## これは何か

`dwg7/spiccato` — `hfu/faceless-cartographer`(staccatoアーキテクチャの第二世代Cartographer)の第三世代実装。Map Intent(YAML)をURLフラグメントに直接埋め込み、リンクを開くだけで地図が描画される「link-native」なCartographer。中核パイプライン(Map Intent解析・カタログ解決・MapLibreスタイル構築)は`hfu/faceless-cartographer`からvendoring、URL状態の扱いは全面的に書き直し([DECISIONS.md](DECISIONS.md) D1・D2)。

**現在地**: https://dwg7.github.io/spiccato/ で公開中、動作確認済み。

## 現在の状態(2026-08-03時点)

### 実装済み・動作確認済み

- 中核パイプライン(`src/types.ts`/`mapIntent.ts`/`catalog.ts`/`style.ts`/`base-style.json`)はfaceless-cartographer(commit `a016206`)からvendoring、無改修
- URLフラグメント、2形式:
  - `#m=` — 圧縮(`CompressionStream` deflate-raw)+ base64url。フル機能(複数catalog、`required_styles`、`render_hints`等)。コード実行環境が無いと構築できない(D3)
  - `#q=` — 無圧縮のquery string(`catalog=...&req=...&opt=...&bbox=...&goal=...`)。コード実行環境なしで手で組み立てられる(D6)。単一カタログ・単純なレイヤー参照のみ対応
- ライブ状態反映: 地図を開いた後、pan/zoom/レイヤートグルのたびに`#m=`へ無条件で書き戻す(D2)。`#q=`で開いても、最初の操作で`#m=`に変わる
- 実機検証: 熊本地震オルソ画像・全国津波浸水想定・御嶽山噴火(2014)衛星SAR画像のいずれも、リアルタイムでStaff役を演じてカタログ照会→Map Intent構築→リンク生成→本番サイトでの描画確認まで完了
- GitHub Pages公開済み、`.github/workflows/build-docs.yml`でmainへのpush時に自動ビルド・デプロイ

### 直近で直したバグ(重要、再発に注意)

**背景地図(bvmapグレースケール)・Mapterhorn地形が描画されない問題**、2段階で解決した([DECISIONS.md](DECISIONS.md) D5):

1. `maplibre-gl` 6.xはベクトルタイル解析・raster-dem(地形)デコードをWeb Workerに委譲する。`maplibre-gl-worker.mjs`は`vite-plugin-singlefile`のインライン化対象にならず、`docs/`に存在しなかった(404) → `public/maplibre-gl-worker.mjs`として配置して解決
2. **これだけでは不十分だった**。`maplibre-gl-worker.mjs`自身が`maplibre-gl-shared.mjs`(約470KB、メインバンドルとワーカーの共有コード)を`import`しており、これも`public/`に無いとワーカー初期化自体が失敗する(Vite×MapLibre 6のコミュニティ既知の落とし穴)。`public/maplibre-gl-shared.mjs`も配置して完全に解決した

**教訓**: 依存パッケージの大きなバージョンアップ(今回はmaplibre-gl 5→6)の後は、ビルド成果物(`docs/`)に実行時参照される全ファイルが揃っているか確認する。特に「動的に構築されるURL経由で読み込まれる補助ファイル」(Worker、WASM等)はViteのバンドル対象外になりがちで見落としやすい。将来`maplibre-gl`を更新する際は、`node_modules/maplibre-gl/dist/`から`maplibre-gl-worker.mjs`・`maplibre-gl-shared.mjs`(それぞれ`.map`含む)を再コピーする必要がある。

**検証方法の教訓**: このセッションで使った自動化ブラウザツールは、タブが`document.hidden: true`として扱われ`requestAnimationFrame`がほぼ発火しないという別の制約があり、スクリーンショットによる目視確認だけでは「まだ直っていない」のか「ツールの制約で見えないだけ」なのか切り分けられなかった。**次回この種の問題を調査する際は、目視確認より先に`map.isSourceLoaded('<source-id>')`をコンソールから直接呼ぶ方法を使うこと** — レンダーループの制約を受けにくく、ブール値で即座に確認できる。

### 未着手・フォローアップ

1. **`#q=`をrender_hints/cartographer_feedback対応に拡張する**([DECISIONS.md](DECISIONS.md) D7)。現在ライブ状態反映(pan/zoom等)は常に`#m=`に書き戻る。`#q=`に`lat`/`lng`/`zoom`/`bearing`/`pitch`(数値そのまま)や`missing`(ID列挙)を追加すれば、単純なケースでは`#m=`が丸ごと不要になる可能性がある。**この拡張を実装してから**、`#m=`の非推奨化(次項)を進めること(順序が逆だとライブ反映が使えない空白期間が生じる)
2. **`#m=`の非推奨化(obsolete化)** — 上記の拡張と実運用を経てから判断する。まだ実施しない(D7参照)
3. **背景地図(bvmap)の表示/非表示トグル** — ユーザーから提案あり(「市街地では建物が主題画像を隠す場合がある」)。3D地形は既にMapLibre標準の`TerrainControl`でON/OFF可能(右上の山アイコン)。bvmap自体のトグルはまだ実装していない
4. **`hfu/layers-martin`のSTAFF_PROMPT.md更新提案** — 適用していない(別リポジトリのため提案のみ)。提案文は下記の場所に保存している(セッション間で引き継がれない一時ディレクトリのため、次回セッションでは失われている可能性が高い。必要なら再作成すること):
   `/private/tmp/claude-501/-Users-hfu-faceless-cartographer/a4d543ce-4068-4052-92eb-b85d46f8d7bd/scratchpad/staff_prompt_spiccato_proposal.md`
   要旨: 「正しいやりとりの形」第3項・第5項の差し替え案、`#q=`(推奨)→`#m=`(高機能時)→貼り付け(最終手段)の3段階フォールバックの明記、`.json`付きカタログURL使用の推奨
5. **`hfu/faceless-cartographer`のDECISIONS.mdへのクロスリファレンス提案** — 適用していない(同上、提案のみ)。保存場所:
   `/private/tmp/claude-501/-Users-hfu-faceless-cartographer/a4d543ce-4068-4052-92eb-b85d46f8d7bd/scratchpad/faceless_cartographer_decisions_addendum_proposal.md`

## リポジトリ構成

```
spiccato/
├── DECISIONS.md          # ADR、D1〜D7。設計判断の正
├── HANDOVER.md            # このファイル
├── README.md
├── index.html
├── src/
│   ├── types.ts / mapIntent.ts / catalog.ts / style.ts / base-style.json
│   │                      # vendored from faceless-cartographer、無改修(D1)
│   ├── dads-components.css
│   ├── fragment.ts        # #m= コーデック(圧縮)、D3
│   ├── shorthand.ts       # #q= コーデック(無圧縮)、D6
│   ├── main.ts             # bootstrap: #m= → #q= → 貼り付けフォームの順で試す
│   ├── render.ts           # UI、ライブ状態反映(#m=へ無条件で書き戻す)
│   └── *.test.ts
├── public/
│   ├── .nojekyll
│   ├── maplibre-gl-worker.mjs(.map)   # node_modules由来、手動vendoring(D5)
│   └── maplibre-gl-shared.mjs(.map)   # 同上
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

`/Users/hfu/spiccato` で作業を続けます。このリポジトリは `hfu/faceless-cartographer`(staccatoアーキテクチャの第二世代Cartographer)の第三世代実装で、Map IntentをURLフラグメントに直接埋め込んで開くlink-nativeなCartographerです。まず `HANDOVER.md` と `DECISIONS.md`(特にD1・D2・D6・D7)を読んで状況を把握してください。

直近のフォローアップ候補(優先順は状況次第で判断してよい):
1. `DECISIONS.md` D7で計画した通り、`#q=`(`src/shorthand.ts`)に render_hints相当(lat/lng/zoom/bearing/pitch)と cartographer_feedback相当(missing/unrenderable)を無圧縮のクエリパラメータとして追加する。実装後、ライブ状態反映(`src/render.ts`の`updateFragment`)も条件次第で`#q=`のまま維持できないか検討する
2. bvmap背景地図の表示/非表示トグルをUIに追加する(3D地形は`TerrainControl`で既にON/OFF可能)
3. `hfu/layers-martin`のSTAFF_PROMPT.md更新提案、`hfu/faceless-cartographer`のDECISIONS.mdクロスリファレンス提案 — 前回セッションでscratchpadに書いたが未適用(HANDOVER.mdのパス参照、消えていたら再作成が必要)

作業前に必ず `npm run build && npm run preview -- --port 4321 --strictPort` でローカルの本番相当ビルドを確認すること。ブラウザでの目視確認より先に、コンソールから `map.isSourceLoaded('<source-id>')` を直接呼ぶ方法を使うこと(HANDOVER.mdの教訓参照)。

---
