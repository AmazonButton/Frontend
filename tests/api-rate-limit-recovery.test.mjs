import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);const ts=require('typescript');const {AxiosHeaders}=require('axios');
const compile=source=>ts.transpileModule(source.replaceAll('import.meta','importMeta'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const jwt=(exp,subject='1')=>`header.${Buffer.from(JSON.stringify({exp,sub:subject})).toString('base64url')}.signature`;
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};

function harness(prefix='../src/'){
  let now=1700000000000;const calls={refresh:[],wire:[],refreshImpl:null,wireImpl:null};
  const values=new Map([['smart_order_user',JSON.stringify({id:'1',role:'STORE_OWNER'})],['smart_order_refresh_token','refresh-A'],['smart_order_token',jwt(now/1000-60)]]);
  const localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
  class Clock extends Date{static now(){return now;}}
  const events=new Map();const window={location:{hostname:'localhost',pathname:'/store/dashboard',search:'',href:''},dispatchEvent:event=>(events.get(event.type)||[]).forEach(cb=>cb(event)),addEventListener:(key,cb)=>events.set(key,[...(events.get(key)||[]),cb]),removeEventListener:()=>{}};
  let request,responseError;
  const api=async config=>{
    let actual=config;
    try{actual=await request({...config,headers:new AxiosHeaders(config.headers||{}),baseURL:config.baseURL||'/api/v1'});calls.wire.push(actual);return calls.wireImpl?await calls.wireImpl(actual):{data:{success:true,data:[]}};}
    catch(error){error.config ||=actual;return responseError(error);}
  };
  api.defaults={headers:{common:{}},baseURL:'/api/v1'};
  api.interceptors={request:{use:fn=>{request=fn;}},response:{use:(_,fail)=>{responseError=fail;}}};
  api.get=(url,config={})=>api({...config,url,method:'get'});
  api.post=(url,data,config={})=>api({...config,url,data,method:'post'});
  const axios=config=>api(config);
  axios.create=()=>api;axios.CanceledError=class extends Error{code='ERR_CANCELED';};
  axios.post=async(url,data,config)=>{calls.refresh.push({url,data,config});return calls.refreshImpl?await calls.refreshImpl():{data:{success:true,data:{accessToken:jwt(now/1000+3600),refreshToken:'refresh-next'}}};};
  const common={localStorage,window,Date:Clock,Event,FormData,atob,decodeURIComponent,console,importMeta:{env:{}}};
  const backoff={};vm.runInNewContext(compile(readFileSync(new URL(prefix+'services/request-backoff.ts',import.meta.url),'utf8')),{...common,exports:backoff});
  const module={exports:{}};vm.runInNewContext(compile(readFileSync(new URL(prefix+'services/api.ts',import.meta.url),'utf8')),{...common,module,exports:module.exports,require:name=>name==='axios'?axios:name==='./request-backoff'?backoff:assert.fail(name)});
  return {exports:module.exports,api,calls,localStorage,values,window,backoff,advance:ms=>{now+=ms;},valid:()=>jwt(now/1000+3600),now:()=>now,common};
}
for(const prefix of ['../src/','../frontend/src/']){
  test(`${prefix}concurrent proactive/forced refreshes share one actual HTTP refresh`,async()=>{
    const h=harness(prefix);let resolve;h.calls.refreshImpl=()=>new Promise(done=>{resolve=done;});
    const promises=Array.from({length:20},(_,i)=>h.exports.getOrRefreshValidToken(Boolean(i%2)));
    assert.equal(h.calls.refresh.length,1);resolve({data:{success:true,data:{accessToken:h.valid(),refreshToken:'rotated'}}});
    const results=await Promise.all(promises);assert.ok(results.every(value=>value===h.valid()));assert.equal(h.values.get('smart_order_refresh_token'),'rotated');
  });
  test(`${prefix}refresh 429 keeps session and blocks HTTP until Retry-After expires`,async()=>{
    const h=harness(prefix);h.calls.refreshImpl=async()=>{throw{response:{status:429,headers:{'retry-after':'120'}}};};
    assert.equal(await h.exports.getOrRefreshValidToken(),null);assert.equal(h.values.get('smart_order_refresh_token'),'refresh-A');assert.ok(h.values.has('smart_order_user'));
    for(let i=0;i<10;i++){assert.equal(await h.exports.getOrRefreshValidToken(true),null);await assert.rejects(h.api.get('/orders'),error=>error.code==='API_COOLDOWN');}
    assert.equal(h.calls.refresh.length,1);assert.equal(h.calls.wire.length,0);
    h.advance(120001);h.calls.refreshImpl=null;assert.equal(await h.exports.getOrRefreshValidToken(),h.valid());assert.equal(h.calls.refresh.length,2);
  });
  test(`${prefix}orders 429 pauses later polling/mutations without retrying or logging out`,async()=>{
    const h=harness(prefix);h.values.set('smart_order_token',h.valid());h.calls.wireImpl=async()=>{throw{response:{status:429,headers:{'retry-after':'90'}}};};
    await assert.rejects(h.api.post('/orders/18/claim',{}),error=>error.code==='API_COOLDOWN');
    await Promise.all(Array.from({length:12},()=>assert.rejects(h.api.get('/orders'),error=>error.code==='API_COOLDOWN')));
    assert.equal(h.calls.wire.length,1);assert.equal(h.calls.refresh.length,0);assert.equal(h.values.get('smart_order_refresh_token'),'refresh-A');assert.equal(h.window.location.href,'');
  });
  test(`${prefix}refresh network failures preserve credentials and have a cooldown`,async()=>{
    const h=harness(prefix);h.calls.refreshImpl=async()=>{throw Error('offline');};
    await h.exports.getOrRefreshValidToken();await h.exports.getOrRefreshValidToken(true);
    assert.equal(h.calls.refresh.length,1);assert.ok(h.values.has('smart_order_token'));assert.ok(h.backoff.getApiRetryUntil()>h.now());
  });
  test(`${prefix}explicitly rejected refresh clears only the rejected session`,async()=>{
    const h=harness(prefix);h.calls.refreshImpl=async()=>{throw{response:{status:401}};};await h.exports.getOrRefreshValidToken();assert.equal(h.values.has('smart_order_refresh_token'),false);assert.equal(h.values.has('smart_order_user'),false);
  });
  test(`${prefix}late refresh success cannot overwrite a later login`,async()=>{
    const h=harness(prefix);let resolve;h.calls.refreshImpl=()=>new Promise(done=>{resolve=done;});const pending=h.exports.getOrRefreshValidToken();
    h.values.set('smart_order_user',JSON.stringify({id:'2'}));h.values.set('smart_order_refresh_token','refresh-B');const b=jwt(h.now()/1000+3600,'2');h.values.set('smart_order_token',b);
    resolve({data:{success:true,accessToken:h.valid(),refreshToken:'rotated-A'}});assert.equal(await pending,null);assert.equal(h.values.get('smart_order_token'),b);assert.equal(h.values.get('smart_order_refresh_token'),'refresh-B');
  });
  test(`${prefix}simultaneous API 401 recovery uses the same refresh and retries each request once`,async()=>{
    const h=harness(prefix);h.values.set('smart_order_token',h.valid());let resolve;h.calls.refreshImpl=()=>new Promise(done=>{resolve=done;});
    h.calls.wireImpl=async config=>{if(!config._retry)throw{response:{status:401}};return{data:{success:true}};};
    const pending=Array.from({length:6},()=>h.api.get('/orders'));await flush();assert.equal(h.calls.refresh.length,1);
    resolve({data:{success:true,data:{accessToken:h.valid(),refreshToken:'rotated'}}});const results=await Promise.all(pending);assert.ok(results.every(result=>result.data.success));assert.equal(h.calls.wire.length,12);assert.equal(h.calls.refresh.length,1);
  });
  test(`${prefix}Retry-After dates and rate-limit reset headers are honored across reloads`,()=>{
    const h=harness(prefix);h.backoff.recordRateLimit({response:{headers:{'retry-after':new Date(h.now()+180000).toUTCString()}}});assert.equal(h.backoff.getApiRetryUntil(),h.now()+180000);
    h.advance(180001);h.backoff.recordRateLimit({response:{headers:{'ratelimit-reset':'900'}}});assert.equal(h.backoff.getApiRetryUntil(),h.now()+900000);
    assert.equal(Number(h.values.get('smart_order_api_retry_after')),h.now()+900000);
  });
}

function socketHarness(){
  let now=1700000000000;let next=0;let retryUntil=0;let disposal;const timers=new Map();const intervals=new Map();const handlers=new Map();const pageEvents=new Map();const refreshCalls=[];let connections=0;let disconnections=0;let options;
  const values=new Map([['smart_order_token','valid'],['smart_order_refresh_token','refresh-A']]);const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const socket={connected:false,auth:{},on:(event,callback)=>{handlers.set(event,callback);return socket;},emit(){},connect(){connections++;return socket;},disconnect(){disconnections++;socket.connected=false;handlers.get('disconnect')?.('io client disconnect');return socket;}};
  class Clock extends Date{static now(){return now;}}
  const setTimeout=(cb,delay)=>{const id=++next;timers.set(id,{cb,at:now+delay});return id;};const clearTimeout=id=>timers.delete(id);
  const window={addEventListener:(name,fn)=>pageEvents.set(name,fn),removeEventListener:name=>pageEvents.delete(name)};
  const module={exports:{}};
  const source=readFileSync(new URL('../src/services/socket.ts',import.meta.url),'utf8');
  vm.runInNewContext(compile(source),{exports:module.exports,module,window,localStorage:storage,Date:Clock,Math:{...Math,random:()=>0,min:Math.min,max:Math.max,floor:Math.floor},setTimeout,clearTimeout,setInterval:fn=>{intervals.set(++next,fn);return next;},clearInterval:id=>intervals.delete(id),importMeta:{env:{},hot:{dispose:fn=>{disposal=fn;}}},require:name=>{
    if(name==='socket.io-client')return{io:(_,opts)=>{options=opts;return socket;}};
    if(name==='./api')return{API_URL:'https://api.example.test',resolveApiUrl:()=> 'https://api.example.test',isTokenExpired:token=>token!=='valid',getOrRefreshValidToken:async force=>{refreshCalls.push(force);return values.get('smart_order_token')==='valid'?'valid':null;}};
    if(name==='./request-backoff')return{API_BACKOFF_EVENT:'backoff',getApiRetryUntil:()=>retryUntil>now?retryUntil:0,recordRateLimit:()=>{retryUntil=now+120000;}};
    assert.fail(name);
  }});
  return{...module.exports,socket,values,timers,intervals,refreshCalls,get connections(){return connections;},get options(){return options;},get disconnections(){return disconnections;},now:()=>now,async next(){const entry=[...timers.entries()].sort((a,b)=>a[1].at-b[1].at)[0];assert.ok(entry,'retry exists');timers.delete(entry[0]);now=entry[1].at;entry[1].cb();await flush();},error:err=>handlers.get('connect_error')(err),pageEvents,dispose:()=>disposal(),pause:until=>{retryUntil=until;}};
}
test('actual socket implementation never force-refreshes for generic websocket/429 errors and backs off',async()=>{
  const h=socketHarness();h.getSocket();assert.equal(h.options.autoConnect,false);assert.equal(h.options.reconnection,false);await h.next();assert.equal(h.connections,1);
  h.error({message:'websocket error'});const first=[...h.timers.values()][0].at-h.now();assert.equal(first,5000);await h.next();assert.equal(h.connections,2);
  h.error({message:'websocket error'});assert.equal([...h.timers.values()][0].at-h.now(),10000);h.subscribeToStore('18');h.subscribeToCustomer('21');assert.equal(h.connections,2);
  await h.next();h.error({message:'Too Many Requests',status:429});assert.ok([...h.timers.values()][0].at-h.now()>=120000);assert.equal(h.refreshCalls.includes(true),false);h.dispose();
});
test('logout/public pages create no unauthenticated socket and cancel pending reconnects',async()=>{
  const h=socketHarness();h.values.clear();h.getSocket();assert.equal(h.connections,0);assert.equal(h.timers.size,0);
  h.values.set('smart_order_token','valid');h.updateSocketAuth('valid');await h.next();h.error({message:'network down'});assert.equal(h.timers.size,1);
  h.values.clear();h.updateSocketAuth(null);assert.equal(h.timers.size,0);assert.ok(h.disconnections>=1);h.dispose();
});
test('hot reload disposes websocket timers and listeners rather than multiplying retries',async()=>{
  const h=socketHarness();h.getSocket();await h.next();h.error({message:'network down'});h.dispose();assert.equal(h.timers.size,0);assert.equal(h.intervals.size,0);assert.equal(h.pageEvents.size,0);
});
test('AuthContext retains a transiently unavailable session instead of wiping it on 429',async()=>{
  const h=harness();const source=readFileSync(new URL('../src/context/AuthContext.tsx',import.meta.url),'utf8');const tree=ts.createSourceFile('AuthContext.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let body;
  const visit=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(tree)==='refreshUser')body=node.initializer.arguments[0].getText(tree);ts.forEachChild(node,visit);};visit(tree);
  const state={error:null,user:'kept',token:'kept'};
  const callback=vm.runInNewContext(compile(`(${body})`),{...h.common,apiSessionMarker:()=> 'same',getOrRefreshValidToken:async()=>null,getApiRetryUntil:()=> h.now()+60000,apiCooldownError:()=>({message:'Vui lòng thử lại sau 60 giây.'}),setSessionError:value=>state.error=value,setIsLoading(){},setUser:value=>state.user=value,setToken:value=>state.token=value,clearSocketSubscriptions:()=>assert.fail('Must retain subscriptions'),updateSocketAuth:()=>assert.fail('Must retain session')});
  await callback();assert.ok(state.error.includes('60'));assert.equal(state.user,'kept');assert.equal(state.token,'kept');assert.equal(h.values.get('smart_order_refresh_token'),'refresh-A');
});
