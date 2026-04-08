# Architecture

## Component map

```text
Claude (MCP client)
       |  stdio or Streamable HTTP
       v
  server-core.ts -- registerToolsOnServer()
       |
       +-- analyzer.ts  -- z-score anomaly detection and health scoring
       +-- collector.ts -- SSH metric collection and sampled aggregation
       +-- baseline.ts  -- SQLite read/write for snapshots and baselines
       +-- db.ts        -- database factory, WAL mode, schema init
       +-- ssh.ts       -- withSshSession(), per-command timeout
       +-- logging.ts   -- structured JSON logger -> stderr
       +-- shutdown.ts  -- graceful SIGTERM and SIGINT handling
       +-- types.ts     -- Zod schemas and shared TypeScript types
```

## Data flow: `analyze_server`

1. The MCP client sends `analyze_server` with SSH connection details and `duration_minutes`.
2. `server-core.ts` validates input with Zod and calls `collectSampledSnapshot()`.
3. `collector.ts` opens one SSH session, runs six collection commands in parallel per sample, and parses the output.
4. Sampled CPU, memory, and load values are averaged across the requested collection window.
5. `baseline.ts.saveSnapshot()` persists the aggregated snapshot to SQLite.
6. `analyzer.ts.analyzeSnapshot()` loads the selected baseline, applies thresholds and z-score logic, and builds the summary.
7. The MCP server returns a structured JSON payload with `health_score`, `summary`, `anomalies`, and the sampled metrics.

## Database schema

```sql
CREATE TABLE snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  host TEXT NOT NULL,
  label TEXT DEFAULT 'default',
  timestamp INTEGER NOT NULL,
  cpu_percent REAL NOT NULL,
  memory_percent REAL NOT NULL,
  load_1 REAL NOT NULL,
  raw_json TEXT NOT NULL
);
```

- Label `default` represents regular analysis and snapshot history.
- Any other label represents a named baseline or custom collection stream.

## Anomaly detection

1. Load up to 100 samples for the host and baseline label.
2. If at least 5 CPU samples exist, compute mean, standard deviation, and z-score.
3. Trigger CPU anomalies when the z-score exceeds the configured threshold or raw CPU exceeds the warning threshold.
4. Trigger memory, disk, and load anomalies from configurable thresholds.
5. Start health at 100, then deduct `40` for critical, `20` for high, `10` for medium, and `5` for low anomalies.
