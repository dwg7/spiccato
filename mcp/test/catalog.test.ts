import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLayerInfo, searchCatalog } from '../src/catalog.ts';

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 404,
    statusText: ok ? 'OK' : 'Not Found',
    json: async () => body
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('searchCatalog', () => {
  const catalogDoc = {
    tiles: {
      lcmfc2: { name: '治水地形分類図', path: ['土地の成り立ち・土地利用'] },
      '01_flood_l2_shinsuishin_data': { name: '洪水浸水想定区域(想定最大規模)', path: ['災害リスク情報'] }
    },
    styles: {
      vlcm: { name: '火山土地条件図', path: ['火山'] }
    }
  };

  it('matches by name substring and reports kind', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(catalogDoc)));
    const hits = await searchCatalog('https://example.org/catalog.json', '地形分類');
    expect(hits).toEqual([{ kind: 'tile', id: 'lcmfc2', name: '治水地形分類図', path: ['土地の成り立ち・土地利用'] }]);
  });

  it('matches by source_id substring even if the name does not match', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(catalogDoc)));
    const hits = await searchCatalog('https://example.org/catalog.json', 'lcmfc2');
    expect(hits.map((h) => h.id)).toEqual(['lcmfc2']);
  });

  it('finds styles too, tagged with kind "style"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(catalogDoc)));
    const hits = await searchCatalog('https://example.org/catalog.json', '火山');
    expect(hits).toEqual([{ kind: 'style', id: 'vlcm', name: '火山土地条件図', path: ['火山'] }]);
  });

  it('returns an empty array (not a fabricated guess) when nothing matches', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(catalogDoc)));
    const hits = await searchCatalog('https://example.org/catalog.json', '存在しないキーワード');
    expect(hits).toEqual([]);
  });

  it('throws when the catalog fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(null, false)));
    await expect(searchCatalog('https://example.org/catalog.json', 'x')).rejects.toThrow(/404/);
  });
});

describe('getLayerInfo', () => {
  it('strips the /catalog(.json) suffix and fetches {base}/{source_id}', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ name: '治水地形分類図' }));
    vi.stubGlobal('fetch', fetchMock);
    const info = await getLayerInfo('https://hfu.github.io/layers-martin/catalog.json', 'lcmfc2');
    expect(info).toEqual({ name: '治水地形分類図' });
    expect(fetchMock).toHaveBeenCalledWith('https://hfu.github.io/layers-martin/lcmfc2');
  });

  it('returns null for a 404', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(null, false)));
    const info = await getLayerInfo('https://example.org/catalog.json', 'nonexistent');
    expect(info).toBeNull();
  });
});
