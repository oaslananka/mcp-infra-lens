import { describe, expect, it, beforeEach, afterEach, afterAll } from '@jest/globals';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { getBaseline, getHistory, saveSnapshot } from '../../src/baseline.js';
import { closeAllDatabases } from '../../src/db.js';
import type { MetricSnapshot } from '../../src/types.js';

const TEST_ROOT = mkdtempSync(join(tmpdir(), 'mcp-infra-lens-baseline-'));

const makeSnapshot = (timestamp: number, host = 'baseline-host'): MetricSnapshot => ({
  timestamp,
  host,
  cpu: { usage_percent: 25, load_1: 0.7, load_5: 0.5, load_15: 0.3, core_count: 4 },
  memory: {
    total_mb: 8192,
    used_mb: 2048,
    free_mb: 6144,
    usage_percent: 25,
    swap_used_mb: 0,
    swap_total_mb: 4096
  },
  disk: [{ filesystem: '/dev/sda1', mount: '/', total_gb: 100, used_gb: 20, usage_percent: 20 }],
  network: [{ interface: 'eth0', rx_bytes: 2048, tx_bytes: 1024 }],
  processes: [
    { pid: 101, name: 'node', cpu_percent: 5, mem_percent: 3, command: 'node server.js' }
  ],
  os: { hostname: host, uptime_seconds: 1000, kernel: '6.8.0', distro: 'Ubuntu 24.04' }
});

beforeEach(() => {
  process.env.INFRA_LENS_DB = join(TEST_ROOT, `baseline-${Date.now()}-${Math.random()}.db`);
});

afterEach(() => {
  closeAllDatabases();
});

afterAll(() => {
  if (existsSync(TEST_ROOT)) {
    rmSync(TEST_ROOT, { recursive: true, force: true });
  }
});

describe('baseline persistence', () => {
  it('stores snapshots and calculates a labeled baseline', () => {
    const now = Date.now();

    saveSnapshot(makeSnapshot(now - 5 * 60_000), 'normal');
    saveSnapshot(makeSnapshot(now - 4 * 60_000), 'normal');
    saveSnapshot(makeSnapshot(now - 3 * 60_000), 'normal');

    const baseline = getBaseline('baseline-host', 'normal');

    expect(baseline).not.toBeNull();
    expect(baseline?.sample_count).toBe(3);
    expect(baseline?.cpu_samples).toHaveLength(3);
    expect(baseline?.memory_mean).toBe(25);
  });

  it('returns history points within the requested time window', () => {
    const now = Date.now();

    saveSnapshot(makeSnapshot(now - 2 * 60 * 60 * 1000));
    saveSnapshot(makeSnapshot(now - 30 * 60 * 1000));
    saveSnapshot(makeSnapshot(now - 10 * 60 * 1000));

    const history = getHistory('baseline-host', 'cpu', 1);

    expect(history).toHaveLength(2);
    expect(history[0]?.cpu_percent).toBe(25);
  });

  it('filters history by label when requested', () => {
    const now = Date.now();

    saveSnapshot(makeSnapshot(now - 30 * 60 * 1000), 'default');
    saveSnapshot(makeSnapshot(now - 20 * 60 * 1000), 'weekday-normal');
    saveSnapshot(makeSnapshot(now - 10 * 60 * 1000), 'weekday-normal');

    const allHistory = getHistory('baseline-host', 'cpu', 1);
    const labeledHistory = getHistory('baseline-host', 'cpu', 1, 'weekday-normal');

    expect(allHistory).toHaveLength(3);
    expect(labeledHistory).toHaveLength(2);
  });

  it('keeps :memory: databases stable across calls', () => {
    process.env.INFRA_LENS_DB = ':memory:';

    saveSnapshot(makeSnapshot(Date.now()));
    saveSnapshot(makeSnapshot(Date.now() + 1000));
    saveSnapshot(makeSnapshot(Date.now() + 2000));

    const baseline = getBaseline('baseline-host');

    expect(baseline).not.toBeNull();
    expect(baseline?.sample_count).toBe(3);
  });
});
