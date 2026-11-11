import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';

test('actual Blob SDK accepts request-only OIDC, refreshes each read and preserves scope guards without network',async()=>{
 const result=await promisify(execFile)(process.execPath,[fileURLToPath(new URL('../scripts/check-media-oidc-context.mjs',import.meta.url))],{timeout:15000});
 assert.match(result.stdout,/passed: true/);assert.match(result.stdout,/interceptedReads: 2/);assert.match(result.stdout,/networkDisabled: true/);assert.equal(result.stderr,'');
});
