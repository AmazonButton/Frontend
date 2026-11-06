import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { normalizePhoneNumber, exchangePhoneCredential, roleHome } from '../src/services/phone-auth-flow.ts';

const token = 'fixture-token-'.repeat(12);
test('normalizes Vietnamese and international phones without accepting malformed input', () => {
  assert.equal(normalizePhoneNumber('0912 345 678'), '+84912345678');
  assert.equal(normalizePhoneNumber('+84 (912) 345-678'), '+84912345678');
  assert.equal(normalizePhoneNumber('+14155550123'), '+14155550123');
  for (const bad of ['', '12345', '+0012345678', '0912abc678']) assert.throws(() => normalizePhoneNumber(bad));
});
test('phone registration uses trusted Firebase credential, exact customer DTO and normalizes backend userId', async () => {
  const calls = [];
  const api = { post: async (path, data) => { calls.push({path,data}); return {data:{success:true,accessToken:'backend-jwt',refreshToken:'refresh-fixture',user:{userId:'9007199254740999',role:'CUSTOMER'}}}; } };
  const result = await exchangePhoneCredential(api, 'register', token, {fullName:'  Người dùng thử  ',email:' test@example.invalid '});
  assert.deepEqual(calls, [{path:'/auth/register-by-phone',data:{firebaseIdToken:token,fullName:'Người dùng thử',role:'CUSTOMER',email:'test@example.invalid'}}]);
  assert.equal(result.user.id,'9007199254740999'); assert.equal(result.token,'backend-jwt');
});
test('phone login reads nested auth response without creating arbitrary profile fields', async () => {
  const result = await exchangePhoneCredential({post:async(path,data)=>{assert.equal(path,'/auth/login-by-phone');assert.deepEqual(Object.keys(data),['firebaseIdToken']);return{data:{success:true,data:{accessToken:'jwt',user:{id:'12',role:'STAFF_DELIVERY'}}}};}},'login',token);
  assert.equal(result.user.id,'12'); assert.equal(roleHome(result.user.role),'/driver/deliveries');
});
test('existing-account phone verification calls only protected verify endpoint', async () => {
  const result=await exchangePhoneCredential({post:async(path,data)=>{assert.equal(path,'/auth/phone/verify');assert.deepEqual(data,{firebaseIdToken:token});return{data:{success:true,data:{phoneNumber:'+84912345678'}}};}},'verify',token);
  assert.deepEqual(result,{verified:true});
});
test('refuses incomplete or failed auth responses and never turns API failure into login success', async () => {
  for(const data of [{success:false,message:'Số đã được đăng ký'},{success:true,data:{user:{userId:'12',role:'CUSTOMER'}}},{success:true,data:{accessToken:'jwt'}}]) await assert.rejects(exchangePhoneCredential({post:async()=>({data})},'login',token));
  await assert.rejects(exchangePhoneCredential({post:async()=>{throw Error('offline');}},'verify',token),/offline/);
});
test('validates credential and registration name before any backend request',async()=>{
  let calls=0;const api={post:async()=>{calls++;}};
  await assert.rejects(exchangePhoneCredential(api,'login','short'));
  await assert.rejects(exchangePhoneCredential(api,'register',token,{fullName:'A'}));
  assert.equal(calls,0);
});
test('every phone-login destination is accessible to its role',()=>{
  for(const role of ['SUPER_ADMIN','SYSTEM_ADMIN','ADMIN'])assert.equal(roleHome(role),'/admin/dashboard');
  for(const role of ['STORE_OWNER','STORE_MANAGER','STORE_STAFF'])assert.equal(roleHome(role),'/store/dashboard');
  for(const role of ['STAFF_ORDER','STAFF_DELIVERY'])assert.equal(roleHome(role),'/driver/deliveries');
  for(const role of ['STAFF_INVENTORY','STAFF_BUTTON','TECHNICIAN'])assert.equal(roleHome(role),'/profile');
});
test('phone verification remains authenticated and refreshable while phone login/register remain public',()=>{
  const require=createRequire(import.meta.url);const ts=require('typescript');
  for(const prefix of ['../src/','../frontend/src/']){
    const source=readFileSync(new URL(prefix+'services/api.ts',import.meta.url),'utf8');
    const tree=ts.createSourceFile('api.ts',source,ts.ScriptTarget.Latest,true);
    let expression;const visit=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(tree)==='isPublicAuthEndpoint')expression=node.initializer.getText(tree);ts.forEachChild(node,visit);};visit(tree);
    const code=ts.transpileModule(`(${expression})`,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
    const isPublic=vm.runInNewContext(code);
    assert.equal(isPublic('/auth/phone/verify'),false);
    assert.equal(isPublic('/auth/login-by-phone'),true);
    assert.equal(isPublic('/auth/register-by-phone'),true);
    assert.equal(isPublic('/orders'),false);
  }
});
