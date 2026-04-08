# Contributing to mcp-infra-lens

## Development setup

```bash
git clone https://github.com/oaslananka/mcp-infra-lens.git
cd mcp-infra-lens
node --version  # Must be >= 20
npm ci
npm run build
npm test
```

## Workflow

1. Fork the repository and create a feature branch from `main`.
2. Make your changes. Run `npm run lint` and `npm test` before pushing.
3. Write or update unit tests for any changed behavior. Coverage should not decrease.
4. Open a pull request against `main` with a clear description of the change.

For release decisions, npm publishing, and MCP Registry version alignment, see [RELEASE_POLICY.md](./RELEASE_POLICY.md).

## AI agent files

This repository includes agent-specific guidance files for common coding assistants:

- `AGENTS.md` for Codex and AGENTS-aware agents
- `CLAUDE.md` for Claude Code workflows
- `GEMINI.md` for Gemini CLI workflows
- `.github/copilot-instructions.md` for GitHub Copilot
- `.agent/rules/repository.md` for Antigravity-style agent sessions

## Code style

- TypeScript strict mode. All `any` is banned.
- Prettier formats the code. Run `npm run format` before committing.
- `npm run lint` must pass cleanly.

## Commit messages

Use conventional commits such as `feat:`, `fix:`, `docs:`, `test:`, `chore:`, or `refactor:`.

Example:

```text
fix: route all log output to stderr for stdio MCP compatibility
```

## Adding a new MCP tool

1. Define the Zod input schema in `src/types.ts`.
2. Add the tool definition in `src/server-core.ts`.
3. Write or update unit tests in `test/unit/`.
4. Document the tool in `README.md` and `docs/usage.md`.

## Testing

```bash
npm test
npm run lint
```

Integration tests against a real SSH target require a live Linux host. See `docs/testing.md` for the recommended local Docker-based workflow and publish checklist.
