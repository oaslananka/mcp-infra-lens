#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { registerToolsOnServer } from './server-core.js';
import { createStdioShutdownHandler } from './shutdown.js';
import { getPackageVersion } from './version.js';

export async function createStdioServer(): Promise<McpServer> {
  const server = new McpServer(
    {
      name: 'mcp-infra-lens',
      version: getPackageVersion()
    },
    {
      capabilities: {
        logging: {}
      }
    }
  );

  registerToolsOnServer(server);
  return server;
}

const server = await createStdioServer();
const transport = new StdioServerTransport();
await server.connect(transport);

const shutdown = createStdioShutdownHandler(server);
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
