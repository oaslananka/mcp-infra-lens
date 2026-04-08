import * as ss from 'simple-statistics';

import { getBaseline } from './baseline.js';
import {
  DEFAULT_THRESHOLDS,
  type AnalysisThresholds,
  type Anomaly,
  type MetricSnapshot,
  type ProcessMetric
} from './types.js';

function selectTopCpuProcess(processes: ProcessMetric[]): ProcessMetric | undefined {
  return [...processes].sort((left, right) => right.cpu_percent - left.cpu_percent)[0];
}

function selectTopMemoryProcess(processes: ProcessMetric[]): ProcessMetric | undefined {
  return [...processes].sort((left, right) => right.mem_percent - left.mem_percent)[0];
}

export function analyzeSnapshot(
  snapshot: MetricSnapshot,
  baselineLabel = 'default',
  thresholds: AnalysisThresholds = DEFAULT_THRESHOLDS
): {
  anomalies: Anomaly[];
  summary: string;
  health_score: number;
} {
  const baseline = getBaseline(snapshot.host, baselineLabel);
  const anomalies: Anomaly[] = [];
  const memoryHighPercent =
    thresholds.memory_warn_percent +
    (thresholds.memory_critical_percent - thresholds.memory_warn_percent) / 2;
  const diskCriticalPercent =
    thresholds.disk_critical_percent +
    (thresholds.disk_critical_percent - thresholds.disk_warn_percent) / 2;
  const loadHighRatio =
    thresholds.load_warn_ratio + (thresholds.load_critical_ratio - thresholds.load_warn_ratio) / 3;

  if (baseline?.cpu_samples && baseline.cpu_samples.length >= 5) {
    const mean = ss.mean(baseline.cpu_samples);
    const stdDeviation = ss.standardDeviation(baseline.cpu_samples);
    const zScore =
      stdDeviation > 0
        ? (snapshot.cpu.usage_percent - mean) / stdDeviation
        : snapshot.cpu.usage_percent >= mean + 20
          ? 3
          : 0;

    if (
      Math.abs(zScore) > thresholds.zscore_threshold ||
      snapshot.cpu.usage_percent > thresholds.cpu_warn_percent
    ) {
      const topProcess = selectTopCpuProcess(snapshot.processes);
      anomalies.push({
        metric: 'cpu',
        severity:
          snapshot.cpu.usage_percent >= thresholds.cpu_critical_percent
            ? 'critical'
            : snapshot.cpu.usage_percent > thresholds.cpu_warn_percent
              ? 'high'
              : 'medium',
        value: snapshot.cpu.usage_percent,
        baseline_mean: Number(mean.toFixed(1)),
        z_score: Number(zScore.toFixed(1)),
        explanation: `CPU is at ${snapshot.cpu.usage_percent}% (${zScore.toFixed(
          1
        )}σ above baseline ${mean.toFixed(1)}%). Load is ${snapshot.cpu.load_1}/${snapshot.cpu.load_5}/${snapshot.cpu.load_15}. Top CPU consumer: ${topProcess?.command ?? 'unknown'} (${topProcess?.cpu_percent ?? 0}%).`,
        recommendation:
          snapshot.cpu.usage_percent > 90
            ? `Investigate ${topProcess?.command ?? 'the top process'} (PID ${topProcess?.pid ?? 0}) and review application logs or scale-out options.`
            : `Monitor ${topProcess?.command ?? 'the active workload'} and confirm whether this spike matches an expected traffic pattern.`
      });
    }
  } else if (snapshot.cpu.usage_percent > thresholds.cpu_warn_percent) {
    const topProcess = selectTopCpuProcess(snapshot.processes);
    anomalies.push({
      metric: 'cpu',
      severity: snapshot.cpu.usage_percent >= thresholds.cpu_critical_percent ? 'critical' : 'high',
      value: snapshot.cpu.usage_percent,
      baseline_mean: 0,
      z_score: 0,
      explanation: `CPU is at ${snapshot.cpu.usage_percent}% with no baseline yet. Top process: ${topProcess?.command ?? 'unknown'}.`,
      recommendation:
        'Record more baseline samples with record_baseline before relying on z-score anomaly detection.'
    });
  }

  if (snapshot.memory.usage_percent > thresholds.memory_warn_percent) {
    const topMemoryProcess = selectTopMemoryProcess(snapshot.processes);
    anomalies.push({
      metric: 'memory',
      severity:
        snapshot.memory.usage_percent > thresholds.memory_critical_percent
          ? 'critical'
          : snapshot.memory.usage_percent > memoryHighPercent
            ? 'high'
            : 'medium',
      value: snapshot.memory.usage_percent,
      baseline_mean: baseline?.memory_mean ?? 0,
      z_score: 0,
      explanation: `Memory usage is ${snapshot.memory.usage_percent}% (${snapshot.memory.used_mb}MB/${snapshot.memory.total_mb}MB). Swap usage is ${snapshot.memory.swap_used_mb}MB. Top memory consumer: ${topMemoryProcess?.command ?? 'unknown'} (${topMemoryProcess?.mem_percent ?? 0}%).`,
      recommendation:
        snapshot.memory.usage_percent > 95
          ? `OOM risk is high. Restart or scale ${topMemoryProcess?.command ?? 'the affected service'} immediately.`
          : `Check ${topMemoryProcess?.command ?? 'the active process'} for leaks or oversized heap settings.`
    });
  }

  for (const disk of snapshot.disk) {
    if (disk.usage_percent > thresholds.disk_warn_percent) {
      anomalies.push({
        metric: `disk:${disk.mount}`,
        severity:
          disk.usage_percent > diskCriticalPercent
            ? 'critical'
            : disk.usage_percent > thresholds.disk_critical_percent
              ? 'high'
              : 'medium',
        value: disk.usage_percent,
        baseline_mean: 0,
        z_score: 0,
        explanation: `Disk ${disk.mount} is ${disk.usage_percent}% full (${disk.used_gb}GB/${disk.total_gb}GB).`,
        recommendation:
          disk.usage_percent > 90
            ? `Run du -sh ${disk.mount}/* | sort -rh | head -20 and clean logs or temporary files on ${disk.mount}.`
            : `Plan capacity cleanup soon before ${disk.mount} becomes critical.`
      });
    }
  }

  const normalizedLoad =
    snapshot.cpu.core_count > 0 ? snapshot.cpu.load_1 / snapshot.cpu.core_count : 0;
  if (normalizedLoad > thresholds.load_warn_ratio) {
    anomalies.push({
      metric: 'load',
      severity:
        normalizedLoad > thresholds.load_critical_ratio
          ? 'critical'
          : normalizedLoad > loadHighRatio
            ? 'high'
            : 'medium',
      value: snapshot.cpu.load_1,
      baseline_mean: baseline?.load_mean ?? snapshot.cpu.core_count,
      z_score: Number(normalizedLoad.toFixed(1)),
      explanation: `Load average is ${snapshot.cpu.load_1} on ${snapshot.cpu.core_count} cores (${Math.round(
        normalizedLoad * 100
      )}% of core capacity). Trend is ${snapshot.cpu.load_1} -> ${snapshot.cpu.load_5} -> ${snapshot.cpu.load_15}.`,
      recommendation:
        normalizedLoad > 2
          ? 'System load is above sustainable capacity. Check CPU saturation, runnable queue depth, and horizontal scaling options.'
          : 'Monitor the load trend and confirm whether the queue drains after the current burst.'
    });
  }

  const health_score = Math.max(
    0,
    100 -
      anomalies.filter((anomaly) => anomaly.severity === 'critical').length * 40 -
      anomalies.filter((anomaly) => anomaly.severity === 'high').length * 20 -
      anomalies.filter((anomaly) => anomaly.severity === 'medium').length * 10 -
      anomalies.filter((anomaly) => anomaly.severity === 'low').length * 5
  );

  const summary =
    anomalies.length === 0
      ? `Server ${snapshot.host} looks healthy. CPU is ${snapshot.cpu.usage_percent}%, memory is ${snapshot.memory.usage_percent}%, and disk usage is within expected thresholds.`
      : `Found ${anomalies.length} anomaly${anomalies.length === 1 ? '' : 'ies'} on ${snapshot.host}. Most urgent signal: ${anomalies[0]?.explanation ?? 'n/a'}`;

  return { anomalies, summary, health_score };
}
