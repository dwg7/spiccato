import { extractKeyword } from './llm.ts';
import { searchCatalog, KNOWN_CATALOGS, type CatalogSearchHit } from '../mcp/src/catalog.ts';

// DECISIONS.md D16: minimal feasibility prototype for Style 3 (open web).
// Deliberately a single straight-line flow -- question -> LLM keyword
// extraction (llm.ts) -> deterministic catalog search (mcp/src/catalog.ts,
// reused as-is, D10's established cross-surface sharing pattern) -> a
// read-only candidate list. No geocoding, no candidate selection, no #q=
// link construction yet -- those are the plan file's remaining two
// decomposition steps, deferred until this step proves out.

const app = document.getElementById('app');
if (!app) throw new Error('#app root element not found');

app.innerHTML = `
<div class="wrap">
  <div class="card">
    <h1>Spiccato -- Open Web Style (prototype)</h1>
    <p>Staffの役割をブラウザ内だけで完結させる「オープンウェブスタイル」の最小限プロトタイプです。
    質問を書くと、ブラウザ内で動く小さなAIが検索キーワードを1つ抜き出し、実カタログ(layers-martin・stars-optgeo)を検索して候補を表示します。
    まだリンク構築・座標解決は行いません(DECISIONS.md D16参照)。初回はモデル(約480MB)のダウンロードが発生します。</p>
  </div>
  <div class="card">
    <input type="text" id="question" placeholder="例: 令和8年熊本地震の被害状況が知りたい">
    <p><button id="search" type="button" class="dads-button" data-type="solid-fill" data-size="md">検索</button></p>
    <div class="status" id="status"></div>
    <ul class="hits" id="hits"></ul>
  </div>
</div>`;

const questionInput = app.querySelector<HTMLInputElement>('#question')!;
const searchButton = app.querySelector<HTMLButtonElement>('#search')!;
const statusDiv = app.querySelector<HTMLElement>('#status')!;
const hitsList = app.querySelector<HTMLUListElement>('#hits')!;

function escapeHtml(s: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return s.replace(/[&<>"']/g, (c) => map[c]!);
}

function renderHits(hits: CatalogSearchHit[]): void {
  if (hits.length === 0) {
    hitsList.innerHTML = '';
    return;
  }
  hitsList.innerHTML = hits
    .map(
      (h) =>
        `<li><code>${escapeHtml(h.kind)}</code> <strong>${escapeHtml(h.name)}</strong><br>` +
        `<code>${escapeHtml(h.id)}</code>` +
        (h.path && h.path.length > 0 ? `<br><span>${h.path.map(escapeHtml).join(' / ')}</span>` : '') +
        `</li>`
    )
    .join('');
}

async function runSearch(): Promise<void> {
  const question = questionInput.value.trim();
  if (question === '') return;

  searchButton.disabled = true;
  hitsList.innerHTML = '';
  try {
    const keyword = await extractKeyword(question, (status) => {
      statusDiv.textContent = `モデル準備中... ${status}`;
    });
    statusDiv.textContent = `抽出したキーワード:「${keyword}」で検索中...`;

    const results = await Promise.all(
      KNOWN_CATALOGS.map((catalog) => searchCatalog(catalog.uri, keyword).catch(() => [] as CatalogSearchHit[]))
    );
    const hits = results.flat();

    statusDiv.textContent = `キーワード「${keyword}」で${hits.length}件ヒットしました。`;
    renderHits(hits);
  } catch (err) {
    statusDiv.textContent = `エラー: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    searchButton.disabled = false;
  }
}

searchButton.addEventListener('click', () => {
  void runSearch();
});
questionInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') void runSearch();
});
