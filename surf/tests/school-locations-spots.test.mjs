import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {schoolBaseLocationInput,schoolSettingsInput} from '../lib/school-onboarding.mjs';
import {validBasePoint} from '../lib/school-location.mjs';
import {schoolLessonError} from '../lib/school-lesson-errors.mjs';
import {isUuid,validateLesson} from '../lib/lesson-input.mjs';
import {schoolLocationMessages} from '../lib/locale/school-location-messages.mjs';

const actor=randomUUID(),school=randomUUID(),spot=randomUUID(),lesson=randomUUID(),coach=randomUUID();
const body={school:'school-slug',startAt:'2027-01-01T10:00:00.000Z',durationMin:90,difficulty:'Beginner',place:'Test entrance',capacity:4,spotId:spot,coachIds:[]};
const response=()=>({statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;},end(){return this;}});
async function api(path,sql,requireAuth=async()=>({userId:actor})) {
 const key='__b5Location'+randomUUID().replaceAll('-','');
 globalThis[key]={sql,requireAuth,requireMutation:()=>true,isUuid,validateLesson,schoolLessonError};
 let source=await fs.readFile(new URL('../pages/api/'+path,import.meta.url),'utf8');
 source=source.replace(/import\s+\{([^}]+)\}\s+from\s+["'][^"']+["'];/g,(_,names)=>`const {${names}}=globalThis.${key};`);
 try{return(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;}
 finally{delete globalThis[key];}
}
test('base input is private by default, accepts zero and rejects partial/forged/nonfinite public locations',()=>{
 assert.deepEqual(schoolBaseLocationInput(),{hasFixedBase:false,address:'',latitude:null,longitude:null,publicVisible:false});
 const base={hasFixedBase:true,address:'  Test base  ',latitude:0,longitude:0,publicVisible:true};
 assert.deepEqual(schoolBaseLocationInput(base),{...base,address:'Test base'});
 for(const patch of [{latitude:null},{longitude:181},{latitude:91},{latitude:NaN},{longitude:Infinity},{latitude:'0'},
  {hasFixedBase:false},{publicVisible:'yes'},{address:'bad\naddress'},{privateBillingAddress:'forged'}])
  assert.throws(()=>schoolBaseLocationInput({...base,...patch}),/schoolLocation.invalid/);
 assert.throws(()=>schoolBaseLocationInput({...base,latitude:null,longitude:null}),/schoolLocation.invalid/);
 const oldClient=schoolSettingsInput({id:school,revision:1,name:'School',timezone:'UTC'},'update');
 assert(!Object.hasOwn(oldClient,'baseLocation'),'Old update clients must preserve an existing base');
});
test('map-point validation distinguishes missing values from real zero coordinates',()=>{
 for(const point of [{latitude:0,longitude:0},{latitude:'0',longitude:'-9.1'},{latitude:90,longitude:-180}])assert(validBasePoint(point));
 for(const point of [null,{}, {latitude:null,longitude:null},{latitude:'',longitude:''},{latitude:' ',longitude:' '},{latitude:true,longitude:0},
  {latitude:NaN,longitude:0},{latitude:0,longitude:Infinity},{latitude:91,longitude:0},{latitude:0,longitude:181}])assert(!validBasePoint(point));
});
test('lesson create sends one actor-scoped transactional mutation after resolving the school',async()=>{
 const calls=[];
 const handler=await api('lessons/index.js',async(strings,...values)=>{
  const query=strings.join('?');calls.push(query);
  if(query.includes('mutate_school_lesson')){assert.equal(values[0],actor);assert.equal(values[1],school);assert.deepEqual(JSON.parse(values[2]),validateLesson(body));return[{data:{id:lesson,schoolId:school,...validateLesson(body)}}];}
  assert(query.includes('SELECT id FROM schools'));return[{id:school}];
 });
 const res=response();await handler({method:'POST',body,query:{}},res);
 assert.equal(res.statusCode,201);assert.equal(res.body.data.spotId,spot);assert.equal(calls.length,2);
 assert(!calls.some(query=>/INSERT INTO lessons|UPDATE lessons|INSERT INTO lesson_coaches/.test(query)));
});
test('update, delete and instructor assignment use current actor and exact lesson school in one mutation',async()=>{
 for(const [path,method,functionName,input] of [['lessons/[id]/index.js','PUT','mutate_school_lesson',body],['lessons/[id]/index.js','DELETE','mutate_school_lesson',{}],['lessons/[id]/coaches.js','PUT','set_school_lesson_coaches',{coachIds:[coach,coach]}]]){
  let writes=0;
  const handler=await api(path,async(strings,...values)=>{
   const query=strings.join('?');
   if(query.includes(functionName)){writes++;assert.deepEqual(values.slice(0,2),[actor,school]);return[{data:{id:lesson}}];}
   assert(query.includes('FROM lessons'));return[{id:lesson,school_id:school}];
  });
  const res=response();await handler({method,query:{id:lesson},body:input},res);
  assert.equal(res.statusCode,200);assert.equal(writes,1);
 }
});
test('transaction denials produce safe translated keys without upstream diagnostics',async()=>{
 for(const [code,status] of [['42501',403],['22023',400],['23514',409],['40P01',409],['40001',409],['P0002',404],['unknown',503]]){
  const problem=schoolLessonError({code,message:'private database diagnostic'});assert.equal(problem.status,status);assert(!problem.message.includes('private'));
 }
 const handler=await api('lessons/[id]/index.js',async(strings)=>{
  if(strings.join('?').includes('mutate_school_lesson'))throw{code:'22023',message:'Choose an active school operating spot'};
  return[{id:lesson,school_id:school}];
 });
 const res=response();await handler({method:'PUT',query:{id:lesson},body},res);
 assert.equal(res.statusCode,400);assert.equal(res.body.error,'schoolLocation.spotNotAllowed');
});
test('settings catalogue and lesson spots require scoped authority and expose only their bounded projection',async()=>{
 let queries=0;
 const denied=await api('school-onboarding/spots.js',async()=>{queries++;return[{allowed:false}];});
 const refusal=response();await denied({method:'GET',query:{schoolId:school,settings:'1'}},refusal);assert.equal(refusal.statusCode,403);assert.equal(queries,1);
 const handler=await api('school-onboarding/spots.js',async(strings)=>{
  const query=strings.join('?');
  if(query.includes('AS allowed'))return[{allowed:true}];
  assert(query.includes('account_reads_school_settings'));assert(query.includes('school_is_operational'));assert(!query.includes('contact_email'));
  return[{id:spot,name:'Test spot',region:'Test',country_code:'PT',latitude:0,longitude:0,timezone:'UTC',active:false,selected:true,private:'omitted'}];
 });
 const res=response();await handler({method:'GET',query:{schoolId:school,settings:'1'}},res);
 assert.equal(res.statusCode,200);assert.equal(res.body.data[0].active,false);assert(!('private'in res.body.data[0]));
});
test('all four location catalogues contain matching complete translated keys',()=>{
 const keys=Object.keys(schoolLocationMessages['en-GB']).sort();
 for(const locale of ['en-GB','pt-PT','es','fr']){
  const catalogue=schoolLocationMessages[locale];assert.deepEqual(Object.keys(catalogue).sort(),keys);
  for(const value of Object.values(catalogue))assert.equal(typeof value,'string');
  assert(catalogue['schoolLocation.mapDisclosure'].includes('OpenStreetMap'));
  assert(catalogue['schoolLocation.lookupDisclosure'].includes('Geoapify'));
  assert(catalogue['schoolLocation.spotInUse']);
 }
});
