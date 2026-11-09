import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import * as plans from '../src/services/store-service-plans.ts';
import * as frontendPlans from '../frontend/src/services/store-service-plans.ts';
import * as overview from '../src/services/store-subscription-overview.ts';
import { financeError } from '../src/services/store-finance-flow.ts';
const require = createRequire(import.meta.url), ts = require('typescript');
const plan = { planId: '1', planCode: 'SHOP', planName: 'Gói gian hàng', description: 'Gói từ API', price: 60000, durationDays: 30, maxProducts: 10, isActive: true };
const subscription = { subscriptionId: '19', storeId: '12', planId: '1', status: 'ACTIVE', startDate: '2020-01-01T00:00:00Z', endDate: '2099-01-01T00:00:00Z', plan };
const ok = data => ({ data: { success: true, data } });
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const visibleText = node => node == null || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node) : [node.props?.children].flat(Infinity).map(visibleText).join('');

test('subscription fees aggregate posted ledger transactions across server pages without inferring payment from a plan price', async () => {
  const calls=[];
  const result=await overview.loadSubscriptionPayments({get:async(path,config)=>{calls.push({path,config});return{data:{success:true,data:[{transactionId:String(config.params.page),type:'SUBSCRIPTION_PAYMENT',amount:-60000,createdAt:'2026-11-08T00:00:00Z'}],pagination:{totalPages:2}}};}});
  assert.equal(calls.length,2);assert.equal(calls[1].config.params.page,2);assert.equal(calls[0].config.params.type,'SUBSCRIPTION_PAYMENT');
  assert.equal(result[0].status,'POSTED');assert.equal(overview.subscriptionPaidTotal(result),120000);
  let count=0;
  const cancelled=await overview.loadSubscriptionPayments({get:async()=>{count++;return{data:{success:true,data:[],pagination:{totalPages:2}}};}},()=>count===0);
  assert.equal(cancelled,null);assert.equal(count,1);
});

for (const service of [plans, frontendPlans]) {
  test('PayOS is offered only for the unique plan supported by the deployed fixed-price renewal contract', async () => {
    assert.equal(service.eligibleStorePayosPlan([plan], '1'), true);
    assert.equal(service.eligibleStorePayosPlan([plan, {...plan,planId:'2'}], '1'), false);
    assert.equal(service.eligibleStorePayosPlan([{...plan,durationDays:60}], '1'), false);
    assert.equal(service.eligibleStorePayosPlan([{...plan,price:120000}], '1'), false);
    assert.equal(service.storePlanCheckoutUrl('https://pay.payos.vn/web/pl_123'), null, 'known mock checkout URLs are rejected');
    assert.equal(service.storePlanCheckoutUrl('javascript:alert(1)'), null);
    const flow=service.createStorePlanFlow({get:async()=>ok({chargeId:'33',storeId:'99',purpose:'STORE_SUBSCRIPTION',targetType:'STORE',totalAmount:60000,status:'PAID'})});
    await assert.rejects(flow.charge('12','33'),/cửa hàng/);
  });
  test('only an effective ACTIVE store period with remaining real quota permits new products', () => {
    assert.equal(service.storeListingEntitlement(subscription, 9).allowed, true);
    for (const row of [null, { ...subscription, status: 'CANCELLED' }, { ...subscription, endDate: '2021-01-01' }, { ...subscription, startDate: '2098-01-01' }, { ...subscription, startDate: 'bad' }]) assert.equal(service.storeListingEntitlement(row, 0).allowed, false);
    assert.equal(service.storeListingEntitlement(subscription, 10).allowed, false);
    assert.equal(service.storeListingEntitlement(subscription, null).allowed, false);
    assert.equal(service.storeListingEntitlement(subscription, 10, false).allowed, true, 'reactivating a counted product does not consume a new slot');
    assert.equal(service.storeListingEntitlement({ ...subscription, plan: { ...plan, maxProducts: 0 } }, 0).allowed, false);
    assert.equal(service.storeListingEntitlement(subscription, 0, true, Date.parse(subscription.endDate)).allowed, false);
  });
  test('listing guard reads the authenticated period and server total, not first-page length', async () => {
    const calls = [];
    const flow = service.createStorePlanFlow({ get: async (path, config) => { calls.push({path,config}); return path.includes('/current') ? ok(subscription) : { data: { success: true, data: [{ id: '1' }], pagination: { totalItems: 10 } } }; } });
    const access = await flow.listingAccess('12'); assert.equal(access.allowed, false); assert.equal(access.totalProducts, 10);
    assert.deepEqual(calls.map(c=>c.path), ['/store/subscriptions/current','/products']);
    const other = service.createStorePlanFlow({ get: async()=>ok({ ...subscription, storeId: '99' }) }); await assert.rejects(other.current('12'), /cửa hàng/);
    let countRead = false;
    const expired = service.createStorePlanFlow({ get: async path => { if (path === '/products') countRead = true; return ok({ ...subscription, endDate: '2021-01-01' }); } });
    assert.equal((await expired.listingAccess('12')).allowed, false); assert.equal(countRead,false);
  });
  test('catalog and subscription use deployed store APIs, exact DTO and a stable idempotency key', async () => {
    const calls = [];
    const flow = service.createStorePlanFlow({ get: async path => { calls.push(path); return ok([plan]); }, post: async(path,body,config)=>{ calls.push({path,body,config}); return ok(subscription); } });
    assert.equal((await flow.plans())[0].price,60000);
    await flow.subscribe('12','1','store-plan:abc'); await flow.subscribe('12','1','store-plan:abc');
    assert.deepEqual(calls[1].body,{planId:1,idempotencyKey:'store-plan:abc'}); assert.deepEqual(calls[1],calls[2]);
    assert.equal(calls[1].path,'/store/subscriptions/subscribe'); assert.equal(calls[1].config.headers['idempotency-key'],'store-plan:abc');
    assert.equal(calls.some(c=>typeof c==='string'&&c.includes('/admin/')),false);
    await assert.rejects(flow.subscribe('12','90071992547409931','store-plan:abc'));
    assert.throws(()=>service.readStorePlan({...plan,price:undefined}));
    assert.throws(()=>service.readStorePlan({...plan,maxProducts:null}));
  });
}

function callback(prefix, name, context) {
  const source = readFileSync(new URL(prefix+'pages/store/StoreProductsPage.tsx',import.meta.url),'utf8');
  const ast=ts.createSourceFile('products.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let expression;
  const visit=n=>{if(ts.isVariableDeclaration(n)&&n.name.getText(ast)===name)expression=n.initializer.getText(ast);ts.forEachChild(n,visit);};visit(ast);assert.ok(expression);
  return vm.runInNewContext(ts.transpileModule(`(${expression})`,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);
}
function screen(prefix,{post,get,storage=new Map(),component='page'}={}) {
  let dirty=true,cursor=0,tree,effects=[],current=null,chargeStatus='PENDING',confirmations=0; const slots=[],calls=[],timers=new Map(),outstanding=[];
  const changed=(old,deps)=>!old||deps.some((v,i)=>!Object.is(v,old.deps[i])); const jsx=(type,props)=>({type,props});
  const react={
    useState(initial){const i=cursor++;slots[i]||={value:typeof initial==='function'?initial():initial};return[slots[i].value,next=>{slots[i].value=typeof next==='function'?next(slots[i].value):next;dirty=true;}];},
    useRef(initial){return slots[cursor++]||={current:initial};},
    useCallback(fn,deps){const i=cursor++;if(changed(slots[i],deps))slots[i]={fn,deps};return slots[i].fn;},
    useEffect(fn,deps){const i=cursor++;if(changed(slots[i],deps)){const old=slots[i];slots[i]={deps,cleanup:old?.cleanup};effects.push(()=>{slots[i].cleanup?.();slots[i].cleanup=fn();});}},
  };
  const transport={get:async(path,config)=>{calls.push({method:'get',path,config});const custom=get?.(path,config);if(custom!==undefined)return custom;if(path.endsWith('/plans'))return ok([plan]);if(path.endsWith('/current'))return ok(current);if(path==='/billing-charges/33')return ok({chargeId:'33',storeId:'12',targetType:'STORE',purpose:'STORE_SUBSCRIPTION',totalAmount:60000,status:chargeStatus});if(path==='/store/subscriptions')return{data:{success:true,data:[],pagination:{page:1,totalItems:0,hasNextPage:false}}};throw Error(path);},post:async(path,body,config)=>{calls.push({method:'post',path,body,config});if(post)return post(path,body,config);if(path.endsWith('/renew-charge'))return ok({paymentTransactionId:'33',checkoutUrl:'https://pay.payos.vn/web/real-link',amount:60000,currency:'VND',status:'PENDING'});current=subscription;return ok(subscription);}};
  const source=readFileSync(new URL(prefix+(component==='page'?'pages/store/StoreServicePlansPage.tsx':component==='history'?'components/store/StoreRegisteredPeriods.tsx':'components/store/StorePlanPayosPayment.tsx'),import.meta.url),'utf8');const exports={};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
    exports,URL,document:{visibilityState:'visible'},crypto:{randomUUID:()=> 'test-uuid'},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},window:{location:{origin:'https://frontend.example'},setInterval:fn=>{const id=timers.size+1;timers.set(id,fn);return id;},clearInterval:id=>timers.delete(id),addEventListener(){},removeEventListener(){}},
    require(name){if(name==='react')return react;if(name==='react/jsx-runtime')return{jsx,jsxs:jsx};if(name==='react-router-dom')return{Link:'a'};if(name==='lucide-react')return new Proxy({},{get:(_,k)=>`icon.${String(k)}`});if(name.endsWith('/api'))return{api:transport};if(name.endsWith('/AuthContext'))return{useAuth:()=>({user:{id:'7',storeId:'12',role:'STORE_OWNER'}})};if(name.endsWith('/store-finance-flow'))return{financeError,financeStoreId:()=> '12'};if(name.endsWith('/wallet.service'))return{walletService:{getWallet:async()=>({data:{storeId:'12',availableBalance:100000}})}};if(name.endsWith('/request-backoff'))return{getApiRetryUntil:()=>0};if(name.endsWith('/store-service-plans'))return plans;if(name.endsWith('/store-subscription-overview'))return overview;if(name.endsWith('/BankingPrimitives'))return{BankError:'error',bankButton:'button'};if(name.endsWith('/OperationPrimitives'))return{card:'card',primaryButton:'primary'};if(name.endsWith('/StorePlanPayosPayment'))return{StorePlanPayosPayment:'payos-payment'};throw Error(name);},
  });
  const walk=v=>v&&typeof v==='object'?[v,...[v.props?.children].flat(Infinity).flatMap(walk)]:[];
  const text=v=>v==null||typeof v==='boolean'?'':typeof v!=='object'?String(v):[v.props?.children].flat(Infinity).map(text).join('');
  const app={calls,storage,outstanding,setChargeStatus:value=>{chargeStatus=value;},get confirmations(){return confirmations;},get nodes(){return walk(tree);},get text(){return text(tree);},
    async flush(){for(let n=0;n<45;n++){if(dirty){cursor=0;dirty=false;tree=component==='page'?exports.StoreServicePlansWorkspace({scope:'7:12',storeId:'12'}):component==='history'?exports.StoreRegisteredPeriods({storeId:'12',refreshKey:0}):exports.StorePlanPayosPayment({scope:'7:12',storeId:'12',selected:plan,catalog:[plan],disabled:false,isWalletBusy:()=>false,onOutstandingChange:id=>outstanding.push(id),onConfirmed:()=>confirmations++});const jobs=effects;effects=[];jobs.forEach(fn=>fn());}await Promise.resolve();}},
    button(label){const node=walk(tree).find(n=>n.type==='button'&&text(n)===label);assert.ok(node,`Missing button ${label}`);return node;},
    async click(label){const node=this.button(label);assert.ok(!node.props.disabled);await node.props.onClick();await this.flush();},
    unmount(){slots.forEach(s=>s.cleanup?.());},
  };return app;
}

for(const prefix of ['../src/','../frontend/src/']) {
  test(`${prefix}registration shows its own controls without the current-plan dashboard or registered periods`,async()=>{
    const app=screen(prefix);await app.flush();
    assert.match(app.text,/Chọn gói cho gian hàng/);assert.match(app.text,/Số dư ví cửa hàng/);
    assert.doesNotMatch(app.text,/Gói hiện tại|Các kỳ gói đã đăng ký|Lịch sử xác minh/);
    assert.equal(app.calls.some(call=>call.path==='/store/subscriptions'),false);app.unmount();
  });
  test(`${prefix}registered periods retain pagination and reject rows belonging to another store`,async()=>{
    let wrong=false;
    const app=screen(prefix,{component:'history',get:(path,config)=>path==='/store/subscriptions'?{data:{success:true,data:[{...subscription,storeId:wrong?'99':'12'}],pagination:{page:config.params.page,totalItems:2,hasNextPage:config.params.page===1}}}:undefined});
    await app.flush();assert.match(app.text,/Các kỳ gói đã đăng ký/);assert.match(app.text,/#19/);
    wrong=true;await app.click('Sau');
    assert.equal(app.calls.filter(call=>call.path==='/store/subscriptions').at(-1).config.params.page,2);
    assert.ok(app.nodes.some(node=>node.type==='error'&&node.props.message.includes('cửa hàng')));app.unmount();
  });
  test(`${prefix}leaving a payment screen while the catalog check waits cannot dispatch a later financial request`,async()=>{
    for(const component of ['page','payos']) {
      const slow=deferred();let reads=0;
      const app=screen(prefix,{component,get:path=>path.endsWith('/plans')&&++reads===(component==='page'?2:1)?slow.promise:undefined});
      await app.flush();if(component==='page')await app.click('Đăng ký gói');
      const button=app.button(component==='page'?'Xác nhận đăng ký & thanh toán':'Tạo thanh toán PayOS');
      const work=button.props.onClick();await app.flush();app.unmount();slow.resolve(ok([plan]));await work;
      assert.equal(app.calls.some(call=>call.method==='post'),false);
    }
  });
  test(`${prefix}PayOS creation does not unlock publishing; only server-confirmed PAID refreshes the period`,async()=>{
    const app=screen(prefix,{component:'payos'});await app.flush();assert.equal(app.calls.some(c=>c.method==='post'),false);
    await app.click('Tạo thanh toán PayOS');assert.equal(app.calls.filter(c=>c.method==='post').length,1);
    const post=app.calls.find(c=>c.method==='post');assert.equal(post.path,'/store/subscriptions/renew-charge');assert.equal(post.body.returnUrl,'https://frontend.example/store/service-plans');
    assert.equal(app.confirmations,0);assert.ok(app.nodes.some(n=>n.type==='a'&&n.props.href==='https://pay.payos.vn/web/real-link'));
    app.setChargeStatus('PAID');await app.click('Kiểm tra thanh toán');assert.equal(app.confirmations,1);assert.equal(app.storage.size,0);assert.equal(app.nodes.some(n=>n.type==='a'),false);
    assert.equal(app.calls.some(c=>c.path.endsWith('/settle')),false);app.unmount();
  });
  test(`${prefix}an unknown PayOS create result blocks duplicate charge creation`,async()=>{
    const app=screen(prefix,{component:'payos',post:async()=>{throw new Error('timeout');}});await app.flush();await app.click('Tạo thanh toán PayOS');
    assert.equal(app.calls.filter(c=>c.method==='post').length,1);assert.equal(app.storage.size,1);assert.equal(app.nodes.some(n=>n.type==='button'&&visibleText(n)==='Tạo thanh toán PayOS'),false);assert.equal(app.confirmations,0);app.unmount();
  });
  test(`${prefix}owner cannot submit products without a freshly confirmed service entitlement`,async()=>{
    let posts=0,notified=0; const context={user:{role:'STORE_OWNER',storeId:'12'},submitLoading:false,listingAccess:{assertAllowed:async()=>{throw new Error('Gói đã hết hạn');}},toast:{error(){}},api:{post:async()=>{posts++;}},notifyCatalogChanged:()=>notified++};
    await callback(prefix,'handleCreateProduct',context)({preventDefault(){}});assert.equal(posts,0);assert.equal(notified,0);
  });
  test(`${prefix}reactivation needs a valid period while stopping sales remains available`,async()=>{
    let puts=0,checks=0;
    const context={user:{role:'STORE_OWNER'},statusConfirmation:{productId:'1',currentStatus:'INACTIVE'},listingAccess:{assertAllowed:async()=>{checks++;throw new Error('Chưa đăng ký');}},toast:{error(){}},setStatusUpdating(){},setStatusConfirmation(){},fetchProducts:async()=>{},api:{put:async()=>{puts++;return ok({});}}};
    await callback(prefix,'handleConfirmProductStatus',context)();assert.equal(puts,0);assert.equal(checks,1);
    context.statusConfirmation.currentStatus='ACTIVE';await callback(prefix,'handleConfirmProductStatus',context)();assert.equal(puts,1);assert.equal(checks,1);
  });
  test(`${prefix}plan selection never charges until explicit confirmation and then reads the actual effective period`,async()=>{
    const app=screen(prefix);await app.flush();assert.match(app.text,/60\.000/);assert.equal(app.calls.some(c=>c.method==='post'),false);
    await app.click('Đăng ký gói');assert.equal(app.calls.some(c=>c.method==='post'),false);await app.click('Xác nhận đăng ký & thanh toán');
    const call=app.calls.find(c=>c.method==='post');assert.equal(call.path,'/store/subscriptions/subscribe');assert.equal(call.body.planId,1);assert.equal(app.storage.size,0);assert.match(app.text,/Đăng ký #19/);app.unmount();
  });
  test(`${prefix}uncertain plan registration is not retried automatically and keeps its idempotency key on explicit recovery`,async()=>{
    const app=screen(prefix,{post:async()=>{throw new Error('timeout');}});await app.flush();await app.click('Đăng ký gói');await app.click('Xác nhận đăng ký & thanh toán');
    assert.equal(app.calls.filter(c=>c.method==='post').length,1);assert.equal(app.storage.size,1);const key=app.calls.find(c=>c.method==='post').body.idempotencyKey;
    const retry=app.nodes.filter(n=>n.type==='button'&&visibleText(n)==='Kiểm tra lại yêu cầu').at(-1);assert.ok(retry);await retry.props.onClick();await app.flush();
    assert.equal(app.calls.filter(c=>c.method==='post').length,2);assert.equal(app.calls.filter(c=>c.method==='post')[1].body.idempotencyKey,key);app.unmount();
  });
  test(`${prefix}duplicate confirmation clicks send one registration`,async()=>{
    const job=deferred();const app=screen(prefix,{post:()=>job.promise});await app.flush();await app.click('Đăng ký gói');const button=app.button('Xác nhận đăng ký & thanh toán');const one=button.props.onClick(),two=button.props.onClick();await app.flush();assert.equal(app.calls.filter(c=>c.method==='post').length,1);job.resolve(ok(subscription));await Promise.all([one,two]);await app.flush();app.unmount();
  });
}
