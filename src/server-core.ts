import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';

import { analyzeSnapshot } from './analyzer.js';
import { getBaseline, getHistory, saveSnapshot } from './baseline.js';
import { collectSampledSnapshot, collectSnapshot } from './collector.js';
import {
  AnalyzeSchema,
  BaselineSchema,
  CompareSchema,
  GetHistorySchema,
  SnapshotSchema,
  type AnalyzeInput,
  type BaselineInput,
  type CompareInput,
  type GetHistoryInput,
  type SnapshotInput
} from './types.js';

type ToolContent = {
  content: Array<{ type: 'text'; text: string }>;
};

type ToolHandler<Input> = (input: Input) => Promise<ToolContent>;

type ToolConfig = {
  title: string;
  description: string;
  inputSchema: AnySchema;
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    openWorldHint: boolean;
  };
};

interface ToolDefinition<Input> {
  name: string;
  config: ToolConfig;
  handler: ToolHandler<Input>;
}

type ToolDefinitionTuple = [
  ToolDefinition<AnalyzeInput>,
  ToolDefinition<SnapshotInput>,
  ToolDefinition<BaselineInput>,
  ToolDefinition<CompareInput>,
  ToolDefinition<GetHistoryInput>
];

export interface ToolRegistrar {
  registerTool<Input>(name: string, config: ToolConfig, handler: ToolHandler<Input>): void;
}

export interface ToolDependencies {
  analyzeSnapshot: typeof analyzeSnapshot;
  collectSampledSnapshot: typeof collectSampledSnapshot;
  collectSnapshot: typeof collectSnapshot;
  getBaseline: typeof getBaseline;
  getHistory: typeof getHistory;
  saveSnapshot: typeof saveSnapshot;
}

const defaultDependencies: ToolDependencies = {
  analyzeSnapshot,
  collectSampledSnapshot,
  collectSnapshot,
  getBaseline,
  getHistory,
  saveSnapshot
};

function textResult(payload: unknown): ToolContent {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}

function buildHistory(input: GetHistoryInput, dependencies: ToolDependencies) {
  return dependencies.getHistory(input.host, input.metric, input.hours, input.label).map((row) => ({
    timestamp: row.timestamp,
    value:
      input.metric === 'cpu'
        ? row.cpu_percent
        : input.metric === 'memory'
          ? row.memory_percent
          : row.load_1
  }));
}

export function createToolDefinitions(
  dependencies: ToolDependencies = defaultDependencies
): ToolDefinitionTuple {
  return [
    {
      name: 'analyze_server',
      config: {
        title: 'Analyze Server',
        description: 'Collect metrics from a server and explain any anomalies in human language',
        inputSchema: AnalyzeSchema,
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true }
      },
      handler: async (input) => {
        const snapshot = await dependencies.collectSampledSnapshot(
          input.connection,
          input.duration_minutes
        );
        dependencies.saveSnapshot(snapshot);
        const analysis = dependencies.analyzeSnapshot(snapshot);
        return textResult({
          host: snapshot.host,
          timestamp: new Date(snapshot.timestamp).toISOString(),
          collection_window_minutes: input.duration_minutes,
          health_score: analysis.health_score,
          summary: analysis.summary,
          anomalies: analysis.anomalies,
          metrics: {
            cpu: snapshot.cpu,
            memory: snapshot.memory,
            disk: snapshot.disk,
            top_processes: input.include_processes ? snapshot.processes.slice(0, 5) : [],
            network: input.include_network ? snapshot.network : []
          }
        });
      }
    },
    {
      name: 'snapshot',
      config: {
        title: 'Take Metric Snapshot',
        description: 'Collect and save current server metrics without analysis',
        inputSchema: SnapshotSchema,
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true }
      },
      handler: async (input) => {
        const snapshot = await dependencies.collectSnapshot(input.connection);
        dependencies.saveSnapshot(snapshot);
        return textResult({
          saved: true,
          host: snapshot.host,
          timestamp: snapshot.timestamp
        });
      }
    },
    {
      name: 'record_baseline',
      config: {
        title: 'Record Baseline',
        description:
          'Record current metrics as baseline during normal operation for more accurate anomaly detection later',
        inputSchema: BaselineSchema,
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true }
      },
      handler: async (input) => {
        const snapshot = await dependencies.collectSnapshot(input.connection);
        dependencies.saveSnapshot(snapshot, input.label);
        const baseline = dependencies.getBaseline(snapshot.host, input.label);
        const sampleCount = baseline?.sample_count ?? 1;
        const samplesRemaining = Math.max(0, 10 - sampleCount);

        return textResult({
          saved: true,
          host: snapshot.host,
          label: input.label,
          sample_count: sampleCount,
          message:
            sampleCount >= 10
              ? `Baseline established with ${sampleCount} samples.`
              : `Recorded baseline sample. ${samplesRemaining} more sample(s) recommended for reliable anomaly detection.`
        });
      }
    },
    {
      name: 'compare_to_baseline',
      config: {
        title: 'Compare to Baseline',
        description:
          'Compare current server state to a recorded baseline and explain the differences',
        inputSchema: CompareSchema,
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true }
      },
      handler: async (input) => {
        const snapshot = await dependencies.collectSnapshot(input.connection);
        const baseline = dependencies.getBaseline(snapshot.host, input.baseline_label);
        const analysis = dependencies.analyzeSnapshot(snapshot, input.baseline_label);
        return textResult({
          host: snapshot.host,
          baseline_label: input.baseline_label,
          baseline_samples: baseline?.sample_count ?? 0,
          health_score: analysis.health_score,
          summary: analysis.summary,
          anomalies: analysis.anomalies
        });
      }
    },
    {
      name: 'get_history',
      config: {
        title: 'Get Metric History',
        description: 'Get historical CPU, memory, or load values for a server',
        inputSchema: GetHistorySchema,
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
      },
      handler: async (input) => {
        const history = buildHistory(input, dependencies);
        return textResult({
          host: input.host,
          metric: input.metric,
          hours: input.hours,
          label: input.label ?? null,
          data_points: history.length,
          history
        });
      }
    }
  ];
}

export const toolDefinitions = createToolDefinitions() as ReadonlyArray<ToolDefinition<unknown>>;

export function registerInfraLensTools(
  registrar: ToolRegistrar,
  dependencies: ToolDependencies = defaultDependencies
): void {
  for (const definition of createToolDefinitions(dependencies)) {
    registrar.registerTool(
      definition.name,
      definition.config,
      definition.handler as ToolHandler<unknown>
    );
  }
}

export function registerToolsOnServer(
  server: McpServer,
  dependencies: ToolDependencies = defaultDependencies
): void {
  registerInfraLensTools(
    {
      registerTool(name, config, handler) {
        server.registerTool(name, config, (input: unknown) => handler(input as never));
      }
    },
    dependencies
  );
}
