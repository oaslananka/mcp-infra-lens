# GEMINI.md

Project context for Gemini CLI and Gemini-powered repository sessions.

## What this repository is

`mcp-infra-lens` is a TypeScript MCP server that connects to Linux hosts over SSH, collects sampled infrastructure metrics, records local history in SQLite, and explains anomalies against recorded baselines.

Primary modules:

- `src/collector.ts`
- `src/analyzer.ts`
- `src/baseline.ts`
- `src/db.ts`
- `src/server-core.ts`
- `src/ssh.ts`

## Tool surface

Keep these MCP tools stable unless explicitly asked to change them:

- `analyze_server`
- `snapshot`
- `record_baseline`
- `compare_to_baseline`
- `get_history`

## Engineering rules

- Maintain TypeScript strictness and ESM output.
- Preserve stdout cleanliness for stdio MCP mode.
- Use the structured logger for diagnostics and keep redaction behavior intact.
- Never store SSH credentials in SQLite or docs.
- Keep Linux collection read-only.
- Prefer Node 20-compatible release behavior.

## Validation commands

```bash
npm run lint
npm test
npm run test:coverage
npm run build
```

Run `npm run test:e2e` when a change touches SSH transport, Docker fixture behavior, or end-to-end tool flow.

## Release guidance

- Use `RELEASE_POLICY.md` for version bump decisions.
- Keep `package.json`, `server.json`, npm, and MCP Registry metadata aligned for real releases.
- Use registry prerelease versions only for registry-only metadata fixes.
