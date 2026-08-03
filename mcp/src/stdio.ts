#!/usr/bin/env node
// Local entrypoint: runs createSpiccatoServer() over stdio, for MCP hosts
// that spawn a local child process (Claude Desktop/Code, Cursor, etc. via
// `npx spiccato-mcp` or a direct path in .mcp.json). See DECISIONS.md D10.
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createSpiccatoServer } from './server.ts';

async function main() {
  const server = createSpiccatoServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error('spiccato-mcp failed to start:', e);
  process.exit(1);
});
