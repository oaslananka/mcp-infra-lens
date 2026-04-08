# AGENTS.md

## Tool usage guide

### `analyze_server`

Connects to a Linux host over SSH, samples the requested collection window, compares the result to recorded baselines, and explains anomalies in plain English.

Use it for questions like:

- "Is `prod-01` healthy right now?"
- "Why is this server slow?"
- "What changed compared to normal traffic?"

### `snapshot`

Captures a point-in-time metric snapshot and stores it in SQLite without running anomaly analysis.

Use it when you want fresh telemetry for later history lookups or before a manual investigation.

### `record_baseline`

Stores a labeled healthy-state sample so future comparisons have statistical context.

Use it during normal operating windows such as:

- daytime steady state
- peak traffic
- post-deployment warm state

### `compare_to_baseline`

Collects a fresh snapshot and compares it to a named baseline label.

Use it when an operator already knows which baseline is relevant and wants the shortest differential view.

### `get_history`

Returns CPU, memory, or load history from SQLite, optionally filtered by label.

Use it to answer trend questions and to separate default incident snapshots from named baseline sessions.

## Operational limits

- Host key verification is permissive in v1. Use only on trusted networks and prefer bastions or private subnets.
- The HTTP transport has no built-in authentication. Bind to loopback and place it behind an authenticated reverse proxy for any shared environment.
- SSH credentials are redacted from structured logs and are never stored in SQLite.
