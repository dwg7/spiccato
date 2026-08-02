# Spiccato

Open a link, see the map. Spiccato reads a small YAML/JSON description of what to show ("Map Intent") straight from the URL and renders it — no paste, no server, no AI in the render path. Third-generation renderer for the staccato open-mapping architecture.

## 日本語

リンクを開くだけで地図が表示される。Spiccatoは「何を表示するか」を記した小さなYAML/JSONファイル（Map Intent）をURLから直接読み取り、そのまま描画する——コピー&ペースト不要、サーバー不要、描画そのものにAIも使わない。オープンな地図共有の仕組み「staccato」の第三世代レンダラー。

## Live site

<https://dwg7.github.io/spiccato/>

## What this is

A Map Intent (a small YAML document describing what layers/styles to show, over which area) is encoded straight into the URL fragment (`#m=...`). Opening that URL renders the map immediately — no paste step. As you pan, zoom, or toggle layers, the URL keeps reflecting the current state, so the address bar itself is always a valid, reopenable link. See [DECISIONS.md](DECISIONS.md) for why this is a deliberate departure from [`hfu/faceless-cartographer`](https://github.com/hfu/faceless-cartographer) (the 2nd-generation Cartographer this project is vendored from), which keeps the URL state-free by design.

A form for pasting a Map Intent by hand is still available as a fallback (e.g. for testing a Staff prompt manually) — see the site itself.

## Development

```bash
npm install
npm run dev        # local dev server
npm run typecheck
npm test
npm run build       # outputs to docs/, served by GitHub Pages
```

## Provenance

Map Intent parsing, catalog resolution, and MapLibre style construction (`src/types.ts`, `src/mapIntent.ts`, `src/catalog.ts`, `src/style.ts`, `src/base-style.json`) are vendored from `hfu/faceless-cartographer`. The URL fragment codec and live-reflection logic (`src/fragment.ts`, `src/main.ts`, `src/render.ts`) are rewritten for this repository — see [DECISIONS.md](DECISIONS.md) D1–D3.

## License

CC0 1.0 Universal — see [LICENSE](LICENSE).
