// Remote MCP transport for the same tools mcp/src/stdio.ts exposes locally,
// deployed on Cloudflare Workers. Stateless: WebStandardStreamableHTTPServerTransport
// is configured with sessionIdGenerator: undefined because all four tools
// (list_catalogs/search_catalog/get_layer_info/build_spiccato_link) are
// idempotent, request-scoped operations with nothing to remember between
// calls -- so there's no need for Durable Objects/session state, just a
// fresh server+transport pair per request. See DECISIONS.md D10 for why
// this exists alongside the stdio version (mcp/src/stdio.ts), and why both
// share createSpiccatoServer() (mcp/src/server.ts) unmodified.
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createSpiccatoServer } from '../../mcp/src/server.ts';

const INFO_TEXT =
  'spiccato-mcp (Cloudflare Workers, Streamable HTTP)\n\nPOST JSON-RPC 2.0 (MCP) requests to /mcp.\nSee https://github.com/dwg7/spiccato/tree/main/worker\n';

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/mcp') {
      return new Response(INFO_TEXT, {
        status: url.pathname === '/' ? 200 : 404,
        headers: { 'content-type': 'text/plain; charset=utf-8' }
      });
    }

    const server = createSpiccatoServer();
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    return transport.handleRequest(request);
  }
} satisfies ExportedHandler;
