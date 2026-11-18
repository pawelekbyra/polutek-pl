import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(path.join(process.cwd(), '.github/workflows/images.yml'), 'utf8');

describe('GHCR image workflow release gate', () => {
  it('produces and verifies all pinned images before authenticating or publishing', () => {
    const produce = workflow.indexOf('scripts/ops/release-produce.mjs');
    const verify = workflow.indexOf('scripts/ops/release-proof.mjs verify');
    const login = workflow.indexOf('docker/login-action');
    const publish = workflow.indexOf('scripts/ops/release-publish.mjs');

    expect(produce).toBeGreaterThanOrEqual(0);
    expect(verify).toBeGreaterThan(produce);
    expect(login).toBeGreaterThan(verify);
    expect(publish).toBeGreaterThan(login);
    expect(workflow).not.toContain('docker/build-push-action');
    expect(workflow).not.toMatch(/^\s*push:\s*true\s*$/m);
  });
});
