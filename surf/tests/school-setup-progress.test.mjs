import test from 'node:test';
import assert from 'node:assert/strict';
import { schoolSetupProgress } from '../lib/school-setup-progress.mjs';
import { schoolMessages } from '../lib/locale/school-messages.mjs';
import { createLocale } from '../lib/locale/index.mjs';
const school = {id:'school-a',name:'School',description:'Lessons',timezone:'Europe/Lisbon',contactEmail:'a@example.invalid',operatingSpotIds:['spot']};
const document = {document_id:'mywaveplan.school-processing',kind:'school_processing',version:'v1',language:'fr',content_hash:'hash',status:'published'};
const acceptance = {...document,school_id:school.id};
test('setup uses saved fields and exact school agreement evidence',()=>{
  assert.equal(schoolSetupProgress(school,{documents:[document],acceptances:[acceptance]}).done,5);
  for(const change of [{school_id:'other'},{version:'v2'},{language:'es'},{content_hash:'different'}]) {
    assert.equal(schoolSetupProgress(school,{documents:[document],acceptances:[{...acceptance,...change}]}).done,4);
  }
  assert.equal(schoolSetupProgress({...school,description:'',contactEmail:'',operatingSpotIds:[]}).done,1);
});
test('staging preview evidence cannot complete the published-agreement step or enable access',()=>{
  const result=schoolSetupProgress(school,{documents:[{...document,status:'staging_preview'}],acceptances:[acceptance]});
  assert.equal(result.done,4);assert.equal(result.preview,true);assert.equal(result.previewAccepted,true);
  assert.equal(Object.hasOwn(result,'pilotAccessStatus'),false);
});
test('all school setup text exists in each enabled language and preserves placeholders',()=>{
  const english=schoolMessages['en-GB'];
  for(const locale of ['en-GB','pt-PT','es','fr']) {
    assert.deepEqual(Object.keys(schoolMessages[locale]),Object.keys(english));
    for(const key of Object.keys(english)) {
      assert(schoolMessages[locale][key]?.trim(),locale+': '+key);
      assert.deepEqual(schoolMessages[locale][key].match(/\{\w+\}/g),english[key].match(/\{\w+\}/g));
      assert.equal(createLocale(locale).t(key),schoolMessages[locale][key]);
    }
  }
});
