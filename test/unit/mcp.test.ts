import { describe, expect, it, jest } from '@jest/globals';

import {
  createToolDefinitions,
  registerInfraLensTools,
  registerToolsOnServer,
  toolDefinitions
} from '../../src/server-core.js';
import type {
  AnalyzeInput,
  BaselineInput,
  CompareInput,
  GetHistoryInput,
  MetricSnapshot,
  SnapshotInput
} from '../../src/types.js';

const baseSnapshot: MetricSnapshot = {
  timestamp: Date.now(),
  host: 'app-01.internal',
  cpu: { usage_percent: 55, load_1: 1.2, load_5: 1.0, load_15: 0.8, core_count: 4 },
  memory: {
    total_mb: 8192,
    used_mb: 4096,
    free_mb: 4096,
    usage_percent: 50,
    swap_used_mb: 0,
    swap_total_mb: 1024
  },
  disk: [{ filesystem: '/dev/sda1', mount: '/', total_gb: 100, used_gb: 50, usage_percent: 50 }],
  network: [{ interface: 'eth0', rx_bytes: 123, tx_bytes: 456 }],
  processes: [{ pid: 100, name: 'node', cpu_percent: 12, mem_percent: 5, command: 'node api.js' }],
  os: { hostname: 'app-01.internal', uptime_seconds: 3600, kernel: '6.8.0', distro: 'Ubuntu 24.04' }
};

describe('registerInfraLensTools', () => {
  it('registers all v1 tools with required annotations', () => {
    const registered: Array<{
      name: string;
      config: {
        annotations?: {
          openWorldHint?: boolean;
        };
      };
    }> = [];

    registerInfraLensTools({
      registerTool(name: string, config: { annotations?: { openWorldHint?: boolean } }) {
        registered.push({ name, config });
      }
    });

    expect(registered.map((entry) => entry.name)).toEqual([
      'analyze_server',
      'snapshot',
      'record_baseline',
      'compare_to_baseline',
      'get_history'
    ]);

    for (const definition of toolDefinitions) {
      expect(definition.config.annotations).toBeDefined();
      expect(definition.config.annotations?.openWorldHint).toBe(
        definition.name === 'get_history' ? false : true
      );
    }
  });

  it('uses sampled collection for analyze_server and single snapshots for the other collectors', async () => {
    const collectSampled = jest.fn(async () => baseSnapshot);
    const collectSingle = jest.fn(async () => baseSnapshot);
    const persistSnapshot = jest.fn(() => undefined);

    const definitions = createToolDefinitions({
      analyzeSnapshot: jest.fn(() => ({
        anomalies: [],
        summary: 'healthy',
        health_score: 100
      })),
      collectSampledSnapshot: collectSampled,
      collectSnapshot: collectSingle,
      getBaseline: jest.fn(() => ({
        cpu_samples: [20, 21, 19],
        memory_mean: 25,
        load_mean: 0.7,
        sample_count: 3
      })),
      getHistory: jest.fn(() => []),
      saveSnapshot: persistSnapshot
    });

    await definitions[0].handler({
      connection: { host: 'app-01.internal', port: 22, username: 'ops' },
      duration_minutes: 5,
      include_processes: true,
      include_network: true
    } satisfies AnalyzeInput);

    await definitions[1].handler({
      connection: { host: 'app-01.internal', port: 22, username: 'ops' }
    } satisfies SnapshotInput);

    await definitions[2].handler({
      connection: { host: 'app-01.internal', port: 22, username: 'ops' },
      label: 'weekday-normal'
    } satisfies BaselineInput);

    await definitions[3].handler({
      connection: { host: 'app-01.internal', port: 22, username: 'ops' },
      baseline_label: 'weekday-normal'
    } satisfies CompareInput);

    await definitions[4].handler({
      host: 'app-01.internal',
      metric: 'cpu',
      hours: 24,
      label: 'weekday-normal'
    } satisfies GetHistoryInput);

    expect(collectSampled).toHaveBeenCalledTimes(1);
    expect(collectSampled).toHaveBeenCalledWith(
      { host: 'app-01.internal', port: 22, username: 'ops' },
      5
    );
    expect(collectSingle).toHaveBeenCalledTimes(3);
    expect(persistSnapshot).toHaveBeenCalledTimes(3);
  });

  it('omits optional process and network sections when requested and maps all history metrics', async () => {
    const definitions = createToolDefinitions({
      analyzeSnapshot: jest.fn(() => ({
        anomalies: [],
        summary: 'healthy',
        health_score: 100
      })),
      collectSampledSnapshot: jest.fn(async () => baseSnapshot),
      collectSnapshot: jest.fn(async () => baseSnapshot),
      getBaseline: jest.fn(() => null),
      getHistory: jest.fn(() => [
        {
          timestamp: 1,
          cpu_percent: 10,
          memory_percent: 20,
          load_1: 0.5,
          raw_json: '{}'
        }
      ]),
      saveSnapshot: jest.fn(() => undefined)
    });

    const analyzeResult = await definitions[0].handler({
      connection: { host: 'app-01.internal', port: 22, username: 'ops' },
      duration_minutes: 1,
      include_processes: false,
      include_network: false
    } satisfies AnalyzeInput);
    const memoryHistory = await definitions[4].handler({
      host: 'app-01.internal',
      metric: 'memory',
      hours: 1
    } satisfies GetHistoryInput);
    const loadHistory = await definitions[4].handler({
      host: 'app-01.internal',
      metric: 'load',
      hours: 1
    } satisfies GetHistoryInput);

    const analyzePayload = JSON.parse(analyzeResult.content[0]?.text ?? '{}') as {
      metrics?: { top_processes?: unknown[]; network?: unknown[] };
    };
    const memoryPayload = JSON.parse(memoryHistory.content[0]?.text ?? '{}') as {
      history?: Array<{ value: number }>;
    };
    const loadPayload = JSON.parse(loadHistory.content[0]?.text ?? '{}') as {
      history?: Array<{ value: number }>;
    };

    expect(analyzePayload.metrics?.top_processes).toEqual([]);
    expect(analyzePayload.metrics?.network).toEqual([]);
    expect(memoryPayload.history?.[0]?.value).toBe(20);
    expect(loadPayload.history?.[0]?.value).toBe(0.5);
  });

  it('registers wrappers on an MCP server compatible registrar', async () => {
    const handlerSpy = jest.fn(() => ({
      anomalies: [],
      summary: 'healthy',
      health_score: 100
    }));
    const server = {
      registered: [] as Array<{ name: string; handler: (input: unknown) => Promise<unknown> }>,
      registerTool(name: string, _config: unknown, handler: (input: unknown) => Promise<unknown>) {
        this.registered.push({ name, handler });
      }
    };

    registerToolsOnServer(server as never, {
      analyzeSnapshot: handlerSpy,
      collectSampledSnapshot: jest.fn(async () => baseSnapshot),
      collectSnapshot: jest.fn(async () => baseSnapshot),
      getBaseline: jest.fn(() => null),
      getHistory: jest.fn(() => []),
      saveSnapshot: jest.fn(() => undefined)
    });

    expect(server.registered).toHaveLength(5);

    await server.registered[0]!.handler({
      connection: { host: 'app-01.internal', port: 22, username: 'ops' },
      duration_minutes: 1,
      include_processes: true,
      include_network: true
    });

    expect(handlerSpy).toHaveBeenCalledWith(baseSnapshot);
  });
});
