"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { initializeOwner } from "@/lib/accounts";
import { requireUser } from "@/lib/session";
import { all, limit, one, record, run, transaction, UserError } from "@/lib/db";
import { entitlement, useSearchQuota } from "@/lib/entitlements";
import { jobFor, resultKey } from "@/lib/jobs";
import { searchSchema, type Result, type SearchInput } from "@/lib/search";
import { sourceConfig } from "@/lib/source-rules";
import { encrypt } from "@/lib/security";
import { adapter, syncStore } from "@/lib/markets";
import { enqueueNotification, sendTelegram } from "@/lib/telegram";
import { paymentProvider } from "@/lib/payments";
import { planById } from "@/lib/plans";
import type { FormState } from "./account-actions";

const uuid = z.uuid();
const short = z.string().trim().min(1).max(120);
const money = z.string().regex(/^\d{1,7}(\.\d{1,2})?$/).transform((value)=>Math.round(Number(value)*100));
const actionSchema = z.object({action:z.string().min(1).max(30)});
const scoped = (name:string,id:string,user:string) => {
  const result = one(`SELECT id FROM ${name} WHERE id=? AND user_id=?`,id,user);
  if (!result) throw new UserError("Запись не найдена.");
};

export async function workspaceAction(_previous:FormState,data:FormData):Promise<FormState> {
  const user = await requireUser();
  const uid = user.id;
  let redirectTo: string | undefined;
  let message = "Изменения сохранены.";
  try {
    const input = Object.fromEntries(data);
    const {action} = actionSchema.parse({action:input.action ?? input.operation});
    const id = () => uuid.parse(input.id);
    limit("workspace:"+uid,60,60_000);
    switch (action) {
      case "search":
      case "save-search": {
        const query = searchSchema.parse(input);
        if (action === "save-search") {
          entitlement(user,"leads");
          const name = short.parse(input.savedName || query.category + " · " + query.city);
          run("INSERT INTO saved_searches VALUES (?,?,?,?,?)",randomUUID(),uid,name,JSON.stringify(query),Date.now());
          message = "Поиск сохранён.";
          break;
        }
        const provider = sourceConfig(query.source);
        if (!provider.active) throw new UserError(provider.reason);
        const jobId = randomUUID();
        transaction(() => {
          useSearchQuota(user);
          run("INSERT INTO jobs(id,user_id,query,state,run_after,created,updated) VALUES (?,?,?,'queued',?,?,?)",jobId,uid,JSON.stringify(query),Date.now(),Date.now(),Date.now());
          record(uid,"search.queued",jobId);
        });
        redirectTo = "/dashboard/results?job="+jobId;
        break;
      }
      case "delete-search": {
        entitlement(user,"leads");
        run("DELETE FROM saved_searches WHERE user_id=? AND id=?",uid,id());
        break;
      }
      case "cancel-job":
      case "retry-job": {
        const job = jobFor(uid,id());
        if (!job) throw new UserError("Задание не найдено.");
        const retry = action === "retry-job";
        if (retry) {
          entitlement(user,"leads");
          const provider=sourceConfig((JSON.parse(job.query) as SearchInput).source);
          if (!provider.active) throw new UserError(provider.reason);
        }
        const result = retry ?
          run("UPDATE jobs SET state='queued',attempts=0,progress=0,run_after=?,updated=?,message=NULL,lease=NULL WHERE id=? AND user_id=? AND state IN ('failed','cancelled')",Date.now(),Date.now(),job.id,uid) :
          run("UPDATE jobs SET state='cancelled',lease=NULL,updated=? WHERE id=? AND user_id=? AND state IN ('queued','running')",Date.now(),job.id,uid);
        if (!result.changes) throw new UserError("Задание уже изменилось. Обновите страницу.");
        record(uid,retry ? "search.retried" : "search.cancelled",job.id);
        message = retry ? "Задание снова в очереди." : "Задание отменено.";
        break;
      }
      case "save-lead": {
        entitlement(user,"leads");
        const job = jobFor(uid,id());
        const resultId = z.string().max(254).parse(input.resultId);
        const row = job?.state === "done" && job.result && (JSON.parse(job.result) as Result[]).find((item)=>item.id===resultId);
        if (!row || !sourceConfig(row.source).active) throw new UserError("Результат больше недоступен.");
        const inserted = run("INSERT INTO leads(id,user_id,source,source_id,fingerprint,data,created) VALUES (?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
          randomUUID(),uid,row.source,row.id,resultKey(row),JSON.stringify(row),Date.now());
        message = inserted.changes ? "Лид сохранён." : "Этот лид уже сохранён.";
        break;
      }
      case "edit-lead":
      case "delete-lead": {
        entitlement(user,"leads");
        const lead = one<{source:SearchInput["source"]}>("SELECT source FROM leads WHERE user_id=? AND id=?",uid,id());
        if (!lead) throw new UserError("Лид не найден.");
        if (action === "delete-lead") run("DELETE FROM leads WHERE user_id=? AND id=?",uid,id());
        else {
          if (!sourceConfig(lead.source).active) throw new UserError("Доступ к источнику отключён.");
          const state = z.enum(["new","contacted","closed"]).parse(input.state);
          const note = z.string().trim().max(2000).parse(input.note);
          run("UPDATE leads SET state=?,note=?,favorite=? WHERE user_id=? AND id=?",state,note,input.favorite==="on" ? 1 : 0,uid,id());
        }
        break;
      }
      case "connect-store": {
        const platform = z.enum(["funpay","playerok","lolz","ggsel","plati"]).parse(input.platform);
        if (!adapter(platform).allowed) throw new UserError("Подключение этой площадки сейчас недоступно.");
        const name=short.parse(input.name);
        const seller=z.coerce.number().int().positive().max(2_147_483_647).parse(input.seller);
        const key=z.string().trim().min(8).max(200).parse(input.key);
        const storeId=randomUUID();
        transaction(() => {
          const stores=entitlement(user,"stores").stores;
          const count=one<{n:number}>("SELECT count(*) AS n FROM stores WHERE user_id=?",uid)?.n ?? 0;
          if (count>=stores) throw new UserError("Достигнут лимит магазинов.");
          const added = run("INSERT INTO stores(id,user_id,platform,name,credential,status,created) VALUES (?,?,?,?,?,'error',?) ON CONFLICT DO NOTHING",
            storeId,uid,platform,name,encrypt(JSON.stringify({seller,key})),Date.now());
          if (!added.changes) throw new UserError("Магазин с таким названием уже существует.");
          record(uid,"store.added",storeId);
        });
        await syncStore(uid,storeId);
        message = "Магазин подключён.";
        break;
      }
      case "sync-store":
        entitlement(user,"stores");
        await syncStore(uid,id());
        message = "Синхронизация завершена.";
        break;
      case "remove-store": {
        scoped("stores",id(),uid);
        transaction(() => {
          if (one("SELECT 1 FROM inventory WHERE store_id=? AND user_id=?",id(),uid)) throw new UserError("Сначала обработайте записи склада, связанные с этим магазином.");
          run("DELETE FROM price_rules WHERE store_id=? AND user_id=?",id(),uid);
          run("DELETE FROM stores WHERE id=? AND user_id=?",id(),uid);
          record(uid,"store.removed",id());
        });
        break;
      }
      case "order-cost": {
        entitlement(user,"stores");
        const store=uuid.parse(input.store);
        scoped("stores",store,uid);
        const order=short.parse(input.order);
        const cost=money.parse(input.cost);
        if (!run("UPDATE orders SET cost=? WHERE store_id=? AND external_id=?",cost,store,order).changes) throw new UserError("Заказ не найден.");
        record(uid,"order.cost_updated",order);
        break;
      }
      case "add-stock": {
        entitlement(user,"automation");
        const label=short.parse(input.label);
        const value=z.string().trim().min(1).max(4000).parse(input.secret);
        if (input.owned !== "on") throw new UserError("Подтвердите право на продажу товара.");
        run("INSERT INTO inventory(id,user_id,label,secret,created) VALUES (?,?,?,?,?)",randomUUID(),uid,label,encrypt(value),Date.now());
        record(uid,"stock.added");
        break;
      }
      case "reserve-stock":
      case "release-stock":
      case "fulfill-stock": {
        entitlement(user,"automation");
        transaction(() => {
          const item=one<{state:string;store_id:string|null;order_id:string|null}>("SELECT state,store_id,order_id FROM inventory WHERE id=? AND user_id=?",id(),uid);
          if (!item) throw new UserError("Позиция склада не найдена.");
          if (action==="reserve-stock") {
            const selection=z.string().max(180).parse(input.order);
            const [store,order]=selection.split("/");
            scoped("stores",uuid.parse(store),uid);
            if (!one("SELECT 1 FROM orders WHERE store_id=? AND external_id=? AND status='Оплачен'",store,order)) throw new UserError("Выберите подтверждённый оплаченный заказ.");
            if (item.state!=="available" || one("SELECT 1 FROM inventory WHERE store_id=? AND order_id=?",store,order)) throw new UserError("Позиция или заказ уже зарезервированы.");
            run("UPDATE inventory SET store_id=?,order_id=?,state='reserved' WHERE id=? AND user_id=?",store,order,id(),uid);
          } else {
            if (action==="fulfill-stock" && item.state==="delivered") return;
            if (item.state!=="reserved") throw new UserError("Позиция не зарезервирована.");
            if (action==="fulfill-stock") {
              if (!one("SELECT 1 FROM orders WHERE store_id=? AND external_id=? AND status='Оплачен'",item.store_id,item.order_id)) throw new UserError("Заказ больше не подтверждён как оплаченный.");
              run("UPDATE inventory SET state='delivered' WHERE id=? AND user_id=?",id(),uid);
              record(uid,"stock.marked_delivered",id());
            } else run("UPDATE inventory SET state='available',store_id=NULL,order_id=NULL WHERE id=? AND user_id=?",id(),uid);
          }
        });
        break;
      }
      case "delete-stock": {
        entitlement(user,"automation");
        if (!run("DELETE FROM inventory WHERE id=? AND user_id=? AND state='available'",id(),uid).changes) throw new UserError("Можно удалить только свободную позицию.");
        record(uid,"stock.deleted",id());
        break;
      }
      case "add-template": {
        entitlement(user,"automation");
        const name=short.parse(input.name);
        const body=z.string().trim().min(1).max(2000).parse(input.body);
        run("INSERT INTO templates VALUES (?,?,?,?)",randomUUID(),uid,name,body);
        break;
      }
      case "delete-template":
        entitlement(user,"automation");
        run("DELETE FROM templates WHERE user_id=? AND id=?",uid,id());
        break;
      case "add-price": {
        entitlement(user,"automation");
        const store=uuid.parse(input.store);
        const lot=short.parse(input.lot);
        const min=money.parse(input.min);
        const max=money.parse(input.max);
        if (min<=0 || max<min) throw new UserError("Проверьте минимальную и максимальную цену.");
        scoped("stores",store,uid);
        if (!one("SELECT 1 FROM lots WHERE store_id=? AND external_id=?",store,lot)) throw new UserError("Лот не найден в этом магазине.");
        run("INSERT INTO price_rules(id,user_id,store_id,lot,min,max) VALUES (?,?,?,?,?,?)",randomUUID(),uid,store,lot,min,max);
        record(uid,"pricing.draft_added",lot);
        message = "Черновик правила сохранён.";
        break;
      }
      case "delete-price":
        entitlement(user,"automation");
        run("DELETE FROM price_rules WHERE user_id=? AND id=?",uid,id());
        record(uid,"pricing.draft_removed",id());
        break;
      case "connect-telegram": {
        entitlement(user,"automation");
        limit("telegram:"+uid,3,60_000);
        const token=z.string().regex(/^\d{5,16}:[\w-]{20,90}$/).parse(input.token);
        const chat=z.string().regex(/^-?\d{1,20}$/).parse(input.chat);
        const encrypted=encrypt(token);
        if (!await sendTelegram(token,chat,"Sellio · Уведомления подключены.")) throw new UserError("Telegram не принял сообщение. Проверьте токен и ID чата.");
        transaction(()=>{
          run("UPDATE notification_queue SET state='failed' WHERE user_id=? AND state='queued'",uid);
          run("INSERT INTO telegram VALUES (?,?,?,1) ON CONFLICT(user_id) DO UPDATE SET token=excluded.token,chat=excluded.chat,enabled=1",uid,encrypted,chat);
          record(uid,"telegram.connected");
        });
        break;
      }
      case "stop-telegram":
        transaction(()=>{
          run("DELETE FROM telegram WHERE user_id=?",uid);
          run("UPDATE notification_queue SET state='failed' WHERE user_id=? AND state='queued'",uid);
          record(uid,"telegram.stopped");
        });
        break;
      case "test-plan": {
        if (user.role === "owner") throw new UserError("Владельцу подписка не нужна.");
        const plan = planById(short.parse(input.plan));
        const requestId = uuid.parse(input.requestId);
        const provider = paymentProvider();
        if (!provider || !plan) throw new UserError("Оплата пока недоступна.");
        provider.activate({userId:uid,plan:plan.id,requestId});
        message = "Тестовый тариф активирован без оплаты.";
        break;
      }
      case "stop-renew":
        run("UPDATE subscriptions SET renew=0 WHERE user_id=?",uid);
        record(uid,"subscription.renew_stopped");
        break;
      case "owner": {
        limit("owner:"+uid,5);
        initializeOwner(user,z.string().min(32).max(512).parse(input.code));
        redirectTo="/admin";
        break;
      }
      case "save-map":
      case "remove-map": {
        if (user.role !== "owner") throw new UserError("Требуются права владельца.");
        const source = z.enum(["yandex","2gis","google"]).parse(input.source);
        transaction(()=>{
          if (action === "remove-map") run("DELETE FROM map_integrations WHERE source=?",source);
          else {
            if (input.crm !== "on") throw new UserError("Подтвердите право на хранение данных источника.");
            const key = z.string().trim().min(8).max(300).parse(input.key);
            run(`INSERT INTO map_integrations VALUES (?,?,?,?) ON CONFLICT(source) DO UPDATE SET
              credential=excluded.credential,exportable=excluded.exportable,contacts=excluded.contacts`,
            source,encrypt(key),input.exportable==="on" ? 1 : 0,source==="2gis"&&input.contacts==="on" ? 1 : 0);
          }
          record(uid,action,source);
        });
        message = action === "save-map" ? "Источник сохранён. Запустите поиск для проверки." : "Ключ удалён из настроек кабинета.";
        break;
      }
      case "admin-role":
      case "admin-quota": {
        if (user.role!=="owner") throw new UserError("Требуются права владельца.");
        const target=one<{role:string;verified:number|null}>("SELECT role,verified FROM users WHERE id=?",id());
        if (!target?.verified || target.role==="owner") throw new UserError("Этот аккаунт нельзя изменить.");
        transaction(()=>{
          if (action==="admin-role") {
            const role=z.enum(["user","admin"]).parse(input.role);
            run("UPDATE users SET role=? WHERE id=? AND role<>'owner'",role,id());
          } else {
            const key=z.enum(["searches","stores"]).parse(input.feature);
            const maximum=z.coerce.number().int().min(0).max(100_000).parse(input.maximum);
            run("INSERT INTO quota_overrides VALUES (?,?,?) ON CONFLICT DO UPDATE SET maximum=excluded.maximum",id(),key,maximum);
          }
          record(uid,action,id());
        });
        break;
      }
      default: throw new UserError("Действие недоступно.");
    }
  } catch(error) {
    if (error instanceof UserError) return {error:error.message};
    if (error instanceof z.ZodError) return {error:"Проверьте введённые значения и заполните обязательные поля."};
    console.error("Sellio: действие завершилось ошибкой",error instanceof Error ? error.name : typeof error);
    return {error:"Не удалось выполнить действие. Повторите позже."};
  }
  revalidatePath("/dashboard","layout");
  revalidatePath("/admin");
  if (redirectTo) redirect(redirectTo);
  return {success:message};
}

export async function revealStock(_previous:FormState,data:FormData):Promise<FormState> {
  const user=await requireUser();
  try {
    entitlement(user,"automation");
    limit("stock-reveal:"+user.id,30,60_000);
    const id=uuid.parse(data.get("id"));
    const {decrypt}=await import("@/lib/security");
    const item=one<{secret:string}>(`SELECT i.secret FROM inventory i JOIN orders o ON o.store_id=i.store_id AND o.external_id=i.order_id
      WHERE i.user_id=? AND i.id=? AND i.state='reserved' AND o.status='Оплачен'`,user.id,id);
    if (!item) throw new UserError("Сначала зарезервируйте товар для оплаченного заказа.");
    record(user.id,"stock.revealed",id);
    return {success:decrypt(item.secret)};
  } catch(error) {
    return {error:error instanceof UserError ? error.message : "Не удалось открыть товар."};
  }
}
