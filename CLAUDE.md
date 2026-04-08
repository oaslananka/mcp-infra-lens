# CLAUDE.md

Repository instructions for Claude Code and Claude-powered coding workflows.

## Project overview

`mcp-infra-lens` is an MCP server for Linux infrastructure diagnostics over SSH. It collects sampled metrics, stores local history in SQLite, compares new snapshots to recorded baselines, and explains anomalies in plain English.

Current MCP tools:

- `analyze_server`
- `snapshot`
- `record_baseline`
- `compare_to_baseline`
- `get_history`

Do not add, remove, or rename tools unless the task explicitly requires a tool-surface change.

## Working priorities

- Keep TypeScript strict and ESM-native.
- Preserve MCP stdio protocol safety. Avoid accidental stdout writes outside the MCP transport.
- Use the existing structured logger and keep SSH credentials redacted.
- Keep SSH collection read-only.
- Do not persist SSH passwords or private keys to SQLite or docs.
- Preserve Node 20 compatibility for release and publish flows.

## Important commands

```bash
npm run lint
npm test
npm run test:coverage
npm run build
```

Docker-backed e2e:

```bash
npm run test:e2e
```

## Repo guidance

- Follow the current architecture split: `collector.ts`, `analyzer.ts`, `baseline.ts`, `db.ts`, `server-core.ts`, `ssh.ts`, and transport entrypoints.
- Keep README, `server.json`, and `package.json` aligned when changing user-facing packaging metadata.
- Follow `RELEASE_POLICY.md` for npm release, registry publish, and prerelease-only metadata updates.
- If a change affects security-sensitive behavior such as SSH auth, host verification, or HTTP exposure, update `SECURITY.md` when needed.

## Operational limits

- Host key verification is permissive in v1. Treat remote targets as trusted-network-only unless strict verification is introduced.
- HTTP transport has no built-in authentication. Assume loopback or reverse-proxy protection.
- SQLite stores metrics and history, not credentials.
