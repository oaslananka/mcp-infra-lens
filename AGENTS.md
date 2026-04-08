# AGENTS.md

Canonical repository instructions for Codex and other AGENTS.md-aware coding agents.

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

## Working rules

- Keep the current MCP tool surface unchanged unless a task explicitly asks for a new tool.
- Preserve stdio protocol safety: do not write user-facing protocol data to stdout outside MCP responses.
- Route operational logging through the existing structured logger and keep secrets redacted.
- Prefer Node 20 compatibility for shipped behavior and publishing, even though CI also validates Node 22.
- Before wrapping up code changes, run `npm run lint`, `npm run test:coverage`, and `npm run build`. Run `npm run test:e2e` when Docker-backed SSH verification is relevant.
- Follow `RELEASE_POLICY.md` for npm and MCP Registry version decisions.
