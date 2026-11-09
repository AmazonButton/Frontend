import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);const ts=require('typescript');
function method(prefix,name,api){
  const source=readFileSync(new URL(`${prefix}services/rentals.service.ts`,import.meta.url),'utf8');
  const tree=ts.createSourceFile('rentals.ts',source,ts.ScriptTarget.Latest,true);let body;
  const visit=node=>{if(ts.isMethodDeclaration(node)&&node.name.getText(tree)===name)body=node.getText(tree).replace(/^async /,'async function ');ts.forEachChild(node,visit);};visit(tree);
  const code=ts.transpileModule(`(${body})`,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
  return vm.runInNewContext(code,{api,console,window:{},localStorage:{getItem:()=> 'PAID',setItem:()=>assert.fail('Browser must not fabricate financial status')}});
}
for(const prefix of ['../src/','../frontend/src/']){
  test(`${prefix}rental read failures propagate rather than pretending the account or catalog is empty`,async()=>{
    const failure=Object.assign(new Error('server failure'),{response:{status:500}});
    for(const name of ['getMyRentals','listPackages']){
      await assert.rejects(method(prefix,name,{get:async()=>{throw failure;}})(),error=>error===failure);
      await assert.rejects(method(prefix,name,{get:async()=>({data:{success:false}})})(),/không hợp lệ/);
    }
  });
  test(`${prefix}rental list ignores stale browser PAID overrides`,async()=>{const result=await method(prefix,'getMyRentals',{get:async()=>({data:{success:true,data:[{rentalId:'18',status:'PENDING_PAYMENT'}]}})})();assert.equal(result[0].status,'PENDING_PAYMENT');});
  test(`${prefix}rental payment propagates missing backend route and preserves unpaid state`,async()=>{await assert.rejects(method(prefix,'payRental',{post:async()=>{throw Error('route unavailable');}})('18'),/route unavailable/);});
  test(`${prefix}rental payment does not succeed without canonical server confirmation`,async()=>{const pay=method(prefix,'payRental',{post:async()=>({data:{success:true}}),get:async()=>({data:{success:true,data:[{rentalId:'18',status:'PENDING_PAYMENT'}]}})});await assert.rejects(pay('18'),/chưa xác nhận/);});
  test(`${prefix}paid and active are distinct authoritative rental results`,async()=>{for(const status of ['PAID','ACTIVE']){const result=await method(prefix,'payRental',{post:async()=>({data:{success:true}}),get:async()=>({data:{success:true,data:[{rentalId:'18',status}]}})})('18');assert.equal(result.data.status,status);}});
}
