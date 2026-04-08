import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { createConnectConfig, resetSshWarningStateForTests } from '../../src/ssh.js';

afterEach(() => {
  resetSshWarningStateForTests();
});

describe('SSH security warning', () => {
  it('emits one runtime warning when permissive host verification is used', () => {
    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

    createConnectConfig({ host: 'prod-01.internal', port: 22, username: 'ops' });
    createConnectConfig({ host: 'prod-02.internal', port: 22, username: 'ops' });

    const warningMessages = stderrSpy.mock.calls
      .map(([chunk]) => String(chunk).trim())
      .filter((entry) => entry.includes('security.host_verification_disabled'));

    expect(warningMessages).toHaveLength(1);

    const warningPayload = JSON.parse(warningMessages[0] ?? '{}') as {
      level?: string;
      message?: string;
      context?: { host?: string; event?: string };
    };

    expect(warningPayload.level).toBe('warn');
    expect(warningPayload.message).toContain('Host key verification is disabled');
    expect(warningPayload.context?.event).toBe('security.host_verification_disabled');
    expect(warningPayload.context?.host).toBe('prod-01.internal');

    stderrSpy.mockRestore();
  });
});
