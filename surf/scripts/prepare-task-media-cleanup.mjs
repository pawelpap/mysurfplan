import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {connect} from './membership-migration-support.mjs';
import {preflightTaskMediaCleanup} from '../lib/task-media-cleanup.mjs';

// Read-only preflight. A separate lead-owned coordinator supplies the runtime
// maintenance callback and commits stage/finalise transactions explicitly.
const[environment,manifestPath,outputPath]=process.argv.slice(2);
assert(['rehearsal','staging','production'].includes(environment)&&manifestPath&&outputPath,
 'Usage: node scripts/prepare-task-media-cleanup.mjs <environment> <sanitised-manifest.json> <new-private-plan.json>');
const stat=await fs.stat(manifestPath);assert.equal(stat.mode&0o077,0,'Sanitised fixture manifest must be private');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));assert.equal(manifest.environment,environment);
assert(Object.keys(manifest).every(key=>['environment','prefix','userIds','schoolIds','allowedVersionPins','allowedAssetPinIds'].includes(key)),
 'Use a sanitised cleanup manifest, never the account/password fixture file');
const client=await connect(environment);
try{const plan=await preflightTaskMediaCleanup(client,manifest);
 await fs.writeFile(outputPath,JSON.stringify(plan,null,2),{mode:0o600,flag:'wx'});
 console.log(JSON.stringify({operation:'read-only-preflight',environment,assets:plan.assets.length,objects:plan.objects.length,inventoryDigest:plan.inventoryDigest,planPath:outputPath}));
}finally{await client.end();}
