import type { Server as HttpServer } from 'node:http';

import { createLogger } from './logging.js';

export interface AsyncCloseable {
  close(): Promise<void> | void;
}

export interface HttpTransportLike {
  close?(): Promise<void> | void;
}

type ExitHandler = (code: number) => void;

const stdioLogger = createLogger('mcp');
const httpLogger = createLogger('server-http');

export function createStdioShutdownHandler(
  server: AsyncCloseable,
  exit: ExitHandler = (code) => process.exit(code)
): (signal: string) => void {
  return (signal: string) => {
    stdioLogger.info(`Received ${signal}, shutting down`);
    Promise.resolve(server.close()).then(
      () => exit(0),
      () => exit(1)
    );
  };
}

export function createHttpShutdownHandler(
  httpServer: HttpServer,
  transport: HttpTransportLike,
  exit: ExitHandler = (code) => process.exit(code),
  timeoutMs = 10_000
): (signal: string) => void {
  return (signal: string) => {
    httpLogger.info(`Received ${signal}, shutting down`);

    const timeout = setTimeout(() => {
      exit(1);
    }, timeoutMs);
    timeout.unref();

    httpServer.close(() => {
      clearTimeout(timeout);
      Promise.resolve(transport.close?.()).then(
        () => exit(0),
        () => exit(1)
      );
    });
  };
}
