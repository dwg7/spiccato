# DECISIONS.md

`spiccato` の設計判断を ADR (Architecture Decision Record) 形式で記録する。実装は `src/*.ts` を正とし、ここでは判断の理由のみを記録する。

## 目次

| # | タイトル | Status | Date |
|---|---|---|---|
| [D1](#d1-第三世代hfu-faceless-cartographer第二世代からの系譜と何を引き継いだか) | 第三世代 — hfu/faceless-cartographer(第二世代)からの系譜と、何を引き継いだか | Accepted | 2026-08-03 |
| [D2](#d2-url-に状態を持たせることを既定にするadr-0001からの意図的な転換) | URL に状態を持たせることを既定にする(ADR 0001からの意図的な転換) | Accepted | 2026-08-03 |
| [D3](#d3-フラグメントのエンコードはcompressionstreamによるdeflate圧縮--base64url自前実装は持たない) | フラグメントのエンコードは`CompressionStream`によるdeflate圧縮 + base64url(自前実装は持たない) | Accepted | 2026-08-03 |
| [D4](#d4-プライバシー情報管理上の分析) | プライバシー・情報管理上の分析 | Accepted | 2026-08-03 |
| [D5](#d5-ベースマップ地形が描画されない不具合mapliblreワーカースクリプトの欠落) | ベースマップ・地形が描画されない不具合(MapLibreワーカースクリプトの欠落) | Accepted | 2026-08-03 |
| [D6](#d6-コード実行環境の無いgenai向けにq簡易フォーマットを追加する) | コード実行環境の無いGenAI向けに `#q=` 簡易フォーマットを追加する | Accepted | 2026-08-03 |
| [D7](#d7-m-の非推奨化計画いつ何を条件に廃止するか) | `#m=` の非推奨化計画(いつ・何を条件に廃止するか) | Proposed | 2026-08-03 |
| [D8](#d8-q-へのrender_hintscartographer_feedback拡張とライブ反映のq優先化d7条件1の実装) | `#q=` への render_hints/cartographer_feedback 拡張とライブ反映の `#q=` 優先化(D7条件1の実装) | Accepted | 2026-08-03 |
| [D9](#d9-背景地図bvmapの表示非表示トグル) | 背景地図(bvmap)の表示/非表示トグル | Accepted | 2026-08-03 |
| [D10](#d10-staffの複数スタイル源内mcpオープンウェブと-mcpスタイルstdioworkers版の実装) | Staffの複数スタイル(源内・MCP・オープンウェブ)と、MCPスタイル(stdio・Workers版)の実装 | Accepted(MCP部分)/Proposed(源内・オープンウェブ) | 2026-08-03 |
| [D11](#d11-gennai_promptmdをフォーム画面から発見できるようにする) | `GENNAI_PROMPT.md` をフォーム画面から発見できるようにする | Accepted(取得元はD12で変更) | 2026-08-03 |
| [D12](#d12-gennai_promptmdをこのリポジトリへ移設し全カタログ埋め込み版に作り直す) | `GENNAI_PROMPT.md` をこのリポジトリへ移設し、全カタログ埋め込み版に作り直す | Accepted(サイズはD13で再縮小) | 2026-08-03 |
| [D13](#d13-gennai_promptmdが実際に長すぎたためサイズ優先で追加削減する) | `GENNAI_PROMPT.md` が実際に長すぎたため、サイズ優先で追加削減する | Accepted | 2026-08-03 |

---

## D1: 第三世代 — hfu/faceless-cartographer(第二世代)からの系譜と、何を引き継いだか

**Status**: Accepted

**Context**: このリポジトリは、`hfu/faceless-cartographer`(staccato アーキテクチャにおける Cartographer の第二世代実装)と同じ著者による、同じ `UNopenGIS/staccato-spec` を対象とした第三世代実装である。命名の由来: `spiccato`(スピッカート)は弦楽器の跳ね弓奏法で、`staccato`(音を切り離す)と同じ系統だが、弓を弦から跳ね上げることでより極端に音を分離させる。今回の変更は「アーキテクチャ(4者モデル、Cartographerの決定的描画)は変えず、原則(URLに状態を持たせない、という制約)は必要に応じて転換し、災害対応時のニーズ対応を含めた、よりユースケースに即した活用ができるように大胆に推し進める。」という位置づけであり、staccatoと対立する概念(legato等)ではなく、staccatoの先鋭化として選んだ。「URLに状態を持たせない」という制約自体を推し進めるのではなく、逆方向(URLに状態を持たせる)へ明確に転換した点が `hfu/faceless-cartographer` との最大の違いである(D2参照)。

当初の発端は、Claude が Staff として生成した Map Intent(令和8年熊本地震・八代地区正射画像速報)を `hfu/faceless-cartographer` に手で貼り付けて動作確認したことだった。そこから「Claude が Map Intent を生成した時点で、貼り付け不要のURLを直接構築して提示できないか」という発想が生まれた。

**重要な事実確認(このリポジトリ着手前に判明したこと)**: 当初の発想は「`hfu/faceless-cartographer` には URL 経由の受け渡し機構が無く、逆に URL に状態を持たせない方針が明示されている」という前提に基づいていた。しかし実際に `hfu/faceless-cartographer` の DECISIONS.md を確認したところ、この前提は誤りだった。同リポジトリは D32(2026-07-09)で `#intent=` によるURLフラグメント経由の一回限り受け渡しを、D34/D35/D36(2026-07-09〜10)でセッション単位の「faceless / idempotent」2モード切り替えを既に実装しており、`UNopenGIS/staccato-spec` へ ADR 0003・0004・0006・0007 として提案し、いずれも Merge 済みだった。

この事実確認を経て、このリポジトリの位置づけを次のように再定義した: **spiccato は「無い機能を追加する」リポジトリではなく、「第二世代が到達した設計判断(URL状態は一回限り・既定オフ・セッションスコープ)そのものを転換する」リポジトリである。** D34/D36 の実装は「faceless が既定、URL状態はユーザーが毎セッション明示的にONにする例外」という設計だが、これは Staff(AIエージェント)が Map Intent を生成した直後にリンクとして即座に提示する、というこのリポジトリの目的とは相性が悪い(第二世代のリンクは常にセッションの最初は "faceless" 状態で始まり、地図を表示してから利用者が自分でチェックボックスをONにしない限りURLは更新されない・そもそも最初のリンク自体をCartographer側では生成できない)。spiccato はこの前提そのものを転換する(D2参照)。

**Decision**: 中核パイプライン(`types.ts`/`mapIntent.ts`/`catalog.ts`/`style.ts`/`base-style.json`/`dads-components.css`)は `hfu/faceless-cartographer`(commit `a016206`)から**そのまま vendoring** する。これらのモジュールは同リポジトリの D18(SPA化の際、環境非依存な純粋関数として書かれていたためほぼ無改修で移植できたと記録されている)の通り、URL状態に関する意見を一切持たない環境非依存なコードであり、spiccato のURL状態方針の転換によって書き換える理由が無い。各ファイル冒頭に vendoring 元のコミットハッシュを記録した。

一方、URL状態の扱いそのものに関わる層(`fragment.ts`、`main.ts` の bootstrap、`render.ts` のURL反映ロジック)は全面的に書き直した(D2/D3参照)。ビルド構成(Vite + vite-plugin-singlefile、`docs/` 出力、GitHub Pages、`.github/workflows/build-docs.yml`)や UI レイアウト(パネル・凡例・レイヤー検索・D41のフィーチャークリックポップアップ)は同リポジトリの実績あるパターンをそのまま踏襲した。

**Consequences**: `hfu/faceless-cartographer` と `dwg7/spiccato` は今後、同じ Map Intent スキーマ・同じ Library(`hfu/layers-martin` 等)を対象に、URL状態の扱いという1点だけが異なる、並存する2つの Cartographer 実装になる。どちらも `UNopenGIS/staccato-spec` の正式な実装であり、思想・機能の重複は問題ではない(同一著者による意図的な分岐)。中核パイプラインが `hfu/faceless-cartographer` 側で更新された場合、spiccato 側は自動追随しない(vendored snapshot のため、D24 の `base-style.json` vendoring と同じ運用)。将来的な差異が大きくなった場合、vendoring 元を更新する形で追随するかどうかは都度判断する。

## D2: URL に状態を持たせることを既定にする(ADR 0001からの意図的な転換)

**Status**: Accepted

**Context**: `UNopenGIS/staccato-spec` の ADR 0001 は「URL に地図の状態を持たせない」ことを Cartographer の核心的な設計原則としている。`hfu/faceless-cartographer` は D18(SPA化)・D32(フラグメント一回限り受け渡し)・D34(sharing_policy によるデフォルト分岐)・D35(Copy Shareable Linkボタン廃止)・D36(faceless/idempotent 2モード)を通じて、この原則の「文言」からは逸脱しつつ「精神」(サーバーがMap Intentを一切知らない、共有は人間が仲介する、既定は安全)を守るという論法を一貫して採用してきた。

D1 で確認した通り、この結果 `hfu/faceless-cartographer` が到達した設計は次の形をしている: URL状態反映は (a) intent の `sharing_policy.url_share` を初期値としつつ、(b) 既定は常に faceless(D36: 「`sharing_policy.url_share` が `true` であっても、デフォルトは faceless」)、(c) ユーザーがセッションごとにチェックボックスで明示的にONにしない限り、URLは更新されない、(d) ONにしても、地図を開いた**後**でなければONにできない(D35: Copy Shareable Linkボタンの廃止により、URLをアドレスバーからコピーする以外の手段が無い)。

これは「Staff が Map Intent を生成した直後に、貼り付け不要のリンクとして即座に提示する」というこのリポジトリの目的にとって、実質的に機能しない設計である。Cartographer 自身がリンクを生成できず(D35でその手段を廃止済み)、生成できたとしても既定でOFFなので、Staff が把握できる固定のURLパターン(`https://.../#m=...`)が存在しない。この「半端さ」は実装の不備ではなく、ADR 0001 の精神(既定は安全、URL状態は例外的措置)を律儀に守った結果であり、その精神自体を転換しない限り解消しない。

**Decision**: spiccato は ADR 0001 の**文言(URLに状態を持たせない)だけでなく、精神(URL状態は既定オフの例外的措置であるべき)も転換する**。URL に地図状態を持たせることを、この Cartographer の既定の・唯一のアーキテクチャとする。

具体的には:

1. **フラグメントは一回限りで消去されない**(`hfu/faceless-cartographer` D32 との違い)。`main.ts` の `bootstrap()` は `location.hash` を読んでレンダリングするだけで、`history.replaceState` によるクリアは行わない。同じURLを再度開けば同じ地図が再現される。
2. **URL反映にセッション単位のトグルは無い**(D34/D36 との違い)。`render.ts` の `updateFragment()` は `intent.sharing_policy.url_share` の値に関わらず、地図が変化するたび(`moveend`、レイヤートグル)に無条件で実行される。さらに地図を開いた直後、ユーザーが何も操作しなくても一度 `updateFragment()` を呼び、URLを即座に populate する(「URL状態は既定」であって「操作した結果ONになる例外」ではないことの表れ)。
3. **`sharing_policy.url_share` は再定義する**。ゲート(反映するかどうかの条件)としては一切機能させない代わりに、`false` と宣言されている intent を地図表示する際、「この Map Intent は本来URL共有を想定していないが、spiccato は常にURLへ状態を反映する」という注意書きを表示する(`urlShareAdvisory`、`render.ts`)。フィールドの意味を「反映するかどうかの制御」から「この内容がURL共有を前提に作られたものかどうかの申告」へと変える(元の brief で提案されていた再定義案を採用)。`intent_share` フィールドの扱いは変更しない。
4. **「Copy Shareable Link」ボタンは復活させる**(D35 との違い、名称は「Copy Link」)。D35 の判断(アドレスバーが常に最新なので冗長)は「URL反映が既定でONである」前提でこそ成り立つが、それでもアドレスバーからのコピーはモバイルでは手数が多く、`location.href` を直接コピーできるボタンは低コストな利便性向上と判断した。

**この転換が ADR 0001 の「精神」に対してもなお正当化できるかの検討**: ADR 0001 が守ろうとしている価値は主に3つ ── (a) サーバーが利用者の地図状態を一切知らない、(b) 共有の一次artifactはMap Intentのテキスト自体であり、URLではない、(c) 共有には人間の仲介が入る。spiccato はこのうち (a) を完全に維持する(GitHub Pages の静的サイトであり、フラグメントはサーバーに送信されない仕様上の性質は変わらない)。(b) は明確に転換する ── spiccato における一次artifactはURLそのものである。(c) は形を変えて残ると判断した: 人間(またはStaffを介した人間)が「リンクを開く」という行為は、「Map Intentをコピー&ペーストする」という行為と同様に、意図的な一手間である。ワンクリックで踏める点は「意図の希薄化」ではあるが、メールの添付ファイルを開く操作や、他人から送られたリンクをクリックする操作と同程度の「人間による選択」は残っている。この解釈が妥当かどうかは判断が分かれ得る論点であり、ここに明記しておく(D1で立ち止まって使用者に確認した論点の一つ)。

**Consequences**: `src/fragment.ts`(URL反映を無条件で行うための土台となるコーデック、D3参照)、`src/main.ts`(one-shot clearを行わない bootstrap)、`src/render.ts`(トグルUIの削除、`updateFragment()` の無条件化、advisory通知の追加、Copy Linkボタンの追加)を新規に書いた(D1参照、中核パイプラインは無改修)。`hfu/layers-martin` の `STAFF_PROMPT.md` は、Staff が Map Intent のテキストではなく spiccato のURLをリンクとして返すよう更新が必要(提案のみ、別途 `hfu/layers-martin` 側で検討 ── 本セッションのやり取りでも指摘された通り、Staff は生のURL文字列を露出させるのではなく `[説明文](URL)` の形の Markdown リンクとして提示すべきという美観上の要請がある)。

## D3: フラグメントのエンコードは`CompressionStream`によるdeflate圧縮 + base64url(自前実装は持たない)

**Status**: Accepted

**Context**: `hfu/faceless-cartographer` の `#intent=` は UTF-8 テキストを無圧縮で base64url化するだけだった(D32)。spiccato は後方互換性を切ってよい前提(個人プロジェクト、破壊的変更許容)で、エンコード方式を再検討した。検討した選択肢:

1. 無圧縮 base64url のまま踏襲する。実装が単純、実績もある。
2. `pako`(zlib実装のJSポート)等のライブラリでdeflate圧縮してからbase64url化する。圧縮率は高いが、追加npm依存(バンドルサイズ増)が要る。
3. ブラウザ標準の `CompressionStream`/`DecompressionStream`(`'deflate-raw'`)でdeflate圧縮する。追加依存無し(全モダンブラウザに標準搭載)。

実測(`熊本地震正射画像`のMap Intent、UTF-8で702バイト)で比較した: 無圧縮base64url化で936文字、`deflate-raw` 圧縮後base64url化で686文字、**約26.7%の削減**。より多くの `required_layers`/`required_styles` を含む intent ではさらに大きな削減が見込める(YAMLはキー名の反復が多く圧縮率が高い構造)。

**Decision**: 選択肢3(`CompressionStream`/`DecompressionStream`)を採用する。ライブラリを追加せず、ペイロードの実用長を短縮できる。ワイヤフォーマットは `<フォーマット文字><base64url(バイト列)>` とし、フォーマット文字で自己記述的にする:

- `z`: `deflate-raw` 圧縮したバイト列(既定。`CompressionStream` が使える環境では常にこちら)。
- `p`: 無圧縮のUTF-8バイト列(`CompressionStream` が使えない環境向けのフォールバックとしてのみ使用。デコード側は `DecompressionStream` が無ければ `z` を「読めない」として `null` を返す ── クラッシュではなく、貼り付けフォームへの安全なフォールバックに倒す)。

ハッシュキーは `hfu/faceless-cartographer` の `#intent=` を再利用せず、独自の `#m=` を用いる。エンコード方式が非互換(圧縮バイト列 vs 平文)であるため、キー名を変えることで「異なる実装間でリンクを貼り違えた場合、静かに誤動作するのではなく、はっきり握手が成立しない」ようにする意図的な選択。

**Consequences**: `encodeIntentFragment`/`decodeIntentFragment`(`src/fragment.ts`)は非同期関数になった(`CompressionStream` はストリームAPIのため)。`render.ts` の `updateFragment()` は世代カウンタで非同期処理のレース(素早い連続操作で古いエンコード結果が新しい状態を上書きする)を防いでいる。`src/fragment.test.ts` で往復・圧縮効果・不正入力の各ケースをテスト済み(Node 22の `CompressionStream`/`atob`/`btoa` は標準搭載のためテスト環境に追加設定不要)。

## D4: プライバシー・情報管理上の分析

**Status**: Accepted

**Context**: URL状態を既定にする(D2)ことで、`hfu/faceless-cartographer` の D32 が指摘していた懸念 ── 「URLフラグメントはブラウザ履歴・端末間同期・クリップボード履歴に残り得る」── が、一回限りではなく常時発生するようになる。この変化がどの程度のリスクかを整理しておく。

**分析**:

1. **サーバーへの非送信は変わらない**: URLフラグメント(`#...`より後ろ)はHTTPリクエストの一部として送信されない、というブラウザの基本仕様は変わらない。GitHub Pages(静的ホスティング)のアクセスログにMap Intentの内容が残ることはない。これは D2 で維持すると明記した (a) の性質そのもの。
2. **リファラーにも含まれない**: ページ内の外部リソース(タイルサーバー、CDN等)へのリクエストの `Referer` ヘッダーには、フラグメントは含まれない(WHATWG URL/Referrer Policy仕様上の一般的な挙動)。したがって `hfu.github.io/layers-martin` や `stars.optgeo.org` 等、地図タイルを提供する外部サーバーにもMap Intentの内容は伝わらない。
3. **ブラウザ履歴・同期には残る**: これは常時発生するようになった分、`hfu/faceless-cartographer` より広く当てはまる。対策として何かを隠蔽するのではなく、**Map Intent自体がそもそも秘密情報を含まない設計であることを前提とする**(`hfu/faceless-cartographer` D32 の結論を踏襲): Map Intent は人間が読める平文であり、共有相手に見せることを前提に設計されている(D2/D12、`map-intent-vnext.md` の思想)。URLに載っても載らなくても、この設計上の前提は変わらない。
4. **`sharing_policy.url_share: false` の意味**: D2で再定義した通り、この宣言は「反映を止める」機能ではなく「本来この内容はURL共有を想定していない」という申告として扱う。真に機密な文脈(例: 内部限定のレイヤーを含む調査用途)では、そもそも Staff が `url_share: false` と申告した上で、Cartographer側の advisory 表示を見た人間が「このリンクは転送しない」と判断する、という人間の責任に委ねる設計(`hfu/faceless-cartographer` の `architecture-principles.md` §2「人間が責任を持つ」を踏襲)。技術的な強制(暗号化やアクセス制御)は行わない ── そもそも静的サイト+URLフラグメントというアーキテクチャの性質上、技術的な強制は不可能であり、それを装う機能を作らないことも「捏造しない」という一貫した設計方針(D3 in `hfu/faceless-cartographer`)に合致する。
5. **クリップボード履歴**: 「Copy Link」ボタン(D2)でクリップボードにコピーされた内容は、OSやクリップボードマネージャーの履歴に残り得る。これは D32 が既に指摘していた通りで、共有を意図した操作(人間が明示的にコピーボタンを押す)の自然な結果として許容する。

**Decision**: 追加のマスキング・暗号化・有効期限付きリンク等の機構は実装しない(過剰実装と判断)。Map Intentは平文で共有可能な設計であることを前提とし、`sharing_policy.url_share: false` はURLに載らないための保護ではなく人間への注意喚起として位置づける(D2）。README/フォーム画面の文言で「機密情報をMap Intentに含めない」という前提を明示する。

**Consequences**: 将来、真に機密性の高いユースケース(組織内限定データ等)が実際に必要になった場合、この判断(技術的強制を持たない)は再検討対象になる。その場合も、まず検討すべきは「spiccatoで機密データを扱わない」という運用上の切り分けであり、spiccato自体に認可機構を実装することではないと考える(静的サイトというアーキテクチャの根本と衝突するため)。

## D5: ベースマップ・地形が描画されない不具合(MapLibreワーカースクリプトの欠落)

**Status**: Accepted

**Context**: 公開直後、ユーザーから「熊本地震・津波・御嶽山いずれの例でも、bvmap背景地図とMapterhorn地形が全く描画されない(主題レイヤーだけが白背景の上に浮かんで見える)」との報告があった。調査の第一段階では、著者自身のテスト環境(自動化ブラウザツール)で `document.hidden: true` かつ `requestAnimationFrame` が実質的に一度も発火していないことを確認し、これはツール側の描画ループ停止によるものだと誤って結論した。しかしユーザーが自身の実ブラウザで同じ現象を確認したことで、この診断が誤りだったと判明し、再調査した。

再調査の結果、実際の原因は次の通りだった: `maplibre-gl` 6.x はベクトルタイル(bvmap)の解析とraster-dem(Mapterhorn地形)のデコードを Web Worker に委譲しており、そのワーカースクリプト(`maplibre-gl-worker.mjs`)はページと同じオリジンの相対URLから実行時に読み込まれる。`vite-plugin-singlefile` はメインの JS/CSS を `index.html` にインライン化するが、この動的に構築されるWorker URLはインライン化の対象にならない。一方 `docs/` には `index.html` と `.nojekyll` しか含まれておらず、`https://dwg7.github.io/spiccato/maplibre-gl-worker.mjs` は存在しない(404)ままデプロイされていた。ラスター画像ソース(熊本のオルソ画像、津波のPNGタイル等)はWorkerを必要とせず正常に描画されていたため、レイヤー種別ごとの問題に見えてしまっていた。

**この診断は途中まで正しく、途中から不十分だった**: `maplibre-gl-worker.mjs` を `public/` に配置してデプロイした後も、ユーザーの実ブラウザで背景・地形が依然として表示されないという再報告があった。ブラウザの開発者コンソールで「標高タイル(Mapterhorn)への呼び出しは発生しているが、ベクトルタイル(bvmap)への呼び出しは確認できない」という具体的な観察をユーザーから得たことが決め手になった。MapLibreコミュニティの情報(GitHub Issue・Vite関連の既知の問題)を調査した結果、`maplibre-gl-worker.mjs` 自身が同階層の `maplibre-gl-shared.mjs`(メインバンドルとワーカーで共有されるコード、約470KB)を `import` しており、これも同様に `docs/` に存在しなければワーカーの初期化そのものが失敗することが判明した(Viteでこの種のワーカーを扱う際の既知の落とし穴: `?url` で素朴に扱うと本体は読み込めても兄弟chunkが欠落する)。raster-dem(地形)のタイル本体はメインスレッドで直接fetchされデコードのみワーカーに委譲する経路を持つため一部動作しているように見えたが、ベクトルタイル(bvmap)は取得からワーカーに依存するため、ワーカー初期化の失敗の影響をより強く受けていたと考えられる。

**Decision**: `node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs` と `maplibre-gl-shared.mjs`(それぞれの `.map` を含む、計4ファイル)を `public/` にコピーする。Viteの `publicDir` コピー処理により、`docs/` にも同じファイル名でそのまま配置され、ワーカーの相対importが実行時に解決できるようになる。

**検証方法についての教訓**: 当初、スクリーンショットによる目視確認を繰り返していたが、このセッションで使っていた自動化ブラウザツールには「タブが `document.hidden: true` として扱われ `requestAnimationFrame` がほぼ発火しない」という別の制約があり(D5前半の誤診断の原因)、目視確認だけでは「まだ直っていない」のか「ツールの制約で見えないだけ」なのかを切り分けられなかった。最終的に有効だったのは、`map.isSourceLoaded('bvmap')`/`isSourceLoaded('mapterhorn')` をコンソールから直接呼び出す方法で、これはレンダーループの制約を受けにくく、修正の成否をブール値で即座に確認できた。今後この種の問題を調査する際は、目視確認よりも先にこの方法を使うべきだった(スクリーンショットの反復はコストが高い)。

**Consequences**: `public/maplibre-gl-worker.mjs`・`public/maplibre-gl-worker.mjs.map`・`public/maplibre-gl-shared.mjs`・`public/maplibre-gl-shared.mjs.map` を追加(node_modules由来のバイナリ、`.gitignore` の対象外、合計約580KB)。将来 `maplibre-gl` をアップデートした際は、この4ファイルすべてを `node_modules/maplibre-gl/dist/` から再コピーする必要がある(自動追随しない、手動更新が必要な vendoring)。この種の「ビルドツールが検出できないURLで参照される補助ファイル」は今後も起こり得るため、依存パッケージの大きなバージョンアップ後は実際にデプロイ済みサイトを確認する習慣が要る。副産物として `map.on('error', ...)` のログ出力を追加した(ただしワーカーのimport失敗はこのハンドラでは捕捉されない、Workerコンテキストのエラーであるため)。

## D6: コード実行環境の無いGenAI向けに `#q=` 簡易フォーマットを追加する

**Status**: Accepted

**Context**: D3で選定した `#m=`(deflate圧縮+base64url)は、Staffがバイト単位の変換を正確に手計算できることを前提にしており、実質的にコード実行環境(Bash等のツール)を持つ生成AIしか正しいリンクを構築できない。これは「Claudeがリンクを生成して返す」というspiccatoの目的にとって選別的すぎるという指摘があった。検討の結果、圧縮の有無に関わらずbase64相当のバイト単位変換自体が生成AIにとって手計算困難な作業であり(D3時点の`#intent=`無圧縮base64urlも同様に困難だった)、単に圧縮をやめるだけでは解決しないと判断した。

一方で、Staffは既にMap Intentを書く前提としてカタログを照会し、実在する `source_id` を確認済みである(D3の`hfu/layers-martin` STAFF_PROMPT.md提案参照)。この確認済みの `source_id` 文字列をそのまま、コンマ区切りでURLに並べるだけなら、バイト単位の変換は一切不要で、生成AIが最も得意とする「検証済みの文字列をテンプレートに当てはめる」作業で済む。日本語の自由記述(`goal`)さえ省略可能にすれば、URLに含める内容はほぼ全て英数字(catalog URI・source_id・bbox数値)になり、パーセントエンコーディングの手計算すら不要になる。

**Decision**: `src/shorthand.ts` に `parseShorthandFragment` を新設する。ワイヤーフォーマットは `#q=` に続く通常のquery string(`URLSearchParams` でパース)で、`catalog`(必須、カタログURI)・`type`(任意、既定 `layers_txt`)・`req`/`opt`(コンマ区切りの `source_id` リスト、いずれか一方は必須)・`bbox`(`w,s,e,n`)・`name`・`goal`(いずれも任意)を持つ。

- **第二のスキーマにはしない**: パースした結果は `parseMapIntent`(YAML検証)を経由せず、直接 `MapIntent` オブジェクトとして構築し、既存の `resolveLayers`/`buildStyle`/`renderMapView` パイプラインにそのまま流す(`main.ts` の `renderIntent` として共通化)。`#q=` は「Map Intentの別のワイヤー表現」であって、Map Intentという概念自体を割る競合スキーマではない。
- **goalの自動補完**: `goal` が省略された場合(空文字列をセンチネルとして使う)、レイヤー解決後に各カタログのTileJSON `name` フィールド(または`required_styles`のラベル)から `"衛星SAR強度画像、火山基本図 を表示。"` のような要約を自動生成する。「Copy Map Intent」ボタンが表示中の内容と一致するよう、この補完の**後**にYAMLをシリアライズする(先に空goalでシリアライズしてしまうと、パネル表示とコピー内容が食い違う)。
- **カバー範囲を限定する**: 複数カタログ・`required_styles`/`optional_styles`・`render_hints`・`cartographer_feedback` の往復は `#q=` ではサポートしない(必要なら `#m=` を使う)。単一カタログ・単純なレイヤー参照という最も一般的なユースケースに絞ることで、パーサーとフォーマットの単純さを保つ。
- **ライブ反映は引き続き `#m=` を使う**: `#q=` はあくまで一回限りの入力チャネルであり、地図を開いた後の状態反映(pan/zoom/レイヤートグル、D2)は既存通り圧縮された `#m=` 形式で行う。`#q=` で開いたリンクも、最初の操作で `#m=` リンクに置き換わる。
- **MapLibre自身の `hash` オプションとの名前空間の統制**: MapLibre GL JSは `new Map({hash: 'map', ...})` のようにMap自身の視点(center/zoom/bearing/pitch)を `#map=...` として自動的にURLへ書き込む組み込み機能を持つ(このプロジェクトでは無効のまま、`hash` オプションを一切渡していない)。将来この機能を有効化する可能性、あるいは他の実装との相互運用を考慮し、**spiccato自身が定義するハッシュキー(`m`・`q`、および将来追加するものすべて)は `map` という文字列を使わない**という統制を設ける。現在の2キーはこの制約を満たす(衝突なし)。

**Consequences**: `src/shorthand.ts`・`src/shorthand.test.ts` を追加。`src/main.ts` の `handleSubmit` を `renderIntent`(共通処理)と薄いラッパーに分割し、`bootstrap()` が `#m=` → `#q=` → 貼り付けフォームの順で試すようになった。STAFF_PROMPT.md提案(別リポジトリ向け、提案のみ)を更新し、コード実行環境の有無に応じて `#q=`(既定・推奨)→`#m=`(高機能が必要な場合)→貼り付け(いずれも不可の場合)という3段階のフォールバックを明記した。

## D7: `#m=` の非推奨化計画(いつ・何を条件に廃止するか)

**Status**: Proposed(実際の廃止はまだ実施しない)

**Context**: D6で `#q=` を追加した結果、ユーザーから「`#m=` は長すぎて実用的ではない。差別化のためにも `#m=` のサポートを廃止してよいのでは」という提起があった。同時に、実際に廃止するかどうかは急がず、`#q=` が安定してから obsolete 期間を経て判断すればよい、という条件付きの提案でもあった。ここでは、廃止した場合の損得を先に明確化し、実際の廃止は行わずに計画だけを残す。

**廃止した場合に得られるもの**:
- Staff・利用者の双方にとって「フォーマットが1つだけ」というシンプルな心的モデルになる。D6で導入した「まず`#q=`、無理なら`#m=`、それも無理なら貼り付け」という3段階のフォールバック判断が不要になる。
- `src/fragment.ts`(`CompressionStream`/`DecompressionStream` によるdeflate圧縮コーデック)を丸ごと削除できる。依存するブラウザAPIが1つ減り、非同期処理(圧縮はPromiseベース)に起因するレースコンディション対策(`updateFragment`の世代カウンタ、D6実装コメント参照)も不要になる。
- URLが常に人間に読める(base64の不透明な塊にならない)。デバッグ・共有時の可読性が上がる。

**廃止した場合に失うもの(現時点)**:
- **ライブ状態反映(D2の核心機能)が丸ごと失われる**。現在、地図を開いた後の pan/zoom/bearing/pitch・レイヤートグルの反映は、開き方(`#q=`/`#m=`/貼り付けのいずれか)によらず常に `#m=` へ書き込まれる(D6実装のコメント「ongoing live reflection always writes back through #m=」)。`#m=` を廃止すると、この「アドレスバー自体が常に再現可能なリンクである」というspiccatoの最も基本的な価値提案(README冒頭の説明そのもの)を実現する手段が無くなる。
- 複数カタログ、`required_styles`/`optional_styles`、`sharing_policy` の明示的な上書きが表現できなくなる。
- 「Copy Map Intent」に埋め込まれる `cartographer_feedback`(missing_layers/unrenderable_layers、D15 in `hfu/faceless-cartographer` 由来の feedback loop)をURLに反映する経路が無くなる(ボタン経由のコピー自体はテキストなので影響なし。URLへの反映のみ失われる)。

**この損失は縮小可能である**: 上記の失われるものの多くは、`render_hints`(center/zoom/bearing/pitch は単なる5つの数値)や `cartographer_feedback`(missing/unrenderable は文字列配列)を **圧縮無しの `#q=` 自体にクエリパラメータとして追加する**ことで大部分をカバーできる可能性が高い(例: `&lat=`/`&lng=`/`&zoom=`/`&bearing=`/`&pitch=`、`&missing=id1,id2`)。これらはbase64/deflateのようなバイト単位の変換を必要としない、数値・IDのそのままの列挙で済むため、D6と同じ「コード実行環境なしで構築できる」という性質を保ったまま `#q=` を拡張できる。実現すれば、`#m=` が本当に必要なのは「複数カタログ」「`required_styles`/`optional_styles`」という、より高度なケースだけに絞られる。

**Decision**: 現時点では `#m=` を廃止しない。obsolete(非推奨)化の条件を次のように定める:

1. `#q=` に `render_hints` 相当の数値パラメータ(center/zoom/bearing/pitch)を追加し、ライブ状態反映を `#q=` 単体で(圧縮無しで)実現できるようにする(未実装、フォローアップ)。
2. 上記が実装され、実用上十分な期間(著者の判断による)安定稼働することを確認する。
3. その後、STAFF_PROMPT.md提案・README等で `#m=` を「複数カタログ/required_styles等の高度なケース専用」と明記し直し、通常ケースでの新規リンク生成には使わないよう案内を更新する。
4. 実際にコードから `#m=`/`src/fragment.ts` を削除するのは、案内変更後さらに様子を見てから、別途判断する(このADRでは「削除する」ことそのものは決定しない)。

**Consequences**: 今回は文書化のみ。フォローアップとして「`#q=` への render_hints/feedback 拡張」が今後のタスクとして残る。次に着手する際は、この拡張を先に実装してから、`#m=` の非推奨化(STAFF_PROMPT案内の更新)に進むべきで、順序を逆にすると(先に`#m=`を弱める案内をしてから拡張する)、その間ライブ状態反映が実質使えない期間が生じる。

この拡張自体は D8 で実装した。

## D8: `#q=` への render_hints/cartographer_feedback 拡張とライブ反映の `#q=` 優先化(D7条件1の実装)

**Status**: Accepted

**Context**: D7 が obsolete化の条件1として挙げていた「`#q=` に render_hints 相当の数値パラメータを追加し、ライブ状態反映を `#q=` 単体で実現できるようにする」を実装した。

**Decision**: `src/shorthand.ts` を拡張した:

- `parseShorthandFragment` に `lat`/`lng`/`zoom`/`bearing`/`pitch`(`render_hints` 相当、`lat`/`lng` が両方揃って初めて `render_hints.center` を構築する ── `computeInitialView`(`style.ts`)自身が `hints?.center` の有無をゲートにしているのと同じ前提)と `missing`/`unrenderable`(`cartographer_feedback` 相当、comma区切りのID列挙)を追加した。いずれもバイト単位の変換が要らない、数値・IDのそのままの列挙(D6と同じ性質)。
- 新設 `buildShorthandFragment(intent, live)` ── 書き込み側。現在の `MapIntent` と現在の地図の view(center/zoom/bearing/pitch)・missing/unrenderable から `#q=...` 文字列を合成する。intent の形が `#q=` の対応範囲に収まらない場合は `null` を返し、呼び出し側が `#m=` にフォールバックする設計:
  - `active_catalogs` が2つ以上(複数カタログ)
  - `required_styles`/`optional_styles` のいずれかが非空
  - `sharing_policy` が `#q=` 自身の既定値(`{url_share: true, intent_share: true}`、`parseShorthandFragment` が常に生成する値)と異なる ── D7が名指しした「`sharing_policy` の明示的な上書きが表現できない」というギャップをそのまま安全側のガードにした。ここを見逃すと、`sharing_policy.url_share: false` を宣言した Map Intent が一度でも `#q=` へライブ反映されてしまうと、次に開いたときに advisory 表示(D2)が静かに消える、という後退が起きるため。
- `src/render.ts` の `updateFragment()` を変更: まず `buildShorthandFragment` を試し、非 `null` なら同期的にそのまま `history.replaceState` する(圧縮も `fragmentGeneration` のレース対策も不要 ── 同期処理のため)。`null` の場合のみ、従来通り `encodeIntentFragment`(`#m=`、非同期)にフォールバックする。
- **開き方に関わらず、形が収まる限り `#q=` を維持する**: D6時点の設計(「`#q=` で開いても最初の操作で `#m=` に変わる」)から転換し、`#m=` 経由(圧縮フラグメント)や貼り付けフォーム経由で開いた intent であっても、単一カタログ・スタイル無し・既定の `sharing_policy` という条件さえ満たせば、ライブ反映は `#q=` のまま行われる。実機検証(本番相当ビルド、`npm run preview`)で確認した具体例: 熊本地震の例(貼り付けフォームのデフォルト例、単一カタログ・`required_layers` のみ)を送信すると、初回描画直後の `updateFragment()` が即座に `#q=...&lat=...&lng=...&zoom=...&bearing=0&pitch=0` を生成し、`#m=` を経由しない。一方、火山土地条件図の例(`required_styles`/`optional_styles` を使用)は従来通り `#m=` にフォールバックすることも確認した。

**検証方法についての教訓の追記**: 本セッションの自動化ブラウザツールでも `document.hidden: true` によりMapLibreの `requestAnimationFrame` ベースの描画は進まなかった(D5と同じ制約)。ただし今回変更した対象(URLフラグメントの合成ロジック)はレンダーループに依存しない ── `MapLibreMap` のコンストラクタは `center`/`zoom`/`bearing`/`pitch` を同期的に内部状態へ反映するため、`map.getCenter()`/`getZoom()` 等は描画の成否と無関係に初期化直後から正しい値を返す。この性質を利用し、`window.map`(グローバル公開されたMapインスタンス)ではなく `location.hash` の中身そのものを直接検証することで、レンダーループの制約を回避した(D5の教訓「目視確認より先にコンソールから直接確認する」の具体的な適用例)。

**Consequences**: `src/shorthand.ts`/`src/shorthand.test.ts` を拡張(往復テスト、フォールバック条件ごとの `null` ケースを個別にテスト済み)。`src/render.ts`/`src/main.ts` のコメントを更新し、「ライブ反映は常に `#m=`」という記述を「形が収まる限り `#q=` を維持し、収まらない場合のみ `#m=` にフォールバックする」に改めた。D7 の残りの条件(2〜4、STAFF_PROMPT案内の更新と実際の `#m=` 削除の判断)はまだ着手していない ── 今回の実装により「複数カタログ/`required_styles`・`optional_styles`/`sharing_policy` 明示的上書き」という、より高度なケースだけが `#m=` を必要とする状態になったので、次にSTAFF_PROMPT案内を更新する際はこの3条件を明記すればよい。

## D9: 背景地図(bvmap)の表示/非表示トグル

**Status**: Accepted

**Context**: ユーザーから「市街地では建物がbvmapの上に載った主題画像/レイヤーを隠してしまう場合がある」との指摘があった。3D地形(`mapterhorn`)は既にMapLibre標準の `TerrainControl`(右上の山アイコン)でON/OFFできるが、背景地図(グレースケールのbvmap、`base-style.json` の `before`/`after` に約120層、常にすべての地図で無条件に描画される)自体を隠す手段は無かった。

**Decision**: パネルに「背景地図(bvmap)を表示」チェックボックス(既定ON)を1つ追加するだけで実装した。既存の実装をそのまま流用できた ── `renderMapView`(`src/render.ts`)は既に、構築済みスタイルの `style.layers` を `source` ごとにグルーピングした `layerIdsBySourceId` マップを持ち(元々は主題レイヤー・`required_styles` 由来レイヤーの表示/非表示トグル用)、`[data-layer-toggle]` 属性を持つあらゆるチェックボックスを汎用ハンドラで拾って `map.setLayoutProperty(layerId, 'visibility', ...)` を呼ぶ。`buildStyle`(`style.ts`)が生成する `style.layers` の bvmap 由来レイヤー(約120層、いずれも `source: "bvmap"`)は既にこの仕組みでグルーピング対象になっていたため、`data-layer-toggle="bvmap"` を持つチェックボックスを追加するだけで、新規JSロジックを一切書かずに動作した。レイヤー検索(`#layer-search`)の対象である `.layers` 内の `.layer-item` クラスとは分離し(検索時にこのトグルが紛れて隠れる/表示されるのを避けるため)、`urlShareAdvisory` の直後、主題レイヤー一覧より上に独立した項目として配置した。

**このトグルはURLに永続化しない**: 主題レイヤーの表示/非表示トグル(既存)も同様に、現在の可視状態はMapIntentの`required_layers`/`optional_layers`とは独立したセッション内のみのUI状態であり、リロード/リンク共有では復元されない(`required`かどうかのみが初期可視性を決める)。bvmapトグルもこの既存の挙動に合わせた ── 新たに`#q=`/`#m=`へ可視状態を永続化するフィールドを追加する変更はしていない。トグル操作は`updateFragment()`を呼ぶ(既存の主題レイヤートグルと同じ)が、`buildShorthandFragment`/`buildCurrentIntentYaml`のいずれもレイヤー可視性を読み書きしないため、フラグメントの内容自体には影響しない。

**検証**: 本番相当ビルド(`npm run build && npm run preview`)で実機確認。チェックボックスの表示、クリックによるON/OFF切り替え、コンソールエラー無し(約120層への`setLayoutProperty`呼び出しが例外を投げないこと)、トグル後もURLフラグメントが正しい`#q=`のまま(D8)であることを確認した。

**Consequences**: `src/render.ts` のみ変更(HTMLテンプレートに1ブロック追加)。新規テストは追加していない ── この変更は純粋にDOM生成(`renderMapView`内のテンプレート文字列)であり、既存の `render.test.ts` は副作用のない純粋関数(`buildPopupHtml`等)のみを対象にしているため、同種のテストを書くには`MapLibreMap`のモックが要る(既存コードもその種のテストを持たない)。実機ブラウザ確認で代替した。

## D10: Staffの複数スタイル(源内・MCP・オープンウェブ)と、MCPスタイル(stdio・Workers版)の実装

**Status**: Accepted(MCPスタイルのstdio/Workers実装部分)/ Proposed(源内スタイル・オープンウェブスタイルは計画のみ、未実装)

**Context**: 現状、Staff(`UNopenGIS/staccato-spec`におけるMap Intent生成役)を生成AIに担わせる手段は、`hfu/layers-martin`の`STAFF_PROMPT.md`(約34,500字)をコピー&ペーストして渡す1通りしかなかった(「ノーマルスタイル」)。これには実務上の摩擦がある: 毎回プロンプトを探して貼る手間、`source_id`捏造のリスク(カタログをその場で引けない環境では特に)、そして本セッションで直接踏んだ不具合 ── 長い日本語の`goal`を含む`#q=`リンクをチャットで手渡すと、伝送経路のどこかでパーセントエンコードの境界を無視した打ち切りが起き、mojibake化する(D8/D9のfeedbackメモリ参照)。

ユーザーから、ノーマルスタイルに加えて3つの追加スタイルのフィージビリティ研究と実装の依頼があった:

1. **源内スタイル**: システムプロンプトは保存できるがインターネットに一切アクセスできないAI(デジタル庁のガバメントAI「源内」、AWS製OSS`Generative AI Use Cases (GenU)`ベース)向けに、カタログ情報を圧縮してプロンプトに埋め込む。
2. **MCPスタイル**: MCP対応の生成AI(Claude Desktop/Code、Cursor等)にツールとしてカタログ検索・リンク構築機能を供給する。
3. **オープンウェブスタイル**: Staff自体をブラウザ内で完結する最小LLMとして実装し、spiccatoと同じくGitHub Pagesでホストする。

検討の過程で「MCPサーバーを完全にスタティックに(GitHub Pagesのように)実装できないか」という問いが出たが、これは原理的に不可能と判断した: MCPの本体はJSON-RPCで、`tools/call`の引数(例: 検索クエリ)に応じてその場で計算した応答を返す必要があり、静的ファイル配信(URLパスに対して固定バイト列を返すだけ)ではPOSTボディの中身に応じた応答の出し分けができない。一方、「運用を持ちたくない」という志向であれば、Cloudflare Workers等のエッジ関数(gitにpushしたら勝手にデプロイされ、常時起動のサーバーが要らない)がその感覚に近いことが分かり、ユーザーの指示で**ローカルstdio版とCloudflare Workers版を、共有できるロジックは共有しながら同時に実装する**方針になった。

優先順位はユーザー確認済み: MCPスタイル(stdio・Workers両方)を先に実装し完成させてから源内スタイル、その後(Phase 1・2完成後)に限ってオープンウェブスタイルの「決定的検索+極小LLMでの意図解釈」という分解を深める。作業順序自体が質に影響するという判断による。詳細な検討過程・確認事項は`/Users/hfu/.claude/plans/scalable-snacking-spring.md`(計画ファイル)に記録した。

**Decision(MCPスタイル、実装済み)**:

`dwg7/spiccato`と同一リポジトリに`mcp/`(stdio版)・`worker/`(Cloudflare Workers版)を新設した。別リポジトリに切り出さなかった理由: `src/shorthand.ts`・`src/fragment.ts`はどちらも環境非依存の純粋関数(`CompressionStream`/`DecompressionStream`はNode 18+・Cloudflare Workers双方で標準搭載)であり、別リポジトリへのvendoringはこのプロジェクトが既に何度も踏んだ「コピーが元と乖離する」問題(D1・D5)を再現するだけになる。同一リポジトリ・相対importなら3箇所(SPA・stdio・Workers)に自動的に反映される。

- **`src/shorthand.ts`に`buildShorthandLink(intent)`を新設**。既存の`buildShorthandFragment(intent, live)`(D8、ライブ反映用、地図の現在ビューが前提)から、共通部分(intentの形が`#q=`に収まるかの判定+catalog/req/opt/bbox/name/goalの組み立て)を`buildShorthandParams`として抽出し、`buildShorthandFragment`はそこに`live`view由来のlat/lng/zoom/bearing/pitch/missing/unrenderableを足すだけ、新設の`buildShorthandLink`は`intent.render_hints`があればそれだけを足す(ライブビュー不要)、という構成にした。地図を一度も開いていない「これから開くリンク」を構築する、という新しいユースケース(spiccato-mcp)に対応するための必然的な拡張であり、`render.ts`側の既存動作(D8)は変更していない。
- **`mcp/src/server.ts`にトランスポート非依存のファクトリ`createSpiccatoServer(): McpServer`を実装**。4ツール(`list_catalogs`/`search_catalog`/`get_layer_info`/`build_spiccato_link`)を登録する。`mcp/src/catalog.ts`(カタログの実`fetch`+name/path/id部分一致検索、tiles/styles両対応)と`mcp/src/linkBuilder.ts`(`buildShorthandLink`優先・収まらなければ`fragment.ts`の`encodeIntentFragment`で`#m=`にフォールバック、`render.ts`の`updateFragment`(D8)と同じ判定ロジック)を呼ぶ。
- **`mcp/src/stdio.ts`**: `StdioServerTransport`に接続するだけのローカル実行用エントリポイント。`tsup`でNode向けにバンドル(`mcp/dist/stdio.js`)。
- **`worker/src/index.ts`**: 同じ`createSpiccatoServer()`を、SDKの`WebStandardStreamableHTTPServerTransport`(Web標準Request/Response、SDK自身のドキュメントコメントに"Cloudflare Workers usage"として明記されている)に接続する。**ステートレスモード**(`sessionIdGenerator: undefined`)を選択した ── 4ツールはすべて呼び出しごとに独立した無状態操作であり、セッション間で共有すべき状態が無いため、Cloudflareの`agents`パッケージ(Durable Objectsベースのセッション管理)は使わず、リクエストごとに`McpServer`とtransportを新規生成する最小構成にした。
- **型の互換性問題への対処**: `src/fragment.ts`の内部型`Bytes`(`Uint8Array<ArrayBuffer>`)は、DOM lib(SPA)・`@types/node`(`mcp/`)・`@cloudflare/workers-types`(`worker/`)という3種類のアンビエント型宣言の下で同時にコンパイルされることになった結果、`TextEncoder.encode()`の宣言される戻り値の型が環境によって異なる(Workers型では`Uint8Array<ArrayBufferLike>`)ことが判明した。`Bytes`自体を緩めると今度はDOM lib側の`CompressionStream`の引数型(`ArrayBufferView<ArrayBuffer>`)を満たせなくなるため、`Bytes`の定義はDOM lib向けのまま維持し、環境差が入り込む唯一の境界(`encodeIntentFragment`内の`new TextEncoder().encode(yaml)`の直後)にだけ`as Bytes`の明示キャストを置いた。実行時の挙動には影響しない、型宣言の食い違いを吸収するための最小限の措置。

**実機検証**: stdio版は`tsup`でビルドし、`StdioServerTransport`に対して生のJSON-RPCメッセージ(`initialize`→`tools/list`→`tools/call`)を子プロセス越しに送受信するテストスクリプトで、`search_catalog("地形分類")`→`build_spiccato_link`という一連の流れが実際のネットワーク越しに動作し、正しい`#q=`リンクを返すことを確認した。Workers版は`wrangler dev`でローカル起動し、同じ流れを`curl`でのHTTP POSTで再現、さらに複数カタログ(`required_styles`使用)で`#m=`フォールバックが正しく`deflate-raw`圧縮込みで動作することも確認した(Cloudflare Workersの`CompressionStream`が`'deflate-raw'`フォーマットに対応していることも合わせて確認できた)。どちらの経路で生成したリンクも、本番相当ビルド(`npm run preview`)で実際に開いて欠落レイヤー無し・コンソールエラー無しで描画されることを確認済み。

**Consequences**: `mcp/`・`worker/`をリポジトリに追加(それぞれ独立した`package.json`、Viteのビルド対象外)。`mcp/test/`にVitestテスト13件(`catalog.test.ts`・`linkBuilder.test.ts`、`fetch`をモック化)を追加。`src/shorthand.ts`の関数分割はリファクタリングであり、既存の`buildShorthandFragment`の外部動作(D8で確立した契約)は変更していない ── `src/shorthand.test.ts`に`buildShorthandLink`向けのテストを追加し、既存テストは全てそのまま通過することを確認した。源内スタイル・オープンウェブスタイルは計画段階のまま(別セッションで着手、`/Users/hfu/.claude/plans/scalable-snacking-spring.md`参照)。

## D11: `GENNAI_PROMPT.md` をフォーム画面から発見できるようにする

**Status**: Accepted(UI配線の判断は有効。取得元は同日中にD12で変更 — `hfu/layers-martin`からのfetchではなく、このリポジトリ自身がカタログから直接生成する方式になった。`scripts/fetch-gennai-prompt.mjs`は`scripts/build-gennai-prompt.mjs`に置き換えられ、`GENNAI_PROMPT.md`は`src/gennai-prompt.txt`経由ではなくリポジトリルートから直接importする形に変わったが、disclosure UI・Copyボタン・`extractStaffPromptBlock`再利用という設計自体はそのまま踏襲されている)

**Context**: `hfu/layers-martin`に`GENNAI_PROMPT.md`(D10、同リポジトリD28)を追加した後、ユーザーから「源内用のプロンプトはどこから手に入れるのか、README.mdには記載しているか」との指摘があった。確認したところ、`GENNAI_PROMPT.md`はどこからもリンクされていなかった: `hfu/layers-martin`のREADME.mdは`STAFF_PROMPT.md`の存在すら言及しておらず(この時点で既存の欠落)、spiccato自身のフォーム画面(「1. Prompt your AI」)は`STAFF_PROMPT.md`だけをビルド時に`scripts/fetch-staff-prompt.mjs`で取得して表示する構造になっており、`GENNAI_PROMPT.md`を取り込む経路が存在しなかった。実質的に、直接GitHubのファイル一覧を見るか、DECISIONS.md/HANDOVER.mdのような開発者向け文書を読むしか発見手段が無い状態だった。

**Decision**: 既存の`STAFF_PROMPT.md`取得の仕組みをそのまま複製する形で解決した。

- `scripts/fetch-gennai-prompt.mjs`を新設(`fetch-staff-prompt.mjs`と同一パターン、`hfu/layers-martin`の`GENNAI_PROMPT.md`をビルド時にfetchし`src/gennai-prompt.txt`へ保存、失敗時は既存スナップショットを保持)。`package.json`の`prebuild`で両方を実行する。
- `src/main.ts`で`gennai-prompt.txt?raw`をimportし、`renderFormView`に`gennaiPromptMarkdown`として渡す。
- `src/render.ts`の「1. Prompt your AI」カード内、既存の`STAFF_PROMPT.md`用`<details>`disclosureの直後に、2つ目の`<details>`("Using an AI with no internet access? (e.g. 源内)")を追加。専用のCopyボタン(`#copy-gennai-prompt`)を持つ。`extractStaffPromptBlock`関数は`` ````text ```` ``フェンスが無い入力に対して全文をtrimして返すフォールバックを既に持っていたため、`GENNAI_PROMPT.md`(フェンス無し、ファイル全体がそのままプロンプト)にもそのまま再利用できた ── 新しい抽出関数は書いていない。
- `hfu/layers-martin`のREADME.mdにも「Staffプロンプト」節を新設し、`STAFF_PROMPT.md`・`GENNAI_PROMPT.md`の両方と、spiccatoのフォーム画面へのリンクを追記した(README.mdがそもそも`STAFF_PROMPT.md`を言及していなかった欠落もあわせて解消)。spiccato自身のREADME.mdにも同様の相互参照を追記した。

**検証**: 本番相当ビルド(`npm run build && npm run preview`)で実機確認。2つ目のdisclosureが正しく表示され、開くと`GENNAI_PROMPT.md`の全文(3,965字、`.trim()`後)が表示されることを確認。Copyボタンの配線も既存の`#copy-staff-prompt`ボタンと同一の`copyToClipboard`関数を呼ぶことを確認した(自動化ブラウザ環境ではクリップボード権限が無く両ボタンとも"Copy failed"になるが、これは環境側の制約であり、既存ボタンも同じ挙動を示すことで新規コードに起因する問題ではないことを確認済み)。

**Consequences**: `scripts/fetch-gennai-prompt.mjs`・`src/gennai-prompt.txt`(fetchしたスナップショット、`src/staff-prompt.txt`と同様にリポジトリにコミットする運用を踏襲)を追加。`src/render.ts`の`renderFormView`のシグネチャに`gennaiPromptMarkdown`が必須で追加されたため、呼び出し元(`src/main.ts`)も更新した(呼び出し箇所は1つのみ)。

## D12: `GENNAI_PROMPT.md` をこのリポジトリへ移設し、全カタログ埋め込み版に作り直す

**Status**: Accepted

**Context**: D10・D11の時点で`GENNAI_PROMPT.md`は`hfu/layers-martin`側に置かれ(同リポジトリDECISIONS.md D28)、`STAFF_PROMPT.md`の既存文章を抜粋・圧縮した約4,000字の精選版だった(D23の「保守負荷とのバランス」判断を踏襲、頻出カテゴリのみ埋め込み)。この直後、ユーザーから2つの明確な方針転換があった:

1. **今回は`hfu/layers-martin`のD23判断を踏み越え、カタログを(既知のノイズ系統を除き)全件埋め込むべきである。** D23が懸念した保守負荷(手書きでは維持できない)は、生成を完全自動化する(手で編集しない、ビルドのたびに実カタログから再生成する)ことで解消できると判断した。
2. **`GENNAI_PROMPT.md`は`hfu/layers-martin`ではなく、このリポジトリ(`dwg7/spiccato`)に置くべきである。** 内容の大部分(`#q=`リンク構築規則)がspiccato固有のインタフェースに依存しており、特定のCartographer実装に依存しないLibraryであるべき`hfu/layers-martin`の立場([D21](https://github.com/hfu/layers-martin/blob/main/DECISIONS.md#d21) 参照、同種の判断)にそぐわなかった。

**Decision**:

- `hfu/layers-martin`から`GENNAI_PROMPT.md`を削除し、同リポジトリのD28を「Superseded」に変更した(移設の記録として、元の決定内容はそのまま残した)。
- このリポジトリに`scripts/build-gennai-prompt.mjs`を新設。`scripts/fetch-gennai-prompt.mjs`(D11、他リポジトリのファイルをそのまま取得するだけだった)を置き換える。新スクリプトは:
  - `layers-martin/catalog.json`・`stars.optgeo.org/catalog`を直接fetchし、`tiles`(source_id)・`styles`(style_id)を取得する。
  - **既知のノイズ系統を除外**する: `disasterhist_*`(地域別・年代別に細分化された災害履歴図シリーズ)、`*_liq`の4件(過去の液状化イラスト)、および今回の監査で新たに見つかった`\d{4}_\d{2}[-_]`パターンの60件(例: `1896_09_m29`=「明治29年9月降雨」、`1938_07_s13`=「阪神大水害」)── いずれも`STAFF_PROMPT.md`の「意味解決の指針」が警告する「過去の災害イラストが現在のリスクマップと混同されうる」問題に該当する。3つ目のパターンは`STAFF_PROMPT.md`に名指しで書かれていなかったため、除外前にユーザーに確認した。他の大きな系統(`gsjgeomap`地質図幅866件、`ndvi`月次植生指数105件、`vlcd`火山別データ37件等)は地理的・時間的に分割されているだけの正当な現行データであり、除外していない。
  - 残った全件(layers-martin 1,682件・stars-optgeo 7件)を`id|name`形式でそのまま埋め込む(pathは`catalog.json`自体に含まれないため埋め込めない — 候補が複数ある場合は`name`の語感で判断する旨をプロンプト内に明記した)。
  - `#q=`リンク構築規則・背景地図自動描画の注意・`required_styles`のYAML例など、カタログ以外の「プロセス」部分は引き続き手書きの定数として同スクリプト内に保持する(データ部分だけを自動生成し、指示文は人間が管理するという分担)。
  - 生成結果を`GENNAI_PROMPT.md`(リポジトリルート、`src/`ではない — `DECISIONS.md`/`HANDOVER.md`と同格の実体あるドキュメントという位置づけ)に書き込む。取得失敗時は既存スナップショットを保持する(`fetch-staff-prompt.mjs`と同じフォールバック方針)。
- `package.json`の`prebuild`を`fetch-gennai-prompt.mjs`から`build-gennai-prompt.mjs`に差し替え。
- `src/main.ts`のimportを`./gennai-prompt.txt?raw`から`../GENNAI_PROMPT.md?raw`(リポジトリルート直接import)に変更、`src/gennai-prompt.txt`は削除。
- `src/render.ts`の「Prompt source」リンクを`dwg7/spiccato`自身へ向け直した。disclosure UI・Copyボタン・`extractStaffPromptBlock`の再利用(D11で確立)自体は変更していない。

**規模**: 66,860字(layers-martin 1,682件 + stars-optgeo 7件)。D28時点の約4,000字から大幅に拡大した。この規模が実際の源内の上限に収まるかは未検証(ユーザーが別途確認予定)。

**検証**: 本番相当ビルド(`npm run build && npm run preview`)で実機確認。disclosureを開くと生成された全文(66,859字、`.trim()`後)が表示され、`20260729kumamoto_yatsushiro_0729do_sokuho`・`lcmfc2`等の実在idが含まれること、`disasterhist_*`・`\d{4}_\d{2}[-_]`パターンの実データ行が1件も含まれないこと(プロンプト説明文中の`disasterhist_*`という文字列自体はヒットするが、実データ行としては0件)を確認した。コンソールエラー無し。

**Consequences**: `hfu/layers-martin`はカタログ生成(`build_catalog.rb`)に専念する形に戻った(同リポジトリREADME.md/DECISIONS.md/HANDOVER.mdを更新済み)。このリポジトリの`prebuild`は毎回2つの外部カタログ(layers-martin・stars-optgeo)をfetchするようになり、ビルド時間・ネットワーク依存が増えた(既存の`STAFF_PROMPT.md`fetchと同種の依存が1つ増えただけで、新しいカテゴリのリスクではない)。`docs/index.html`のサイズが約94KB増加した(1,320KB→1,414KB、圧縮テキストの埋め込み分)。ノイズ除外パターンが将来また見つかった場合は、`scripts/build-gennai-prompt.mjs`の`NOISE_ID_PREFIXES`/`NOISE_ID_PATTERN`/`NOISE_IDS`に追記する運用とする。

## D13: `GENNAI_PROMPT.md` が実際に長すぎたため、サイズ優先で追加削減する

**Status**: Accepted

**Context**: D12公開後、ユーザーが手元のChatGPTに実際に読み込ませたところ、長すぎて読み込まれなかった(66,860字)。実機での失敗が確認されたため、レイヤーを追加で削減する必要が生じた。

ユーザーから「2016年までの災害関係情報と、`gsjgeomap`、`ndvi_`シリーズは割愛しようか」と提案があった。`gsjgeomap`(866件、5万分の1地質図幅)・`ndvi_`(105件、月次植生指数)は具体的なidパターンとして明確だったが、「2016年までの災害関係情報」は`name`に年+災害関連キーワードが入っている想定で検索しても0件だった。ユーザーに実例を提示してもらったところ、`20130717dol`・`20240102_noto_suzu_0114do`のような**8桁日付プレフィックスの災害対応速報画像**(GSIの命名規則で、`20260729kumamoto_yatsushiro_0729do_sokuho`(熊本地震フラグシップ例)と同一系統)を指していたと判明。この系統は1948〜2026年に259件存在し、単純に「全部除外」すると熊本地震の例自体も失われ、「年より古いものだけ除外」だと能登半島地震(2024年)のような比較的最近の実績も失われるというトレードオフがあったため、カットオフ年をユーザーに確認した。

**Decision**: `scripts/build-gennai-prompt.mjs`の`isNoise`にD12の3条件に加えて2条件を追加した。

- **`NOISE_ID_PREFIXES`に`gsjgeomap`・`ndvi_`を追加**。これらはD12の「意味的ノイズ(過去の災害と現在のリスクの混同)」とは性質が異なり、内容は正当な現行データ(地質図幅・植生指数)だが、埋め込みサイズの都合で除外する。D12で確認済みの通り、地理的・時間的に分割されているだけで内容自体は正当。
- **`DISASTER_SNAPSHOT_ID_PATTERN`(`^(19|20)\d{6}`、8桁日付プレフィックス)+`DISASTER_SNAPSHOT_MIN_YEAR = 2020`**: 2020年より前の日付を持つ災害対応速報画像系のidを除外する。2020年以降(能登半島地震2024・熊本地震2026を含む、約47件)は維持する。

**結果**: 66,860字(layers-martin 1,682件+stars-optgeo 7件)→ **17,870字**(layers-martin 501件+stars-optgeo 7件)。約73%削減。

**検証**: 再生成後、本番相当ビルド(`npm run build && npm run preview`)で実機確認。`gsjgeomap`/`ndvi_`の実データ行が0件、2020年より前の災害対応速報画像(例: `20130717dol`)が0件である一方、熊本地震(`20260729kumamoto_yatsushiro_0729do_sokuho`)・能登半島地震(`20240102_noto_*`)・既存の主要例(`lcmfc2`・`terrainclassification1`・`01_flood_l2_shinsuishin_data`)は引き続き含まれることを確認した。コンソールエラー無し。

**Consequences**: `docs/index.html`のサイズがD12時点(1,340KB)から縮小した(D10時点の1,320KBに近い水準に戻った)。実際に源内(またはChatGPT等)が読み込める上限は依然未検証 — 17,870字でも大きい場合、`DISASTER_SNAPSHOT_MIN_YEAR`を引き上げる、または`gsjgeomap`/`ndvi_`と同様の「サイズ優先の除外」対象をさらに広げる、といった追加調整の余地を残す。除外パターンが増えるたびに`scripts/build-gennai-prompt.mjs`のコメントに理由(意味的ノイズかサイズかを明記)を追記する運用とする。
