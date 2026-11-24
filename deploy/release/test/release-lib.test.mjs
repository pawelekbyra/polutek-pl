// Unit tests for the release helpers. Run: node --test deploy/release/test/
// (plain node:test, no dependencies; not part of the vitest suite).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { costOf, isExpired, isOurs, pickServerType } from '../lib/hcloud.mjs';
import { compareImages, validateManifest, SCHEMA } from '../lib/manifest.mjs';

const type = (name, cores, memory, gross, available = true, arch = 'x86') => ({
  name, cores, memory, architecture: arch, deprecation: null,
  locations: [{ name: 'nbg1', available }],
  prices: [{ location: 'nbg1', price_hourly: { gross: String(gross), net: String(gross / 1.23) } }],
});

test('pickServerType: cheapest available x86 that fits', () => {
  const types = [type('cx33', 4, 8, 0.0167, false), type('cpx32', 4, 8, 0.0699), type('ccx23', 4, 16, 0.1694),
    type('cax21', 4, 8, 0.02, true, 'arm'), type('cpx22', 2, 4, 0.0383)];
  assert.equal(pickServerType(types, { location: 'nbg1', minCores: 4, minMemGB: 8 }).name, 'cpx32');
  assert.equal(pickServerType(types, { location: 'nbg1', minCores: 4, minMemGB: 8, forced: 'ccx23' }).name, 'ccx23');
  assert.equal(pickServerType(types, { location: 'fsn1', minCores: 4, minMemGB: 8 }), null);
});

test('costOf: per started hour, plus IPv4', () => {
  const c = costOf({ priceHourlyGross: 0.07, ipv4HourlyGross: 0.001, seconds: 1800 });
  assert.equal(c.billed_hours, 1);
  assert.equal(c.billed_gross_eur, 0.071);
  assert.equal(c.exact_gross_eur, 0.0355);
  assert.equal(costOf({ priceHourlyGross: 0.07, seconds: 3601 }).billed_hours, 2);
});

test('isOurs: refuses unlabelled, foreign names and the production IP', () => {
  const ours = { name: 'polutek-rb-x', labels: { 'managed-by': 'polutek-release', role: 'builder' }, public_net: { ipv4: { ip: '1.2.3.4' } } };
  assert.equal(isOurs(ours, '9.9.9.9'), true);
  assert.equal(isOurs({ ...ours, labels: {} }, ''), false);
  assert.equal(isOurs({ ...ours, name: 'serwerek2' }, ''), false);
  assert.equal(isOurs(ours, '1.2.3.4'), false);
  assert.equal(isExpired({ labels: { expires: '100' } }, 101), true);
  assert.equal(isExpired({ labels: {} }, 101), false);
});

test('compareImages: id and revision must match', () => {
  const sha = 'a'.repeat(40);
  const img = (id, rev) => ({ RepoTags: ['polutek-app:t'], Id: id, Config: { Labels: { 'org.opencontainers.image.revision': rev } } });
  const id = `sha256:${'b'.repeat(64)}`;
  assert.deepEqual(compareImages({ refs: { app: 'polutek-app:t' }, builder: [img(id, sha)], local: [img(id, sha)], sha }).errors, []);
  assert.equal(compareImages({ refs: { app: 'polutek-app:t' }, builder: [img(id, sha)], local: [img(`sha256:${'c'.repeat(64)}`, sha)], sha }).errors.length, 1);
  assert.equal(compareImages({ refs: { app: 'polutek-app:t' }, builder: [img(id, sha)], local: [], sha }).errors.length, 1);
});

test('validateManifest: full release needs all four images', () => {
  const id = `sha256:${'b'.repeat(64)}`;
  const m = { schema: SCHEMA, revision: 'a'.repeat(40), tag: 't1', mode: 'full', images: {} };
  for (const k of ['app', 'migrator', 'worker', 'collector']) m.images[k] = { ref: `polutek-${k}:t1`, id };
  assert.deepEqual(validateManifest(m), []);
  delete m.images.worker;
  assert.equal(validateManifest(m).length, 1);
});
