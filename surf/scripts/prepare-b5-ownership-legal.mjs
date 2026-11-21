// Offline additive preparation. No database connection or publication.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { legalContentHash } from '../lib/legal/b5-legal-preparation.mjs';
import { ownershipSourceBundleHash, prepareOwnershipPrivacyBundle } from '../lib/legal/b5-ownership-amendments.mjs';

assert.equal(process.argv.length, 2, 'This offline preparation takes no arguments.');
const sourceFile = new URL('../docs/private/b5-legal-candidates.json', import.meta.url);
assert.equal((await fs.stat(sourceFile)).mode & 0o077, 0, 'Source bundle must be private.');
const sourceBytes = await fs.readFile(sourceFile, 'utf8');
assert.equal(legalContentHash(sourceBytes), ownershipSourceBundleHash, 'Reviewed .2 source bundle changed.');
const bundle = prepareOwnershipPrivacyBundle(JSON.parse(sourceBytes));
const bytes = JSON.stringify(bundle, null, 2) + '\n';
const destination = new URL('../docs/private/b5-ownership-privacy-candidates.json', import.meta.url);
try {
  await fs.writeFile(destination, bytes, { mode: 0o600, flag: 'wx' });
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  assert.equal((await fs.stat(destination)).mode & 0o077, 0, 'Existing ownership bundle must be private.');
  assert(await fs.readFile(destination, 'utf8') === bytes, 'Refusing to replace a different prepared bundle.');
}
console.log(JSON.stringify({ prepared: true, published: false, sourceBundleSha256: ownershipSourceBundleHash,
  bundleSha256: legalContentHash(bytes), reviewVersion: bundle.review_version,
  stagingVersion: bundle.staging_test_version, documentsPerEnvironment: 4 }));
