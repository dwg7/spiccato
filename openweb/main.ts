import { extractKeyword } from './llm.ts';
import { geocodeAreaName } from './geocode.ts';
import { searchCatalog, KNOWN_CATALOGS, type CatalogSearchHit, type KnownCatalog } from '../mcp/src/catalog.ts';
import { buildSpiccatoLink } from '../mcp/src/linkBuilder.ts';

// DECISIONS.md D16: feasibility prototype for Style 3 (open web), now
// covering all four decomposition steps from the plan file -- question ->
// LLM keyword extraction (llm.ts) -> deterministic catalog search
// (mcp/src/catalog.ts) -> human-picked candidates -> deterministic
// geocoding (geocode.ts) + #q=/#m= link construction (mcp/src/
// linkBuilder.ts, reused as-is from the MCP style, D10's established
// cross-surface sharing pattern). The candidate checkboxes are deliberately
// the point where a human corrects for the LLM's still-unreliable keyword
// extraction (D16 2026-08-13: the deterministic search layer itself was
// fixed, but the LLM step wasn't) -- this is exactly the "決定的検索+人間が
// 候補を選ぶUI" division of labor the plan file called for.

interface Hit extends CatalogSearchHit {
  catalog: KnownCatalog;
}

const app = document.getElementById('app');
if (!app) throw new Error('#app root element not found');

app.innerHTML = `
<div class="wrap">
  <div class="card">
    <h1>Spiccato -- Open Web Style (prototype)</h1>
    <p>Staffの役割をブラウザ内だけで完結させる「オープンウェブスタイル」のプロトタイプです。
    質問を書くと、ブラウザ内で動く小さなAIが検索キーワードを1つ抜き出し、実カタログ(layers-martin・stars-optgeo)を検索して候補を表示します。
    表示された候補から使うものにチェックを入れ、必要なら地域名を添えてリンクを作成してください。初回はモデル(約480MB)のダウンロードが発生します。</p>
  </div>
  <div class="card">
    <input type="text" id="question" placeholder="例: 令和8年熊本地震の被害状況が知りたい">
    <p><button id="search" type="button" class="dads-button" data-type="solid-fill" data-size="md">検索</button></p>
    <div class="status" id="status"></div>
    <ul class="hits" id="hits"></ul>
  </div>
  <div class="card">
    <h2 class="card-step">候補からリンクを作る</h2>
    <p>上のチェックボックスで選んだ候補を使って、spiccatoのリンクを作ります。地域名は任意(国土地理院のジオコーディングでおおまかな範囲を推定します)。</p>
    <input type="text" id="area-name" placeholder="地域名(任意、例: 石狩川下流域)">
    <p><button id="build-link" type="button" class="dads-button" data-type="outline" data-size="md">リンクを作成</button></p>
    <div class="status" id="link-status"></div>
    <div id="link-result"></div>
  </div>
</div>`;

const questionInput = app.querySelector<HTMLInputElement>('#question')!;
const searchButton = app.querySelector<HTMLButtonElement>('#search')!;
const statusDiv = app.querySelector<HTMLElement>('#status')!;
const hitsList = app.querySelector<HTMLUListElement>('#hits')!;
const areaNameInput = app.querySelector<HTMLInputElement>('#area-name')!;
const buildLinkButton = app.querySelector<HTMLButtonElement>('#build-link')!;
const linkStatusDiv = app.querySelector<HTMLElement>('#link-status')!;
const linkResultDiv = app.querySelector<HTMLElement>('#link-result')!;

let currentHits: Hit[] = [];

function escapeHtml(s: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return s.replace(/[&<>"']/g, (c) => map[c]!);
}

function renderHits(hits: Hit[]): void {
  currentHits = hits;
  if (hits.length === 0) {
    hitsList.innerHTML = '';
    return;
  }
  hitsList.innerHTML = hits
    .map(
      (h, i) =>
        `<li>` +
        `<label><input type="checkbox" data-hit-index="${i}"> <code>${escapeHtml(h.kind)}</code> <strong>${escapeHtml(h.name)}</strong></label><br>` +
        `<code>${escapeHtml(h.id)}</code> <span class="catalog-tag">${escapeHtml(h.catalog.id)}</span>` +
        (h.path && h.path.length > 0 ? `<br><span>${h.path.map(escapeHtml).join(' / ')}</span>` : '') +
        `</li>`
    )
    .join('');
}

async function runSearch(): Promise<void> {
  const question = questionInput.value.trim();
  if (question === '') return;

  searchButton.disabled = true;
  renderHits([]);
  try {
    const keyword = await extractKeyword(question, (status) => {
      statusDiv.textContent = `モデル準備中... ${status}`;
    });
    statusDiv.textContent = `抽出したキーワード:「${keyword}」で検索中...`;

    const results = await Promise.all(
      KNOWN_CATALOGS.map(async (catalog) => {
        const hits = await searchCatalog(catalog.uri, keyword).catch(() => [] as CatalogSearchHit[]);
        return hits.map((h): Hit => ({ ...h, catalog }));
      })
    );
    const hits = results.flat();

    statusDiv.textContent = `キーワード「${keyword}」で${hits.length}件ヒットしました。使うものにチェックを入れてください。`;
    renderHits(hits);
  } catch (err) {
    statusDiv.textContent = `エラー: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    searchButton.disabled = false;
  }
}

async function runBuildLink(): Promise<void> {
  const checked = Array.from(hitsList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked'));
  const selected = checked
    .map((c) => currentHits[Number(c.dataset.hitIndex)])
    .filter((h): h is Hit => h !== undefined);

  if (selected.length === 0) {
    linkStatusDiv.textContent = '候補を1件以上選んでください。';
    linkResultDiv.innerHTML = '';
    return;
  }

  buildLinkButton.disabled = true;
  linkResultDiv.innerHTML = '';
  try {
    const catalogsUsed = new Map<string, KnownCatalog>();
    for (const hit of selected) catalogsUsed.set(hit.catalog.uri, hit.catalog);

    const requiredLayers = selected.filter((h) => h.kind === 'tile').map((h) => ({ source_id: h.id, label: h.name }));
    const requiredStyles = selected.filter((h) => h.kind === 'style').map((h) => ({ style_id: h.id, label: h.name }));

    const areaName = areaNameInput.value.trim();
    let bbox: [number, number, number, number] | null = null;
    if (areaName !== '') {
      linkStatusDiv.textContent = `「${areaName}」の位置を調べています...`;
      bbox = await geocodeAreaName(areaName).catch(() => null);
    }

    const result = await buildSpiccatoLink({
      catalogs: Array.from(catalogsUsed.values()).map((c) => ({ id: c.id, type: c.type, uri: c.uri })),
      required_layers: requiredLayers.length > 0 ? requiredLayers : undefined,
      required_styles: requiredStyles.length > 0 ? requiredStyles : undefined,
      area: areaName !== '' ? { name: areaName, ...(bbox ? { bbox } : {}) } : undefined
    });

    linkStatusDiv.textContent =
      areaName === ''
        ? 'リンクを作成しました。'
        : bbox
          ? `リンクを作成しました(「${areaName}」の位置を推定して範囲に反映しました)。`
          : `リンクを作成しました(「${areaName}」の位置は特定できなかったため、範囲は指定していません)。`;
    linkResultDiv.innerHTML = `<a href="${escapeHtml(result.url)}" target="_blank" rel="noreferrer">${escapeHtml(result.url)}</a>`;
  } catch (err) {
    linkStatusDiv.textContent = `エラー: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    buildLinkButton.disabled = false;
  }
}

searchButton.addEventListener('click', () => {
  void runSearch();
});
questionInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') void runSearch();
});
buildLinkButton.addEventListener('click', () => {
  void runBuildLink();
});
