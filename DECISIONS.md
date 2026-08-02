# DECISIONS.md

`spiccato` の設計判断を ADR (Architecture Decision Record) 形式で記録する。実装は `src/*.ts` を正とし、ここでは判断の理由のみを記録する。

## 目次

| # | タイトル | Status | Date |
|---|---|---|---|
| [D1](#d1-第三世代hfu-faceless-cartographer第二世代からの系譜と何を引き継いだか) | 第三世代 — hfu/faceless-cartographer(第二世代)からの系譜と、何を引き継いだか | Accepted | 2026-08-03 |
| [D2](#d2-url-に状態を持たせることを既定にするadr-0001からの意図的な転換) | URL に状態を持たせることを既定にする(ADR 0001からの意図的な転換) | Accepted | 2026-08-03 |
| [D3](#d3-フラグメントのエンコードはcompressionstreamによるdeflate圧縮--base64url自前実装は持たない) | フラグメントのエンコードは`CompressionStream`によるdeflate圧縮 + base64url(自前実装は持たない) | Accepted | 2026-08-03 |
| [D4](#d4-プライバシー情報管理上の分析) | プライバシー・情報管理上の分析 | Accepted | 2026-08-03 |

---

## D1: 第三世代 — hfu/faceless-cartographer(第二世代)からの系譜と、何を引き継いだか

**Status**: Accepted

**Context**: このリポジトリは、`hfu/faceless-cartographer`(staccato アーキテクチャにおける Cartographer の第二世代実装)と同じ著者による、同じ `UNopenGIS/staccato-spec` を対象とした第三世代実装である。命名の由来: `spiccato`(スピッカート)は弦楽器の跳ね弓奏法で、`staccato`(音を切り離す)と同じ系統だが、弓を弦から跳ね上げることでより極端に音を分離させる。今回の変更は「アーキテクチャ(4者モデル、Cartographerの決定的描画)は変えず、原則(URLに状態を持たせない、という制約)をより大胆に押し進める・あるいは転換する」という位置づけであり、staccatoと対立する概念(legato等)ではなく、staccatoの先鋭化として選んだ。

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
