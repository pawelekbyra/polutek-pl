import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createReleaseInputs } from '../../../scripts/ops/release/inputs.mjs';

const bases = JSON.parse(readFileSync(path.join(process.cwd(), 'scripts/ops/release/bases-linux-amd64.json'), 'utf8'));

describe('immutable release build inputs', () => {
  it('uses pinned amd64 bases and exactly the public build variables', () => {
    const inputs = createReleaseInputs({ NEXT_PUBLIC_APP_URL: 'https://www.example.invalid', NEXT_PUBLIC_SITE_BETA: 'false' }, bases);
    expect(inputs.platform).toBe('linux/amd64');
    expect(inputs.bases).toEqual(bases);
    expect(inputs.public_args.NEXT_PUBLIC_APP_URL).toBe('https://www.example.invalid');
    expect(inputs.public_args.NEXT_PUBLIC_SITE_BETA).toBe('false');
    expect(Object.values(inputs.public_args).filter(value => value === '')).toHaveLength(6);
    expect(Object.values(inputs.public_args)).not.toContain('DATABASE_URL');
  });

  it('rejects mutable base tags', () => {
    expect(() => createReleaseInputs({}, { ...bases, node: 'node:22' })).toThrow('immutable registry digests');
  });
});
