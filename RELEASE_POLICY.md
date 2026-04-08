# Release Policy

This document defines how `mcp-infra-lens` versions are published to npm and to the official MCP Registry.

## Scope

This policy applies to:

- `package.json`
- `server.json`
- npm releases
- MCP Registry publications
- Git tags and release notes

## Core Rules

1. Every MCP Registry publication must use a unique `server.json.version`.
2. For normal package releases, keep `package.json.version`, `server.json.version`, and `server.json.packages[].version` aligned.
3. If the npm package artifact did not change, do not publish a new npm version just to fix registry metadata.
4. Use semantic prerelease versions for registry-only metadata updates.
5. If a change only affects docs, internal notes, or CI internals, do not publish to npm or the MCP Registry.

## Decision Table

| Change type | `package.json.version` | `server.json.version` | `packages[].version` | npm publish | MCP Registry publish | Tag |
| --- | --- | --- | --- | --- | --- | --- |
| Runtime, tool behavior, build artifact, dependency, transport, schema, or packaged docs changed | Bump `patch`, `minor`, or `major` | Match package version | Match package version | Yes | Yes | Yes |
| Only MCP Registry metadata changed | No change | Bump prerelease, for example `1.0.2-1` | Keep last published package version, for example `1.0.2` | No | Yes | Optional |
| Only docs, repo internals, CI, comments, or local developer tooling changed | No change | No change | No change | No | No | No |

## Normal Release

Use this flow when the published npm package changes.

Example:

- Current version: `1.0.1`
- Next package release: `1.0.2`

Required alignment:

- `package.json.version = 1.0.2`
- `server.json.version = 1.0.2`
- `server.json.packages[0].version = 1.0.2`

Recommended sequence:

1. Update versions.
2. Run quality checks in Azure DevOps or locally.
3. Publish the npm package.
4. Publish the MCP Registry entry.
5. Create the Git tag for the release.

## Registry-only Metadata Update

Use this flow when the npm package artifact is unchanged but registry metadata needs correction.

Examples:

- description cleanup
- repository metadata fix
- environment variable metadata fix
- install or registry presentation metadata fix

Example:

- Last npm package: `1.0.2`
- Registry-only correction: `1.0.2-1`

Required alignment:

- `package.json.version = 1.0.2`
- `server.json.version = 1.0.2-1`
- `server.json.packages[0].version = 1.0.2`

Important:

- Do not republish the npm package.
- Do not change `packages[].version` unless the underlying package actually changed.
- A prerelease such as `1.0.2-1` sorts before the regular `1.0.2` release, so it may not become `latest` in registry consumers.

## No-release Changes

Do not publish to npm or the MCP Registry for changes like:

- `README.md` edits only
- `IMPROVEMENTS_*.md` or other internal project notes
- CI cleanup with no shipped artifact change
- comment-only source changes
- local test fixture changes that do not affect the shipped package

## Azure DevOps Policy

`mcp-infra-lens` uses Azure DevOps for quality, build, and npm release automation.

Current recommended release split:

- Azure DevOps:
  - install
  - lint
  - test
  - coverage
  - build
  - Docker smoke build
  - npm publish
- MCP Registry:
  - publish after package availability is confirmed

Because the current registry namespace is GitHub-based:

- `mcpName = io.github.oaslananka/mcp-infra-lens`
- `server.json.name = io.github.oaslananka/mcp-infra-lens`

the registry authentication flow must remain compatible with GitHub-based ownership unless the project intentionally migrates to a domain-based namespace.

## Standard Commands

Normal package release:

```bash
npm version patch
npm ci
npm run lint
npm run test:coverage
npm run build
npm publish --access public
mcp-publisher login github
mcp-publisher publish
git push origin main --tags
```

Registry-only metadata release:

```bash
# Edit server.json only:
#   version -> 1.0.2-1
#   packages[0].version stays 1.0.2

mcp-publisher login github
mcp-publisher publish
git tag registry-v1.0.2-1
git push origin main --tags
```

## Anti-patterns

Avoid these release mistakes:

- publishing the npm package as `1.0.2` while keeping `server.json.version` at `1.0.1`
- publishing the same `server.json.version` twice
- changing `packages[].version` when no new package exists
- publishing registry metadata for docs-only changes
- using a lower prerelease after a higher stable release in a way that confuses consumers

## Source of Truth

When in doubt, follow the official MCP Registry versioning rules:

- https://modelcontextprotocol.io/registry/versioning
- https://modelcontextprotocol.io/registry/quickstart
- https://modelcontextprotocol.io/registry/authentication
