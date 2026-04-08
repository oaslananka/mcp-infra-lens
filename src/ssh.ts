import { Client, type ConnectConfig } from 'ssh2';

import { createLogger } from './logging.js';
import type { ConnectionInput } from './types.js';

const logger = createLogger('ssh');
let hasWarnedAboutPermissiveHostVerification = false;

export interface CommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

export interface SshSession {
  exec(command: string, timeoutMs?: number): Promise<CommandResult>;
  close(): void;
}

export interface SshExecStreamLike {
  stderr: {
    on(event: 'data', listener: (chunk: Buffer) => void): void;
  };
  on(event: 'data', listener: (chunk: Buffer) => void): this;
  on(event: 'close', listener: (code?: number) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  close(): void;
}

export interface SshClientLike {
  exec(
    command: string,
    callback: (error: Error | undefined, stream: SshExecStreamLike) => void
  ): void;
  once(event: 'ready', listener: () => void): this;
  once(event: 'error', listener: (error: Error) => void): this;
  connect(config: ConnectConfig): void;
  end(): void;
}

class Ssh2Session implements SshSession {
  constructor(private readonly client: SshClientLike) {}

  exec(command: string, timeoutMs = 10_000): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      this.client.exec(command, (error, stream) => {
        if (error) {
          reject(error);
          return;
        }

        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => {
          stream.close();
          reject(new Error(`SSH command timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        stream.on('data', (chunk: Buffer) => {
          stdout += chunk.toString('utf8');
        });
        stream.stderr.on('data', (chunk: Buffer) => {
          stderr += chunk.toString('utf8');
        });
        stream.on('close', (code?: number) => {
          clearTimeout(timer);
          resolve({
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            code: code ?? 0
          });
        });
        stream.on('error', (streamError: Error) => {
          clearTimeout(timer);
          reject(streamError);
        });
      });
    });
  }

  close(): void {
    this.client.end();
  }
}

function warnAboutPermissiveHostVerification(host: string): void {
  if (hasWarnedAboutPermissiveHostVerification) {
    return;
  }

  hasWarnedAboutPermissiveHostVerification = true;
  logger.warn('Host key verification is disabled. Restrict network access to trusted hosts.', {
    event: 'security.host_verification_disabled',
    host
  });
}

export function createConnectConfig(connection: ConnectionInput): ConnectConfig {
  warnAboutPermissiveHostVerification(connection.host);

  return {
    host: connection.host,
    port: connection.port ?? 22,
    username: connection.username,
    readyTimeout: 10_000,
    hostVerifier: () => true,
    ...(connection.password ? { password: connection.password } : {}),
    ...(connection.privateKey
      ? { privateKey: connection.privateKey, passphrase: connection.passphrase }
      : {})
  };
}

export function resetSshWarningStateForTests(): void {
  hasWarnedAboutPermissiveHostVerification = false;
}

export async function withSshSession<T>(
  connection: ConnectionInput,
  callback: (session: SshSession) => Promise<T>,
  clientFactory: () => SshClientLike = () => new Client()
): Promise<T> {
  const client = clientFactory();
  const session = new Ssh2Session(client);
  const config = createConnectConfig(connection);

  await new Promise<void>((resolve, reject) => {
    client.once('ready', () => resolve());
    client.once('error', reject);
    client.connect(config);
  });

  try {
    return await callback(session);
  } catch (error) {
    logger.error('SSH command execution failed', {
      host: connection.host,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  } finally {
    session.close();
  }
}
