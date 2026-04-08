import { readFileSync } from 'node:fs';

interface PackageMetadata {
  version: string;
}

export function getPackageVersion(): string {
  const raw = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
  return (JSON.parse(raw) as PackageMetadata).version;
}
