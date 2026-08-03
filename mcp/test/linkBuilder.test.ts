import { describe, expect, it } from 'vitest';
import { buildSpiccatoLink } from '../src/linkBuilder.ts';

const LAYERS_MARTIN = 'https://hfu.github.io/layers-martin/catalog.json';
const STARS_OPTGEO = 'https://stars.optgeo.org/catalog';

describe('buildSpiccatoLink', () => {
  it('builds a short #q= link for a single catalog with only layers', async () => {
    const result = await buildSpiccatoLink({
      catalogs: [{ uri: LAYERS_MARTIN }],
      required_layers: [{ source_id: 'lcmfc2' }],
      area: { name: '石狩川下流域' }
    });
    expect(result.format).toBe('q');
    expect(result.url.startsWith('https://dwg7.github.io/spiccato/#q=')).toBe(true);
    expect(result.url).toContain('req=lcmfc2');
    expect(result.url).not.toContain('goal='); // omitted goal should stay omitted, not encoded as empty
  });

  it('falls back to #m= when required_styles is used', async () => {
    const result = await buildSpiccatoLink({
      catalogs: [{ id: 'stars-optgeo', type: 'martin', uri: STARS_OPTGEO }],
      required_styles: [{ style_id: 'vlcm', label: '火山土地条件図' }]
    });
    expect(result.format).toBe('m');
    expect(result.url.startsWith('https://dwg7.github.io/spiccato/#m=')).toBe(true);
  });

  it('falls back to #m= when more than one catalog is given', async () => {
    const result = await buildSpiccatoLink({
      catalogs: [{ uri: LAYERS_MARTIN }, { id: 'stars-optgeo', type: 'martin', uri: STARS_OPTGEO }],
      required_layers: [{ source_id: 'lcmfc2' }]
    });
    expect(result.format).toBe('m');
  });

  it('includes render_hints as lat/lng/zoom in the #q= link when provided', async () => {
    const result = await buildSpiccatoLink({
      catalogs: [{ uri: LAYERS_MARTIN }],
      required_layers: [{ source_id: 'terrainclassification1' }],
      render_hints: { center: [135.805, 34.685], zoom: 14 }
    });
    expect(result.format).toBe('q');
    expect(result.url).toContain('lat=34.685');
    expect(result.url).toContain('lng=135.805');
    expect(result.url).toContain('zoom=14');
  });

  it('rejects an intent with no layers or styles at all', async () => {
    await expect(buildSpiccatoLink({ catalogs: [{ uri: LAYERS_MARTIN }] })).rejects.toThrow();
  });

  it('rejects an empty catalogs array', async () => {
    await expect(buildSpiccatoLink({ catalogs: [], required_layers: [{ source_id: 'x' }] })).rejects.toThrow();
  });
});
