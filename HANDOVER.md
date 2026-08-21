# HANDOVER.md

セッションを引き継ぐ人(未来の自分、または別のClaude Codeセッション)向けの状態記録。設計判断の理由は[DECISIONS.md](DECISIONS.md)が正だが、ここでは「今どこまで進んでいて、次に何をすべきか」を先に把握できるようにする。

## これは何か

`dwg7/spiccato` — `hfu/faceless-cartographer`(staccatoアーキテクチャの第二世代Cartographer)の第三世代実装。Map Intent(YAML)をURLフラグメントに直接埋め込み、リンクを開くだけで地図が描画される「link-native」なCartographer。中核パイプライン(Map Intent解析・カタログ解決・MapLibreスタイル構築)は`hfu/faceless-cartographer`からvendoring、URL状態の扱いは全面的に書き直し([DECISIONS.md](DECISIONS.md) D1・D2)。

**現在地**: https://dwg7.github.io/spiccato/ で公開中、動作確認済み。

## 現在の状態(2026-08-13時点、Issue #3・#5・#6対応(D19)完了・全Issueクローズ済み)

**直近の作業**: ユーザーが`dwg7/spiccato`に4件のIssue(#3〜#6)を作成し、実質3つの作業に対応した(D19)。**push・コメント・クローズまですべて完了済み**(Issue #1〜#6、いずれもクローズ済み — 2026-08-13時点でオープンなIssueは無い):

1. Cartographer画面にGeolocateControl・スケールバーを追加(Issue #6、`src/render.ts`)。
2. `#q=`の`req`/`opt`が`source_id|label`(パイプ区切り)を取れるように拡張し、Cartographerパネルに識別子でなく名前が表示されるようにした(Issue #5後半、`src/shorthand.ts`)。label部分は`encodeURIComponent`で保護し、半角カンマ等が構造区切り文字と衝突しないようにした。**ユーザーから「複数レイヤーでlabelの記述が破綻しないか」との指摘があり、実際に破綻することを確認した上でこの保護を設計した**(元の設計案では防げなかった)。
3. GENNAI_PROMPT.md・STAFF_PROMPT.md(`hfu/layers-martin`)両方に、label構文の説明と「リンクを提示できる場合Map Intentのテキストは併記しない」という明記を追加(Issue #3コメント・Issue #5前半)。
4. ユーザー依頼により`#q=`パラメータ仕様全体の命名一貫性をレビューし、`encodeRef`→`buildRefEntry`に改名(既存の`parse*`/`build*`命名規則に統一)。

**このセッションで踏んだ手順ミスの記録(教訓)**: push作業中、`cd /Users/hfu/spiccato && git fetch ...`の直後に続けて`git fetch origin && git log ...`(cd無し)を実行してしまい、Bashツールのcwdが`/Users/hfu/faceless-cartographer`(既定の作業ディレクトリ)にリセットされていたため、そちらのリポジトリに対してfetch/mergeを実行してしまった(実害は無かった — faceless-cartographer側もfast-forwardのみで、データ損失は起きていない)。**教訓: このツールのBash呼び出し間でcwdが暗黙にリセットされることがある(明示的な通知は出るが見落としやすい)。複数リポジトリを行き来する作業では、git操作のたびに`pwd`で確認するか、毎回`cd <絶対パス> &&`を明示すること。**

**進行中の大きめの取り組み**: Staffを使う「スタイル」をノーマル(コピペ)以外に増やす作業に着手した(源内スタイル・MCPスタイル・オープンウェブスタイル)。計画の全体像は`/Users/hfu/.claude/plans/scalable-snacking-spring.md`(このセッション間で消えない可能性が高いパス、消えていたら[DECISIONS.md](DECISIONS.md) D10の記述から復元できる)。MCPスタイル(stdio・Workers、D10)・源内スタイル(`GENNAI_PROMPT.md`、D10〜D15、D17)は実装完了。

**オープンウェブスタイルは計画ファイルが分解した4要素すべてが実装され、プロトタイプとして一通り機能するようになった**:
1. 決定的検索(D16実装済み)
2. 決定的検索レイヤーの構造的ギャップ修正 — `hfu/layers-martin`の`build_catalog.rb`が集約カタログに`path`を含めるようにした(D16 2026-08-13追記、同リポジトリD32)。当初「`description`追加」を対応方向としていたが、実装前に中身を確認したところ的外れと判明(descriptionは撮影手法の定型注記のみ、災害名は`path`に入っていた)。spiccato側のコードは無改修。ローカル検証で「熊本地震」検索が0件→45件に改善、本番デプロイ済み。
3. 地名→座標解決(`openweb/geocode.ts`、新設) — 国土地理院のジオコーディングAPIを利用。**LLMには地名抽出をさせず、利用者が直接入力する設計**(D16でLLMの意図解釈自体が信頼性不足だったため、抽出タスクを増やさない判断)。
4. 候補選択UI・`#q=`/`#m=`リンク構築(`openweb/main.ts`) — 検索結果にチェックボックスを追加、`mcp/src/linkBuilder.ts`の`buildSpiccatoLink`(D10で実装済み)をそのまま再利用してリンクを構築。

実機検証で、質問→検索→候補選択→地域名入力→リンク作成→本番spiccatoでの描画、という一連の流れが正しく動くことを確認済み(DECISIONS.md D16の2026-08-13追記参照)。**残る根本課題はLLM側のキーワード抽出精度のみ**(意図的にスコープ外、prompt/decode調整の限界に達している)。

**「Map Intentエラー実例待ち」(前回セッションの最優先事項)はクローズした**: ユーザーが[Issue #1](https://github.com/dwg7/spiccato/issues/1)(M365 Copilotによるプロンプト評価レポート)・[Issue #2](https://github.com/dwg7/spiccato/issues/2)(GENNAI/Sonnetによる4件のロールプレイテスト)を作成、両方ともコメント・クローズ済み。**想定していた「クラッシュ系エラー」ではなく、プロンプト設計への建設的レビューだった**。両Issueに登場する全source_id/style_id(計16件)を実カタログと突き合わせて検証し、捏造は1件も無かったことを確認(D14/D15の効果の裏付け)。Issue #1が指摘した4点の改善提案を、`GENNAI_PROMPT.md`(`scripts/build-gennai-prompt.mjs`)と`hfu/layers-martin`の`STAFF_PROMPT.md`の両方に反映した(D17、layers-martin側はD30)。

**その後、bboxの扱いをユーザーの指示で方針転換した(D17追記・D30追記)**: 「地名から確信が持てなければbboxはnullにして利用者に範囲不明と伝える」という当初の判断(source_idの捏造と同列視)を、「確信が持てなくてもベストエフォートで推測し、狭すぎるより広めに見積もる」へ逆転させた。理由: 捏造されたsource_idは利用者が対処しようのないエラーを生むが、bboxの粗い推測は利用者がズーム・パンで補正できる不便さに留まる — 両者は同列の「捏造」ではない。

**さらに、Staffの応答姿勢そのものについてもユーザーから重要な指摘があった(D18・layers-martin D31)**: Issue #2で「それらしいidを作ることはしません」とUSERに向けて表明していた応答について、内容(捏造しなかったこと)は正しいが、**その事実をUSERに向けて表明すること自体が誤り**という指摘。StaffはUSER(利用者)に直面するコンシェルジュであり、開発者向けのデバッグ情報(内部規範を守っている表明)をUSERに聞かせる必要はない。`GENNAI_PROMPT.md`・`STAFF_PROMPT.md`両方に新セクション「応答は利用者(顧客)向けであること」を追加し、「それらしいidを作らず正直に見つからないと伝える」という、USER向け応答のテンプレートをそのまま含んでいた指示文言を「見つからない旨を利用者に簡潔に伝える」に書き換えた。内部規範(捏造しないこと)自体は変更していない。

**このセッションでの追加作業**: (1) `src/render.ts`のプロンプトコピーボタンの非対称性を解消。(2) オープンウェブスタイルの最小限プロトタイプを`openweb/`に実装・実機検証してD16として記録、ユーザー判断で当面停止。(3) Issue #1・#2への対応(D17・layers-martin D30)。

### 実装済み・動作確認済み

- 中核パイプライン(`src/types.ts`/`mapIntent.ts`/`catalog.ts`/`style.ts`/`base-style.json`)はfaceless-cartographer(commit `a016206`)からvendoring、無改修
- URLフラグメント、2形式:
  - `#m=` — 圧縮(`CompressionStream` deflate-raw)+ base64url。フル機能(複数catalog、`required_styles`、`render_hints`等)。コード実行環境が無いと構築できない(D3)。実際に必要なのは複数カタログ・`sharing_policy`明示的上書きを使うケースのみに縮小した(D8、D20で`required_styles`/`optional_styles`もD8の対象から外れた)
  - `#q=` — 無圧縮のquery string(`catalog=...&req=...&opt=...&bbox=...&goal=...`、D6)。**D8で拡張**: `lat=...&lng=...&zoom=...&bearing=...&pitch=...`(render_hints相当)と`missing=...&unrenderable=...`(cartographer_feedback相当)も、バイト単位の変換不要な数値・ID列挙のまま追加した。**D20でさらに拡張**: `rstyle=...&ostyle=...`(`required_styles`/`optional_styles`相当、`style_id[|label]`のカンマ区切り、`req`/`opt`と同じ書式)を追加し、単一カタログである限り`required_styles`/`optional_styles`もリンク1本(YAML不要)で表現できるようになった
- ライブ状態反映(`src/render.ts`の`updateFragment`): **D8で変更** — まず`#q=`(`buildShorthandFragment`)を試し、intentの形が収まる場合(単一カタログ・`sharing_policy`が既定値)は同期的に`#q=`のまま書き戻す。収まらない場合のみ従来通り`#m=`(`encodeIntentFragment`、非同期)にフォールバックする。**開き方に関わらず**形が収まれば`#q=`を維持する(貼り付け/`#m=`経由で開いたintentでも、単一カタログなら`#q=`のまま反映される)。実機検証(本番相当ビルド)で、熊本地震の例(単一カタログ)・火山土地条件図の例(`required_styles`使用、D20以降)のいずれも`#q=`のまま(`rstyle=`)反映されることを確認済み(D20より前は後者のみ`#m=`にフォールバックしていた)
- 実機検証: 熊本地震オルソ画像・全国津波浸水想定・御嶽山噴火(2014)衛星SAR画像のいずれも、リアルタイムでStaff役を演じてカタログ照会→Map Intent構築→リンク生成→本番サイトでの描画確認まで完了
- GitHub Pages公開済み、`.github/workflows/build-docs.yml`でmainへのpush時に自動ビルド・デプロイ
- **MCPスタイル(D10、2026-08-03実装)**: `mcp/`(ローカルstdio版)・`worker/`(Cloudflare Workers版、Streamable HTTP・ステートレス)の2トランスポート。共通ロジック(`mcp/src/server.ts`/`catalog.ts`/`linkBuilder.ts`)は完全共有、`src/shorthand.ts`に`buildShorthandLink`(ライブビュー不要な#q=構築、`render.ts`用の`buildShorthandFragment`とロジック共有)を新設して再利用。4ツール(`list_catalogs`/`search_catalog`/`get_layer_info`/`build_spiccato_link`)。stdioは子プロセス越しの生JSON-RPCで、Workersは`wrangler dev`+`curl`で、それぞれ`initialize`→`tools/call`の実通信を確認済み。生成された`#q=`/`#m=`両方のリンクを本番相当ビルドで開いて描画確認済み(欠落レイヤー無し、コンソールエラー無し)
- **Map Intent検証の寛容化(D14、2026-08-06実装)**: `src/normalizeIntent.ts`を新設し、`src/main.ts`の`handleSubmit`で`parseMapIntent`の手前に挟む。検証はされるが実際には一度も読まれないフィールド(`spec_version`・`provenance.generated_by`/`generated_at`/`intent_id`・カタログの`id`)と、既定値で代用可能なフィールド(カタログの`type`、既定`layers_txt`)だけを、欠けている場合に限り埋める。`goal`は既存の空文字列センチネル(D6の自動生成)を再利用。`src/mapIntent.ts`(D1のvendoring境界)は無改修。本当に無効なMap Intent(`required_layers`/`required_styles`が両方とも無い等)は従来通り正しく弾かれることを確認済み。ユニットテスト7件(`src/normalizeIntent.test.ts`)。
- **オープンウェブスタイル プロトタイプ(D16、2026-08-07〜2026-08-13実装)**: `openweb/`(`index.html`/`main.ts`/`llm.ts`/`geocode.ts`)を新設、メインの1ファイルバンドルとは別のVite設定(`vite.openweb.config.ts`、`viteSingleFile()`不使用)で`docs/openweb/`にビルドする。`@huggingface/transformers`(transformers.js)+`onnx-community/Qwen2.5-0.5B-Instruct`(q4量子化)で自然文からの検索キーワード抽出、`mcp/src/catalog.ts`の`searchCatalog`をそのまま再利用した決定的検索、検索結果のチェックボックスによる候補選択、GSIジオコーディングAPIによる地名→bbox解決(LLM不使用)、`mcp/src/linkBuilder.ts`の`buildSpiccatoLink`再利用によるリンク構築、まで一通り実装。決定的検索レイヤーの構造的ギャップ(カタログに`path`が無かった)は`hfu/layers-martin`側(D32)で修正済み。実機検証の結果、**機構自体(ダウンロード・推論・検索・候補選択・ジオコーディング・リンク構築・本番spiccatoでの描画)は正常動作する。残る根本課題はLLMのキーワード抽出精度のみ**(詳細はDECISIONS.md D16)。
- **`#q=`への`rstyle`/`ostyle`追加(D20、2026-08-21実装)**: `dwg7/chukei`(利用者が保守する、非技術系利用者向けStaffプロンプト)から「`required_styles`/`optional_styles`だけがYAML貼り付けを要求する唯一のケースになっている、`req`/`opt`同様のURLパラメータにできないか」という相談を受けて対応。`StyleRef`は`LayerRef`と同じ形・`resolveStyles`は`resolveLayers`と同じ`active_catalogs`を見るだけと判明したため、単一カタログ制約はそのまま、`rstyle`/`ostyle`(`style_id[|label]`のカンマ区切り、`req`/`opt`と同じ書式)を追加する素直な拡張で済んだ。`mcp/src/linkBuilder.ts`・`openweb/main.ts`は無改修で恩恵を受け(既に`required_styles`を渡していたのが自動的に`#m=`→`#q=`に変わる)、`GENNAI_PROMPT.md`(`scripts/build-gennai-prompt.mjs`)のvlcm/vbm例もYAMLから`#q=`リンクに置き換えた。本番相当ビルドで実際に`https://stars.optgeo.org/catalog`に対し`rstyle=vlcm|火山土地条件図&ostyle=vbm|火山基本図`を含むリンクを開き、パネルに両ラベルが表示されることを確認済み(詳細はDECISIONS.md D20)。

### 直近で直したバグ(重要、再発に注意)

**背景地図(bvmapグレースケール)・Mapterhorn地形が描画されない問題**、2段階で解決した([DECISIONS.md](DECISIONS.md) D5):

1. `maplibre-gl` 6.xはベクトルタイル解析・raster-dem(地形)デコードをWeb Workerに委譲する。`maplibre-gl-worker.mjs`は`vite-plugin-singlefile`のインライン化対象にならず、`docs/`に存在しなかった(404) → `public/maplibre-gl-worker.mjs`として配置して解決
2. **これだけでは不十分だった**。`maplibre-gl-worker.mjs`自身が`maplibre-gl-shared.mjs`(約470KB、メインバンドルとワーカーの共有コード)を`import`しており、これも`public/`に無いとワーカー初期化自体が失敗する(Vite×MapLibre 6のコミュニティ既知の落とし穴)。`public/maplibre-gl-shared.mjs`も配置して完全に解決した

**教訓**: 依存パッケージの大きなバージョンアップ(今回はmaplibre-gl 5→6)の後は、ビルド成果物(`docs/`)に実行時参照される全ファイルが揃っているか確認する。特に「動的に構築されるURL経由で読み込まれる補助ファイル」(Worker、WASM等)はViteのバンドル対象外になりがちで見落としやすい。将来`maplibre-gl`を更新する際は、`node_modules/maplibre-gl/dist/`から`maplibre-gl-worker.mjs`・`maplibre-gl-shared.mjs`(それぞれ`.map`含む)を再コピーする必要がある。

**検証方法の教訓**: このセッションで使った自動化ブラウザツールは、タブが`document.hidden: true`として扱われ`requestAnimationFrame`がほぼ発火しないという別の制約があり、スクリーンショットによる目視確認だけでは「まだ直っていない」のか「ツールの制約で見えないだけ」なのか切り分けられなかった。**次回この種の問題を調査する際は、目視確認より先に`map.isSourceLoaded('<source-id>')`をコンソールから直接呼ぶ方法を使うこと** — レンダーループの制約を受けにくく、ブール値で即座に確認できる。

**GitHub Pagesデプロイが「まれに失敗する」問題(2026-08-06に本リポジトリでも再確認)**: pushしても`https://dwg7.github.io/spiccato/`に反映されないことがある。原因はGitHub純正の自動生成ワークフロー「pages build and deployment」が「job was not acquired by Runner of type hosted even after multiple attempts」で失敗すること(`gh run list`で確認できる)。**課金・トークン枯渇が原因ではないことを確認済み**(`dwg7`組織はGitHub Free、Actions分は$0.50が丸ごとpublicリポジトリ割引でカバーされ請求額$0、月2,000分中0分使用 — 2026-08-06、ユーザーが実際の課金画面で確認)。`hfu/layers-martin`・`hfu/faceless-cartographer`でも以前から知られている、GitHub側の一時的なランナー供給不足(この文書とは独立した既知の問題)。

**対処法**: `gh api repos/dwg7/spiccato/pages/builds -X POST`で強制再デプロイすると、通常は(時間はかかることがあるが)解消する。`gh api repos/dwg7/spiccato/pages/builds/latest`で`status`(`building`/`built`/`errored`)を確認できる。

**未解決の別件**: 独自CI `.github/workflows/build-docs.yml`(`on: push`で`typecheck`/`test`/`build`を走らせる)が、2026-08-06のpushでは一度も起動しなかった(`gh api repos/dwg7/spiccato/commits/<sha>/check-runs`で確認すると、GitHub純正の`pages-build-deployment`関連しか出てこない)。`workflow_dispatch`で手動起動すると正常に成功する。原因不明 — 組織`dwg7`のActionsポリシー(承認制など)が関係している可能性があり、ユーザーに`https://github.com/dwg7/spiccato/settings/actions`の確認を依頼済みだが、次のセッションでもまだ未解決なら追跡すること。実害は無い(pushする前に必ずローカルで`typecheck`/`test`/`build`を確認する運用を徹底しているため)が、CIの安全網が機能していない状態ではある。

### 未着手・フォローアップ

1. ~~Issue #3〜#6の後片付け~~ — 完了済み(D19・layers-martin D33、push・コメント・クローズ済み)
2. ~~Issue #1・#2の後片付け~~ — 完了済み(D17・layers-martin D30、push・コメント・クローズ済み)
3. **オープンウェブスタイル: LLM以外はすべて実装済み** — 決定的検索レイヤーのギャップ修正(`path`追加、layers-martin D32)、地名→座標解決(`openweb/geocode.ts`)、候補選択UI・`#q=`/`#m=`リンク構築(`openweb/main.ts`、`mcp/src/linkBuilder.ts`再利用)まで実装・実機検証済み(DECISIONS.md D16の2026-08-13追記参照)。残るのはLLMのキーワード抽出精度のみ(few-shot調整済みQwen2.5-0.5B-Instructでも暴走・文字化けが観測された、DECISIONS.md D16の「実機検証」節参照)、意図的にスコープ外。より大きいモデルで再挑戦するかはユーザー判断待ち
4. **`build-docs.yml`がpushで起動しない件** — 上記「教訓」参照。ユーザーに組織`dwg7`のActions設定(`https://github.com/dwg7/spiccato/settings/actions`)確認を依頼済み、回答待ち。billing枯渇ではないことは確認済み(2026-08-06、月2,000分中0分使用)。**2026-08-07時点で再確認したところ、依然として直近の複数pushで`push`トリガーの起動が0件**(2026-08-03 13:31以降、`schedule`/`workflow_dispatch`のみ成功) — まだ解消していない
5. **`#m=`の非推奨化(obsolete化)** — D7の条件1(`#q=`のrender_hints/cartographer_feedback拡張)はD8で実装済み。**D20で`required_styles`/`optional_styles`(`rstyle`/`ostyle`)も`#q=`で表現できるようになり、D7が名指しした「2つのギャップ」のうち1つが解消した** — 残るのは複数カタログ・`sharing_policy`明示的上書きのみ。それでも`#m=`自体を廃止するかは別途判断が必要(急ぐ必要は無い、D7参照)。**`hfu/layers-martin`のSTAFF_PROMPT.md更新自体はD29で完了済み**(下記「完了」参照) — 残るのは「実際に`#m=`のコードを削除するかどうか」という、より重い判断のみ
6. **`hfu/faceless-cartographer`のDECISIONS.mdへのクロスリファレンス提案** — 未適用(別リポジトリのため提案のみ)。保存場所(セッション間で引き継がれない一時ディレクトリのため、消えていたら再作成が必要):
   `/private/tmp/claude-501/-Users-hfu-faceless-cartographer/a4d543ce-4068-4052-92eb-b85d46f8d7bd/scratchpad/faceless_cartographer_decisions_addendum_proposal.md`

### 完了(参考)

- **背景地図(bvmap)の表示/非表示トグル**(D9、2026-08-03実装) — パネルに「背景地図(bvmap)を表示」チェックボックス(既定ON)を追加。既存の`layerIdsBySourceId`/`[data-layer-toggle]`汎用ハンドラ(`src/render.ts`)をそのまま流用でき、新規JSロジックは不要だった(HTMLテンプレートへの1ブロック追加のみ)。可視状態はURLに永続化しない(既存の主題レイヤートグルと同じ挙動)。3D地形は従来通り`TerrainControl`(右上の山アイコン)でON/OFF。
- **源内スタイル**(D10〜D15、2026-08-06実装、最終形はD15) — `GENNAI_PROMPT.md`は紆余曲折を経て以下の形に確定した:
  1. 最初`hfu/layers-martin`に、`STAFF_PROMPT.md`を抜粋・圧縮した精選版(3,966字)として置いた(D10、同リポジトリD28)。
  2. フォーム画面から発見できなかったため`scripts/fetch-gennai-prompt.mjs`でUIに配線した(D11)。
  3. ユーザー判断により方針転換: (a)`hfu/layers-martin`のD23判断(全カタログ埋め込みは保守負荷過大)を今回は踏み越え、カタログを既知のノイズ系統を除き全件埋め込むべき、(b)内容がspiccato固有のインタフェースに依存するため、`hfu/layers-martin`ではなくこのリポジトリに置くべき、との指摘を受け、D12で全面作り直し。`hfu/layers-martin`側のD28はSupersededにした。
  4. D12でも実際には長すぎるとユーザーが判断(ChatGPTで読み込み失敗、66,860字) → D13で`gsjgeomap*`/`ndvi_*`/2020年より前の災害対応速報画像を追加除外(17,870字まで縮小)。
  5. **D13は撤回した(D15)** — MS Copilotでの再検証により「文字数の多さは問題ではない」との所見。また、GENNAI_PROMPT.mdとSTAFF_PROMPT.mdの内容差分分析で「Cartographer能力」「既知の欠落」「意味解決の指針」がほぼ丸ごと欠落していたことが判明し、正確さ・互換性優先の方針に転換。D13の3種除外をすべて撤回(D12相当の1,685件に復元)、プロンプト本文を拡充(Cartographer能力節・既知の制約節・例3件に増強)。
  - **現状**(D15): `scripts/build-gennai-prompt.mjs`が`prebuild`のたびにlayers-martin・stars-optgeoの実カタログをfetchし、意味的ノイズ(`disasterhist_*`等)のみ除外した上で**約69,000字**(layers-martin 1,685件+stars-optgeo 7件)を`GENNAI_PROMPT.md`(リポジトリルート)に埋め込む。実際に源内やChatGPTで読み込めるかは依然ユーザー確認待ち。
  - あわせて`hfu/layers-martin`のSTAFF_PROMPT.md自体も更新した(同リポジトリD29) — 「正しいやりとりの形」がspiccatoの設計(URLが一次artifact)と矛盾していた箇所を解消し、spiccato向け`#q=`/`#m=`構築手順を追記。
  - spiccatoサイトに埋め込まれた3件のサンプル質問(熊本地震オルソ画像・石狩川治水・北海道火山土地条件図)で実機検証済み(D11時点、内容は変わってもリンク構築ロジックは同じなので引き続き妥当)。
- **MCPスタイル stdio・Workers版**(D10、2026-08-03実装) — 上記参照。

## リポジトリ構成

```
spiccato/
├── DECISIONS.md          # ADR、D1〜D19。設計判断の正
├── HANDOVER.md            # このファイル
├── README.md
├── GENNAI_PROMPT.md       # 源内スタイル、自動生成(D10〜D15)。手で編集しない
├── index.html
├── vite.config.ts         # メインページ用(singlefile、docs/へ出力)
├── vite.openweb.config.ts # openweb/用(singlefile不使用、docs/openweb/へ出力、D16)
├── src/
│   ├── types.ts / mapIntent.ts / catalog.ts / style.ts / base-style.json
│   │                      # vendored from faceless-cartographer、無改修(D1)
│   ├── dads-components.css
│   ├── fragment.ts        # #m= コーデック(圧縮)、D3。mcp/worker双方から再利用(D10)
│   ├── shorthand.ts       # #q= コーデック(無圧縮)、D6/D8。buildShorthandLinkはD10でmcp/worker用に新設
│   ├── normalizeIntent.ts # 儀礼的フィールドの寛容化、D14。parseMapIntentの手前に挟む
│   ├── main.ts             # bootstrap: #m= → #q= → 貼り付けフォームの順で試す
│   ├── render.ts           # UI、ライブ状態反映(D8: #q=優先、収まらなければ#m=)
│   └── *.test.ts
├── openweb/                # オープンウェブスタイル プロトタイプ(D16、4要素すべて実装済み)
│   ├── index.html          # 独立ページ、docs/openweb/へビルド
│   ├── main.ts              # 質問→extractKeyword→searchCatalog→候補選択(チェックボックス)→リンク構築
│   ├── llm.ts               # transformers.js + Qwen2.5-0.5B-Instruct(q4)のラッパー
│   └── geocode.ts           # GSIジオコーディングAPIで地名→bbox(LLM不使用、利用者が地名を直接入力)
├── public/
│   ├── .nojekyll
│   ├── maplibre-gl-worker.mjs(.map)   # node_modules由来、手動vendoring(D5)
│   └── maplibre-gl-shared.mjs(.map)   # 同上
├── mcp/                    # MCPサーバー、ローカルstdio版(D10)。src/catalog.tsはopenweb/main.tsからも再利用(D16)
│   ├── src/{catalog,linkBuilder,server,stdio}.ts
│   └── test/
├── worker/                 # MCPサーバー、Cloudflare Workers版(D10、mcp/src/server.tsを再利用)
│   ├── src/index.ts
│   └── wrangler.toml
├── scripts/fetch-staff-prompt.mjs      # prebuildフック(D19 in faceless-cartographer由来)
├── scripts/build-gennai-prompt.mjs     # GENNAI_PROMPT.md生成、prebuildフック(D12〜D15)
└── .github/workflows/build-docs.yml
```

## 開発コマンド

```bash
cd /Users/hfu/spiccato
npm install
npm run typecheck
npm test
npm run build        # docs/ に出力(D16以降: メイン→openweb/の順に2回vite buildが走る)
npm run preview -- --port 4321 --strictPort   # ローカル確認用(docs/openweb/も同じサーバーで /openweb/ に配信される)
```

ローカルでブラウザ確認する際、vite dev serverではなく`npm run build && npm run preview`(本番相当のsinglefileビルド)で確認すること — worker関連の問題(D5)はdevサーバーでは再現しないことがある。

## 再開用プロンプト

新しいセッションでこの続きから作業する場合、以下をそのまま貼り付けて開始できる:

---

`/Users/hfu/spiccato` で作業を続けます。このリポジトリは `hfu/faceless-cartographer`(staccatoアーキテクチャの第二世代Cartographer)の第三世代実装で、Map IntentをURLフラグメントに直接埋め込んで開くlink-nativeなCartographerです。まず `HANDOVER.md` を全文読み、次に `DECISIONS.md` のD1・D2・D6〜D19(特にD16〜D19が直近の変更)、計画ファイル `/Users/hfu/.claude/plans/scalable-snacking-spring.md`(Staffの複数スタイル導入計画、残っていれば)を読んで状況を把握してください。関連する `hfu/layers-martin` リポジトリ(`/Users/hfu/layers-martin`、ローカルにクローン済み)のD28〜D33も、STAFF_PROMPT.md/GENNAI_PROMPT.mdの経緯・カタログスキーマの変遷を理解する上で参照してください。

**このセッション終了時点で、`dwg7/spiccato`のIssueは全件(#1〜#6)クローズ済み、両リポジトリともpush・デプロイ済み、未着手のオープンなIssueは無い。** 次にユーザーから新しいIssueやフィードバックが来たら、まずそれを読むところから始めること(このリポジトリの運用パターン: ユーザーが実際にStaffプロンプトを試した結果をIssueとして報告 → 内容を精査 → 計画してから対応 → 実機検証 → コミット → push/コメント/クローズはユーザーに確認してから)。

明確な「次の一手」は無い状態。次点のフォローアップ候補(優先順は状況次第、いずれも急ぎではない):
1. **オープンウェブスタイルのLLM精度** — 決定的検索・地名解決・候補選択UI・リンク構築は実装済み(D16)。残るのはLLM(Qwen2.5-0.5B-Instruct)のキーワード抽出精度のみで、few-shot調整済みでも暴走・文字化けが観測された(DECISIONS.md D16「実機検証」節参照)。意図的にスコープ外としたまま。より大きいモデルで再挑戦するかはユーザー判断待ち
2. **`build-docs.yml`が`push`で起動しない件** — 独自CI(typecheck/test/build)がpushイベントでは起動せず、`workflow_dispatch`の手動起動でのみ成功する。billing枯渇ではないことは確認済み。ユーザーに`https://github.com/dwg7/spiccato/settings/actions`の確認を依頼済み、2026-08-07時点でも未解消。回答が無ければ再度確認を促すこと。実害は無い(pushの前に必ずローカルでtypecheck/test/buildを確認する運用のため)が、CIの安全網として機能していない
3. `#m=`の非推奨化計画(D7)の続き — `hfu/layers-martin`のSTAFF_PROMPT.md更新自体はD29で完了済み、残るのは「実際にコード削除するか」のより重い判断のみ
4. `hfu/faceless-cartographer`のDECISIONS.mdへのクロスリファレンス提案 — 未適用、scratchpadに書いたが消えていたら再作成が必要(HANDOVER.mdのパス参照)

bvmap背景地図の表示/非表示トグル(D9)、MCPスタイルstdio・Workers版(D10)、源内スタイル最終形(`GENNAI_PROMPT.md`、全カタログ埋め込み・STAFF_PROMPT.md互換、D10〜D15)、Map Intent検証の寛容化(D14)、プロンプトコピーボタンの対称化、Issue #1・#2対応(D17・layers-martin D30)、bboxの扱いの方針転換(D17追記・D30追記)、Staff応答のUSER目線原則(D18・layers-martin D31)、オープンウェブスタイル(D16、決定的検索・検索レイヤー修正・地名解決・候補選択UI・リンク構築まで一通り実装、layers-martin D32)、Issue #3・#5・#6対応(コントロール追加・`#q=`へのlabel拡張・リンク優先の徹底、D19・layers-martin D33)は実装済み。

作業前に必ず `npm run build && npm run preview -- --port 4321 --strictPort` でローカルの本番相当ビルドを確認すること。ブラウザでの目視確認より先に、コンソールから `map.isSourceLoaded('<source-id>')` を直接呼ぶ方法を使うこと(HANDOVER.mdの教訓参照)。`mcp/`・`worker/`はそれぞれ独立した`npm install`が必要(ルートの`npm install`ではインストールされない)。GitHub Pagesへの反映が止まっている場合は`gh api repos/dwg7/spiccato/pages/builds -X POST`で強制再デプロイを試すこと。**複数リポジトリ(spiccato・layers-martin)を行き来する際は、git操作のたびに`pwd`で確認するか毎回`cd <絶対パス> &&`を明示すること — Bashツールのcwdが暗黙にリセットされ、意図しないリポジトリに対してgit操作してしまう事故が実際に起きている**(上記「現在の状態」参照、幸い実害は無かった)。

---
