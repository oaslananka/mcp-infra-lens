import { describe, expect, it, jest } from '@jest/globals';

import { createLogger } from '../../src/logging.js';

describe('createLogger', () => {
  it('writes every log level to stderr and never to console methods', () => {
    const logger = createLogger('test');
    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    logger.debug('debug message');
    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message');

    expect(stderrSpy).toHaveBeenCalledTimes(4);
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    stderrSpy.mockRestore();
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('redacts nested secrets in objects and arrays', () => {
    const logger = createLogger('test');
    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

    logger.info('redaction check', {
      password: 'secret',
      nested: {
        privateKey: 'private-key'
      },
      items: [{ passphrase: 'hidden' }]
    });

    const payload = JSON.parse(String(stderrSpy.mock.calls[0]?.[0] ?? '{}')) as {
      context?: {
        password?: string;
        nested?: { privateKey?: string };
        items?: Array<{ passphrase?: string }>;
      };
    };

    expect(payload.context?.password).toBe('[REDACTED]');
    expect(payload.context?.nested?.privateKey).toBe('[REDACTED]');
    expect(payload.context?.items?.[0]?.passphrase).toBe('[REDACTED]');

    stderrSpy.mockRestore();
  });
});
