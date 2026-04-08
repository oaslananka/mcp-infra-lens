import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest
} from '@jest/globals';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { analyzeSnapshot } from '../../src/analyzer.js';
import { collectSnapshot } from '../../src/collector.js';
import { getBaseline, getHistory, saveSnapshot } from '../../src/baseline.js';
import { closeAllDatabases } from '../../src/db.js';
import { createToolDefinitions } from '../../src/server-core.js';

const TEST_ROOT = join(tmpdir(), 'mcp-infra-lens-e2e-tests');
const connection = {
  host: '127.0.0.1',
  port: 2222,
  username: 'testuser',
  password: 'testpass'
};

jest.setTimeout(45_000);

function parsePayload<T>(result: { content: Array<{ text: string }> }): T {
  const payload = result.content[0]?.text;
  if (!payload) {
    throw new Error('Tool response did not include a text payload.');
  }

  return JSON.parse(payload) as T;
}

async function waitForPort(host: string, port: number, timeoutMs = 30_000): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const isOpen = await new Promise<boolean>((resolve) => {
      const socket = new net.Socket();

      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('error', () => {
        socket.destroy();
        resolve(false);
      });
      socket.connect(port, host);
    });

    if (isOpen) {
      return;
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 1_000);
    });
  }

  throw new Error(`Timed out waiting for SSH fixture on ${host}:${port}`);
}

beforeAll(async () => {
  mkdirSync(TEST_ROOT, { recursive: true });
  await waitForPort(connection.host, connection.port);
});

beforeEach(() => {
  process.env.INFRA_LENS_DB = join(TEST_ROOT, `e2e-${Date.now()}-${Math.random()}.db`);
});

afterEach(() => {
  closeAllDatabases();
});

afterAll(() => {
  if (existsSync(TEST_ROOT)) {
    rmSync(TEST_ROOT, { recursive: true, force: true });
  }
});

describe('SSH fixture e2e', () => {
  it('returns a structured analyze_server response against the Docker SSH target', async () => {
    const definitions = createToolDefinitions({
      analyzeSnapshot,
      collectSampledSnapshot: async (input) => collectSnapshot(input),
      collectSnapshot,
      getBaseline,
      getHistory,
      saveSnapshot
    });

    const result = await definitions[0].handler({
      connection,
      duration_minutes: 1,
      include_processes: true,
      include_network: true
    });
    const payload = parsePayload<{
      host: string;
      health_score: number;
      anomalies: unknown[];
      metrics: { cpu: unknown; memory: unknown; disk: unknown[] };
    }>(result);

    expect(payload.host).toBe(connection.host);
    expect(payload.health_score).toBeGreaterThanOrEqual(0);
    expect(payload.health_score).toBeLessThanOrEqual(100);
    expect(Array.isArray(payload.anomalies)).toBe(true);
    expect(payload.metrics.cpu).toBeDefined();
    expect(payload.metrics.memory).toBeDefined();
    expect(Array.isArray(payload.metrics.disk)).toBe(true);
  });

  it('records a real baseline sample and exposes it through labeled history', async () => {
    const definitions = createToolDefinitions({
      analyzeSnapshot,
      collectSampledSnapshot: async (input) => collectSnapshot(input),
      collectSnapshot,
      getBaseline,
      getHistory,
      saveSnapshot
    });

    const baselineResult = await definitions[2].handler({
      connection,
      label: 'e2e-normal'
    });
    const historyResult = await definitions[4].handler({
      host: connection.host,
      metric: 'cpu',
      hours: 1,
      label: 'e2e-normal'
    });

    const baselinePayload = parsePayload<{ saved: boolean; sample_count: number }>(baselineResult);
    const historyPayload = parsePayload<{ data_points: number; history: unknown[] }>(historyResult);

    expect(baselinePayload.saved).toBe(true);
    expect(baselinePayload.sample_count).toBeGreaterThanOrEqual(1);
    expect(historyPayload.data_points).toBe(1);
    expect(historyPayload.history).toHaveLength(1);
  });
});
