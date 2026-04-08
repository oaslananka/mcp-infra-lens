import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { createHttpShutdownHandler, createStdioShutdownHandler } from '../../src/shutdown.js';

afterEach(() => {
  jest.useRealTimers();
});

describe('shutdown handlers', () => {
  it('closes the stdio server and exits cleanly', async () => {
    const close = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const exit = jest.fn<(code: number) => void>();
    const shutdown = createStdioShutdownHandler({ close }, exit);

    shutdown('SIGINT');
    await Promise.resolve();

    expect(close).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('returns exit code 1 when stdio shutdown fails', async () => {
    const close = jest.fn<() => Promise<void>>().mockRejectedValue(new Error('close failed'));
    const exit = jest.fn<(code: number) => void>();
    const shutdown = createStdioShutdownHandler({ close }, exit);

    shutdown('SIGTERM');
    await Promise.resolve();

    expect(exit).toHaveBeenCalledWith(1);
  });

  it('closes the HTTP server and transport before exiting', async () => {
    const transportClose = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const exit = jest.fn<(code: number) => void>();
    const httpServer = {
      close(callback: () => void) {
        callback();
        return this;
      }
    };

    const shutdown = createHttpShutdownHandler(
      httpServer as never,
      { close: transportClose },
      exit,
      10_000
    );

    shutdown('SIGTERM');
    await Promise.resolve();

    expect(transportClose).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('returns exit code 1 when the HTTP transport close fails', async () => {
    const exit = jest.fn<(code: number) => void>();
    const httpServer = {
      close(callback: () => void) {
        callback();
        return this;
      }
    };

    const shutdown = createHttpShutdownHandler(
      httpServer as never,
      {
        close: jest.fn<() => Promise<void>>().mockRejectedValue(new Error('transport close failed'))
      },
      exit,
      10_000
    );

    shutdown('SIGTERM');
    await Promise.resolve();

    expect(exit).toHaveBeenCalledWith(1);
  });

  it('forces an HTTP shutdown timeout when the server does not close', () => {
    jest.useFakeTimers();

    const exit = jest.fn<(code: number) => void>();
    const httpServer = {
      close() {
        return this;
      }
    };

    const shutdown = createHttpShutdownHandler(httpServer as never, {}, exit, 50);
    shutdown('SIGTERM');
    jest.advanceTimersByTime(50);

    expect(exit).toHaveBeenCalledWith(1);
  });
});
