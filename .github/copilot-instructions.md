# GitHub Copilot Repository Instructions

This repository is an MCP server for Linux infrastructure diagnostics over SSH.

## Core expectations

- Keep the current MCP tool surface stable: `analyze_server`, `snapshot`, `record_baseline`, `compare_to_baseline`, `get_history`.
- Preserve TypeScript strictness and ESM output.
- Preserve stdio MCP protocol safety. Do not introduce accidental stdout logging.
- Use the existing structured logger and keep secret redaction intact.
- Keep SSH collection read-only and never persist SSH credentials.

## Important files

- `src/server-core.ts`: MCP tool registration and handlers
- `src/collector.ts`: SSH metric collection and sampled snapshots
- `src/analyzer.ts`: anomaly detection and health scoring
- `src/baseline.ts`: snapshot persistence, baselines, and history
- `src/db.ts`: SQLite setup and WAL mode
- `src/ssh.ts`: SSH session behavior and security warnings

## Validation

Before concluding a code change, prefer running:

```bash
npm run lint
npm run test:coverage
npm run build
```

Use `npm run test:e2e` when SSH or Docker-backed end-to-end behavior changes.

## Release and packaging

- Follow `RELEASE_POLICY.md` for npm and MCP Registry versioning.
- Keep `package.json`, `server.json`, README packaging details, and published metadata aligned when release-related changes are made.
