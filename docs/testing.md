# Testing

## Node version

Use Node 20 for local validation and release work.

```bash
node --version
```

If you use `nvm` or a similar tool:

```bash
nvm use 20
```

## Local workflow

```bash
npm ci --legacy-peer-deps --ignore-scripts
npm rebuild better-sqlite3
npm run lint
npm test
npm run test:integration
npm run test:coverage
npm run build
```

## Docker-backed SSH e2e target

Bring up the disposable SSH fixture:

```bash
docker compose -f docker-compose.test.yml up -d --build
npm run test:e2e
docker compose -f docker-compose.test.yml down --volumes
```

If you want to validate manually against the same fixture, connect with:

- host: `127.0.0.1`
- port: `2222`
- username: `testuser`
- password: `testpass`

Once it is reachable:

1. Run `record_baseline` several times while the host is healthy.
2. Run `analyze_server` with `duration_minutes` set to a small value such as `1` or `5`.
3. Run `compare_to_baseline` against the saved label.
4. Run `get_history` with and without `label` to confirm the new filter behavior.

## Pre-publish checklist

```bash
git status
git log --oneline -5
node --version
rm -rf node_modules dist
npm ci --legacy-peer-deps --ignore-scripts
npm rebuild better-sqlite3
npm run lint
npm run test:coverage
npm run test:e2e
npm run format:check
npm run build
npm pack --dry-run
npm publish --access public
git tag v$(node -p "require('./package.json').version")
git push origin main --tags
```

Verify that the packed tarball contains only `dist/`, `README.md`, `LICENSE`, `CHANGELOG.md`, `mcp.json`, and `docs/`.
