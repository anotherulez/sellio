import { before, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { registerUser, authenticate, issueToken, useAccountToken, initializeOwner, userByEmail, userForToken } from "../lib/accounts";
import { all, one, run, transaction } from "../lib/db";
import { entitlement, useSearchQuota } from "../lib/entitlements";
import { paymentProvider } from "../lib/payments";
import { jobFor, workNext } from "../lib/jobs";
import { auditWebsite } from "../lib/site-audit";
import { encrypt, decrypt } from "../lib/security";
import { overviewFor } from "../lib/metrics";

const devOwner = "owner@example.test";
const ordinary = "user@example.test";
const password = "test-pass-for-sellio-42";
let userId: string, ownerId: string;

before(async () => {
  process.env.SELLIO_DB = ":memory:";
  process.env.OWNER_EMAIL = devOwner;
  process.env.OWNER_BOOTSTRAP_SECRET = randomBytes(32).toString("base64url");
  process.env.SELLIO_PAYMENT_MODE = "test";
  process.env.SELLIO_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  userId = (await registerUser(ordinary, password))!;
  ownerId = (await registerUser(devOwner,password))!;
});

test("registration, single-use confirmation, login, reset and session invalidation", async () => {
  assert.equal(await registerUser(ordinary, password), undefined);
  await assert.rejects(authenticate(ordinary,password),/Подтвердите/);
  const confirmation=issueToken(userId,"confirm");
  await useAccountToken(confirmation,"confirm");
  await assert.rejects(useAccountToken(confirmation,"confirm"),/недействительна/);
  assert.equal(await authenticate(ordinary,password),userId);
  const session=issueToken(userId,"session");
  assert.equal(userForToken(session,"session")?.email,ordinary);
  const newPassword=password+"-new";
  await useAccountToken(issueToken(userId,"reset"),"reset",newPassword);
  assert.equal(userForToken(session,"session"),undefined);
  await assert.rejects(authenticate(ordinary,password),/Проверьте/);
  assert.equal(await authenticate(ordinary,newPassword),userId);
});

test("owner requires verified email and one-time secret", async () => {
  const secret=process.env.OWNER_BOOTSTRAP_SECRET!;
  assert.throws(()=>initializeOwner(userByEmail(devOwner)!,secret),/назначение/);
  await useAccountToken(issueToken(ownerId,"confirm"),"confirm");
  assert.throws(()=>initializeOwner(userByEmail(ordinary)!,secret),/назначение/);
  assert.throws(()=>initializeOwner(userByEmail(devOwner)!,"x".repeat(32)),/назначение/);
  initializeOwner(userByEmail(devOwner)!,secret);
  assert.equal(entitlement(userByEmail(devOwner)!,"automation").stores,Infinity);
  assert.throws(()=>initializeOwner(userByEmail(devOwner)!,secret),/уже назначен/);
});

test("test payment idempotence and persistent per-account quota", () => {
  const user=userByEmail(ordinary)!;
  assert.throws(()=>entitlement(user,"leads"),/активный тариф/);
  const requestId=randomUUID();
  const provider=paymentProvider()!;
  provider.activate({userId,plan:"start",requestId});
  provider.activate({userId,plan:"pro",requestId});
  assert.equal(all("SELECT id FROM payment_events WHERE user_id=?",userId).length,1);
  assert.throws(()=>entitlement(user,"automation"),/активный тариф/);
  run("INSERT INTO quota_overrides VALUES (?,'searches',1)",userId);
  transaction(()=>useSearchQuota(user));
  assert.throws(()=>transaction(()=>useSearchQuota(user)),/исчерпана/);
  assert.equal(entitlement(userByEmail(devOwner)!,"leads").searches,Infinity);
});

test("search queue, source disabled state, result isolation and private address guard", async (context) => {
  const add=(id:string)=>run("INSERT INTO jobs(id,user_id,query,state,run_after,created,updated) VALUES (?,?,?,'queued',0,0,0)",
    id,userId,JSON.stringify({source:"yandex",country:"RU",city:"Москва",category:"ателье",keywords:"",site:"all"}));
  const failed=randomUUID();
  add(failed);
  assert.equal(await workNext(),true);
  assert.equal(jobFor(userId,failed)?.state,"failed");
  assert.equal(jobFor(ownerId,failed),undefined);
  process.env.YANDEX_MAPS_KEY="test-key";
  process.env.YANDEX_MAPS_CRM_ALLOWED="true";
  context.mock.method(globalThis,"fetch",async ()=>Response.json({features:[
    {properties:{CompanyMetaData:{id:"test-1",name:"Тестовая запись"}}},
    {properties:{CompanyMetaData:{id:"test-1",name:"Тестовая запись"}}},
  ]}));
  const job=randomUUID();
  add(job);
  await workNext();
  const result=jobFor(userId,job);
  assert.equal(result?.state,"done");
  assert.equal(result?.progress,100);
  assert.equal(JSON.parse(result!.result!).length,1);
  assert.equal(JSON.parse(result!.result!)[0].audit.state,"missing");
  assert.equal((await auditWebsite("http://127.0.0.1")).state,"review");
  assert.equal((await auditWebsite("",false)).state,"review");
  assert.equal(one<{n:number}>("SELECT count(*) n FROM jobs WHERE user_id=?",ownerId)?.n,0);
});

test("encrypted goods and credentials authenticate the ciphertext", () => {
  const first=encrypt("sample");
  assert.notEqual(first,encrypt("sample"));
  assert.equal(decrypt(first),"sample");
  const altered=Buffer.from(first,"base64");
  altered[altered.length-1]^=1;
  assert.throws(()=>decrypt(altered.toString("base64")));
});

test("sales overview counts synced paid orders and leaves unknown profit blank", () => {
  const store=randomUUID();
  const now=Date.now();
  assert.equal(overviewFor(userId).connected,false);
  run("INSERT INTO stores(id,user_id,platform,name,status,created,synced) VALUES (?,?,'plati','Тест','connected',?,?)",store,userId,now,now);
  const insert="INSERT INTO orders(store_id,external_id,title,amount,commission,cost,status,created) VALUES (?,?, 'Тест',?,?,?,?,?)";
  run(insert,store,"paid",10555,555,null,"Оплачен",now);
  run(insert,store,"refunded",15000,0,0,"Возврат",now);
  run(insert,store,"future",20000,0,0,"Оплачен",now+86_400_000);
  const stats=overviewFor(userId);
  assert.equal(stats.revenue,105.55);
  assert.equal(stats.orders,1);
  assert.equal(stats.profit,null);
  assert.equal(stats.lastSync,now);
  assert.equal(overviewFor(ownerId).connected,false);
  run("UPDATE orders SET cost=2000 WHERE store_id=? AND external_id='paid'",store);
  assert.equal(overviewFor(userId).profit,80);
});
