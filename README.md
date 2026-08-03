# Spiccato

Open a link, see the map. Spiccato reads a small YAML/JSON description of what to show ("Map Intent") straight from the URL and renders it — no paste, no server, no AI in the render path. Third-generation renderer for the staccato open-mapping architecture.

## 日本語

リンクを開くだけで地図が表示される。Spiccatoは「何を表示するか」を記した小さなYAML/JSONファイル（Map Intent）をURLから直接読み取り、そのまま描画する——コピー&ペースト不要、サーバー不要、描画そのものにAIも使わない。オープンな地図共有の仕組み「staccato」の第三世代レンダラー。

## Live site

<https://dwg7.github.io/spiccato/>

## What this is

A Map Intent (a small YAML document describing what layers/styles to show, over which area) is encoded straight into the URL fragment. Opening that URL renders the map immediately — no paste step. As you pan, zoom, or toggle layers, the URL keeps reflecting the current state, so the address bar itself is always a valid, reopenable link. See [DECISIONS.md](DECISIONS.md) for why this is a deliberate departure from [`hfu/faceless-cartographer`](https://github.com/hfu/faceless-cartographer) (the 2nd-generation Cartographer this project is vendored from), which keeps the URL state-free by design.

Two link formats are supported:

- **`#q=`** — a plain query-string shorthand (`catalog=...&req=id1,id2&opt=id3&bbox=w,s,e,n&lat=...&lng=...&zoom=...`), no encoding step at all. This is the format a Staff agent without code execution should reach for: just literal, already-verified `source_id`s and plain numbers dropped into a template. See [DECISIONS.md](DECISIONS.md) D6/D8.
- **`#m=`** — the full Map Intent, `CompressionStream`-compressed and base64url-encoded, for cases the shorthand doesn't cover (multiple catalogs, `required_styles`/`optional_styles`, an explicit `sharing_policy` override). Needs a code-execution-capable Staff to construct. See [DECISIONS.md](DECISIONS.md) D3. Live reflection (pan/zoom/layer toggles) stays on `#q=` when the intent's shape fits and only falls back to `#m=` otherwise (D8).

A form for pasting a Map Intent by hand is still available as a fallback (e.g. for testing a Staff prompt manually, or when neither link format is buildable) — see the site itself. That form's "1. Prompt your AI" step offers two copy-pastable Staff prompts, both sourced live from `hfu/layers-martin` at build time: the normal [STAFF_PROMPT.md](https://github.com/hfu/layers-martin/blob/main/STAFF_PROMPT.md) (needs the AI to fetch the catalog itself) and the tight, offline-only [GENNAI_PROMPT.md](https://github.com/hfu/layers-martin/blob/main/GENNAI_PROMPT.md) (for AI that can save a system prompt but has no internet access, e.g. 源内 — see [DECISIONS.md](DECISIONS.md) D10).

## Development

```bash
npm install
npm run dev        # local dev server
npm run typecheck
npm test
npm run build       # outputs to docs/, served by GitHub Pages
```

## MCP server (Staff as a tool, not a prompt)

`mcp/` and `worker/` expose the same four tools (`list_catalogs`, `search_catalog`, `get_layer_info`, `build_spiccato_link`) over two transports, sharing the same core logic (`mcp/src/server.ts`, `mcp/src/catalog.ts`, `mcp/src/linkBuilder.ts`, which itself reuses `src/shorthand.ts`/`src/fragment.ts` unmodified):

- **`mcp/`** — local stdio server for MCP hosts that spawn a local process (Claude Desktop/Code, Cursor, etc.):
  ```bash
  cd mcp && npm install && npm run build
  # then point your MCP client at: node mcp/dist/stdio.js
  ```
- **`worker/`** — the same tools over remote Streamable HTTP, deployable to Cloudflare Workers (stateless — no Durable Objects, a fresh server per request, since all four tools are idempotent):
  ```bash
  cd worker && npm install && npm run dev     # local: POST to http://localhost:8787/mcp
  npm run deploy                                # ships to <name>.workers.dev
  ```

This is the "MCP style" of using Staff (as opposed to pasting `STAFF_PROMPT.md` into a chat) — see [DECISIONS.md](DECISIONS.md) D10 for the rationale, and for why a tool-returned link is structurally immune to the hand-typed-URL mojibake failure mode D8/D9's own history ran into.

## Provenance

Map Intent parsing, catalog resolution, and MapLibre style construction (`src/types.ts`, `src/mapIntent.ts`, `src/catalog.ts`, `src/style.ts`, `src/base-style.json`) are vendored from `hfu/faceless-cartographer`. The URL fragment codecs and live-reflection logic (`src/fragment.ts`, `src/shorthand.ts`, `src/main.ts`, `src/render.ts`) are rewritten for this repository — see [DECISIONS.md](DECISIONS.md) D1–D3, D6.

## License

CC0 1.0 Universal — see [LICENSE](LICENSE).
