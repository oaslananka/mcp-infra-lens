import { z } from 'zod';

export const ConnectionSchema = z.object({
  host: z.string().describe('Server hostname or IP'),
  port: z.number().int().default(22).describe('SSH port'),
  username: z.string().describe('SSH username'),
  password: z.string().optional().describe('SSH password'),
  privateKey: z.string().optional().describe('SSH private key content'),
  passphrase: z.string().optional().describe('Private key passphrase')
});

export const AnalyzeSchema = z.object({
  connection: ConnectionSchema,
  duration_minutes: z
    .number()
    .int()
    .min(1)
    .max(60)
    .default(5)
    .describe('How many minutes of metrics to collect for analysis'),
  include_processes: z.boolean().default(true).describe('Include top process analysis'),
  include_network: z.boolean().default(true).describe('Include network metrics')
});

export const SnapshotSchema = z.object({
  connection: ConnectionSchema
});

export const BaselineSchema = z.object({
  connection: ConnectionSchema,
  label: z
    .string()
    .default('default')
    .describe('Label for this baseline (e.g. "normal", "peak-hours")')
});

export const CompareSchema = z.object({
  connection: ConnectionSchema,
  baseline_label: z.string().default('default')
});

export const MetricNameSchema = z.enum(['cpu', 'memory', 'load']);

export const GetHistorySchema = z.object({
  host: z.string().describe('Server hostname or IP'),
  metric: MetricNameSchema.default('cpu').describe('Metric to return from historical snapshots'),
  hours: z
    .number()
    .int()
    .min(1)
    .max(168)
    .default(24)
    .describe('How many hours of history to return'),
  label: z
    .string()
    .optional()
    .describe('Optional snapshot label filter to isolate baseline sessions or named collections')
});

export type ConnectionInput = z.infer<typeof ConnectionSchema>;
export type AnalyzeInput = z.infer<typeof AnalyzeSchema>;
export type SnapshotInput = z.infer<typeof SnapshotSchema>;
export type BaselineInput = z.infer<typeof BaselineSchema>;
export type CompareInput = z.infer<typeof CompareSchema>;
export type GetHistoryInput = z.infer<typeof GetHistorySchema>;
export type MetricName = z.infer<typeof MetricNameSchema>;

export interface AnalysisThresholds {
  cpu_warn_percent: number;
  cpu_critical_percent: number;
  memory_warn_percent: number;
  memory_critical_percent: number;
  disk_warn_percent: number;
  disk_critical_percent: number;
  load_warn_ratio: number;
  load_critical_ratio: number;
  zscore_threshold: number;
}

export const DEFAULT_THRESHOLDS: AnalysisThresholds = {
  cpu_warn_percent: 85,
  cpu_critical_percent: 95,
  memory_warn_percent: 85,
  memory_critical_percent: 95,
  disk_warn_percent: 80,
  disk_critical_percent: 90,
  load_warn_ratio: 1.5,
  load_critical_ratio: 3,
  zscore_threshold: 2
};

export interface DiskMetric {
  filesystem: string;
  mount: string;
  total_gb: number;
  used_gb: number;
  usage_percent: number;
}

export interface NetworkMetric {
  interface: string;
  rx_bytes: number;
  tx_bytes: number;
}

export interface ProcessMetric {
  pid: number;
  name: string;
  cpu_percent: number;
  mem_percent: number;
  command: string;
}

export interface MetricSnapshot {
  timestamp: number;
  host: string;
  cpu: {
    usage_percent: number;
    load_1: number;
    load_5: number;
    load_15: number;
    core_count: number;
  };
  memory: {
    total_mb: number;
    used_mb: number;
    free_mb: number;
    usage_percent: number;
    swap_used_mb: number;
    swap_total_mb: number;
  };
  disk: DiskMetric[];
  network: NetworkMetric[];
  processes: ProcessMetric[];
  os: {
    hostname: string;
    uptime_seconds: number;
    kernel: string;
    distro: string;
  };
}

export interface Anomaly {
  metric: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  value: number;
  baseline_mean: number;
  z_score: number;
  explanation: string;
  recommendation: string;
}

export interface StoredSnapshotRow {
  timestamp: number;
  cpu_percent: number;
  memory_percent: number;
  load_1: number;
  raw_json: string;
}
