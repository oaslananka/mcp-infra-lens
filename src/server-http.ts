import { createServer, type IncomingMessage } from 'node:http';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { createLogger } from './logging.js';
import { registerToolsOnServer } from './server-core.js';
import { createHttpShutdownHandler } from './shutdown.js';
import { getPackageVersion } from './version.js';

const logger = createLogger('server-http');

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      if (chunks.length === 0) {
        resolve(undefined);
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
    request.on('error', (error) => {
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

async function createHttpTransport() {
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

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });

  await server.connect(transport);
  return transport;
}

const host = process.env.HOST ?? '127.0.0.1';
const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const transport = await createHttpTransport();

const httpServer = createServer((request, response) => {
  void (async () => {
    try {
      const parsedBody =
        request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH'
          ? await readJsonBody(request)
          : undefined;

      await transport.handleRequest(request, response, parsedBody);
    } catch (error) {
      response.statusCode = 500;
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unexpected server error'
        })
      );
    }
  })();
});

httpServer.listen(port, host, () => {
  logger.info(`mcp-infra-lens HTTP transport listening on http://${host}:${port}`);
});

const shutdown = createHttpShutdownHandler(httpServer, transport);
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
