# Usage Guide

## Example: Record a Baseline

Use this during healthy periods. Repeat several times to build a stable reference window.

```json
{
  "connection": {
    "host": "app-01.internal",
    "username": "ops",
    "privateKey": "-----BEGIN OPENSSH PRIVATE KEY-----..."
  },
  "label": "weekday-normal"
}
```

## Example: Analyze a Server

```json
{
  "connection": {
    "host": "app-01.internal",
    "username": "ops",
    "privateKey": "-----BEGIN OPENSSH PRIVATE KEY-----..."
  },
  "duration_minutes": 5,
  "include_processes": true,
  "include_network": true
}
```

`duration_minutes` now controls real multi-sample collection. The tool averages CPU and memory pressure across the requested window while preserving the most recent disk, network, process, and OS details for explanation.

Typical response fields:

- `health_score`
- `summary`
- `anomalies`
- `metrics.cpu`
- `metrics.memory`
- `metrics.disk`
- `metrics.top_processes`

## Example: Compare to Baseline

```json
{
  "connection": {
    "host": "app-01.internal",
    "username": "ops",
    "privateKey": "-----BEGIN OPENSSH PRIVATE KEY-----..."
  },
  "baseline_label": "weekday-normal"
}
```

## Example: Get History

```json
{
  "host": "app-01.internal",
  "metric": "cpu",
  "hours": 24,
  "label": "weekday-normal"
}
```

Leave `label` unset to return all snapshots for the host, or set it to isolate a named baseline session.

## Notes

- The collector targets Linux hosts and relies on `/proc`, `free`, `df`, `ps`, and `uname`
- Snapshot collection uses a single SSH session with per-command timeout protection
- SSH commands run in parallel to reduce per-snapshot latency
- CPU z-score anomaly detection activates after at least 5 baseline samples
- `record_baseline` recommends 10 samples before treating a baseline as reliable
