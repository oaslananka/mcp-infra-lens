# Antigravity Repository Rules

Project rules for Antigravity-style agent workflows.

## Repository purpose

`mcp-infra-lens` explains Linux incidents over SSH with baseline-aware MCP tooling.

## Non-negotiables

- Keep the existing MCP tools intact unless the task explicitly changes the tool surface.
- Do not leak protocol output to stdout in stdio mode.
- Keep SSH access read-only.
- Never store SSH credentials in SQLite or commit them to the repo.
- Respect the existing structured logging and redaction behavior.

## High-value commands

```bash
npm run lint
npm test
npm run test:coverage
npm run build
```

Use Docker-backed e2e tests when transport or SSH behavior changes:

```bash
npm run test:e2e
```

## Release discipline

- Follow `RELEASE_POLICY.md`.
- Keep package, registry manifest, and published metadata aligned for real releases.
- Treat prerelease registry versions as metadata-only fixes, not package releases.
