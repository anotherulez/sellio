import { z } from "zod";
import { digest, decrypt } from "./security";
import { all, limit, one, record, run, transaction, UserError } from "./db";
import { platforms } from "./catalog";
import { enqueueNotification } from "./telegram";

export type Platform = typeof platforms[number]["id"];
export type Store = { id: string; user_id: string; platform: Platform; name: string; status: "connected" | "error"; synced: number | null; error: string | null; created: number };
type Lot = { id: string; title: string; price: number; state: string };
type Order = { id: string; lot: string; title: string; amount: number; fee: number | null; status: string; created: number };
type Credential = { seller: number; key: string };
type Adapter = { allowed: boolean; reference?: string; sync?: (credential: Credential) => Promise<{ lots: Lot[]; orders: Order[] }> };

const loginSchema = z.object({retval:z.literal(0),token:z.string().min(1)});
const lotSchema = z.object({id_goods:z.coerce.number().int(),name_goods:z.string(),price:z.coerce.number().nonnegative(),visible:z.coerce.number()});
const saleSchema = z.object({invoice_id:z.coerce.number().int(),product_id:z.coerce.number().int(),product_name:z.string(),date_pay:z.string().nullable(),
  amount_in:z.coerce.number().nonnegative(),amount_out:z.coerce.number().nonnegative(),amount_currency:z.string(),returned:z.coerce.number(),owner:z.coerce.number()});
const supported: Record<"ggsel" | "plati",number> = { ggsel: 1271, plati: 1 };
const ownerKeys = { ggsel: "GGSEL_SELLER_API_ALLOWED", plati: "PLATI_SELLER_API_ALLOWED" } as const;

async function digi(path: string, params: Record<string,string> = {}, payload?: object) {
  try {
    const url = new URL(path, "https://api.digiseller.com");
    url.search = new URLSearchParams(params).toString();
    const reply = await fetch(url, { method: payload ? "POST" : "GET", body: payload ? JSON.stringify(payload) : undefined,
      headers: { Accept:"application/json", "Content-Type":"application/json" }, signal:AbortSignal.timeout(8000), cache:"no-store", redirect:"error" });
    if (!reply.ok) throw Error();
    return await reply.json() as unknown;
  } catch { throw new UserError("Digiseller не ответил. Проверьте ключ, разрешения и лимиты."); }
}

function checked<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new UserError("Digiseller отклонил запрос или вернул неизвестный формат данных.");
  return result.data;
}

function moscowStamp(time: number) {
  return new Date(time + 3*3_600_000).toISOString().slice(0,19).replace("T"," ");
}

async function digiSync(credential: Credential, owner: number) {
  limit("digiseller:" + credential.seller,4,60_000);
  const timestamp = Math.floor(Date.now()/1000);
  const {token} = checked(loginSchema, await digi("/api/apilogin",{}, { seller_id: credential.seller, timestamp, sign:digest(credential.key+timestamp) }));
  const query = { token };
  const now = Date.now();
  const [products,sales] = await Promise.all([
    digi("/api/seller-goods", query, {id_seller:credential.seller,owner_id:owner,rows:1000,page:1,currency:"RUR",lang:"ru-RU",show_hidden:1}),
    digi("/api/seller-sells/v2", query, { date_start:moscowStamp(now-30*86_400_000),date_finish:moscowStamp(now),returned:0,rows:1000,page:1 }),
  ]);
  const productData = checked(z.object({retval:z.literal(0),rows:z.array(lotSchema).nullable().optional(),pages:z.coerce.number().max(1)}),products);
  const salesData = checked(z.object({retval:z.literal(0),rows:z.array(saleSchema).nullable().optional(),pages:z.coerce.number().max(1)}),sales);
  const lots: Lot[] = (productData.rows ?? []).map((p)=>({id:String(p.id_goods),title:p.name_goods,price:Math.round(p.price*100),state:p.visible === 1 ? "Опубликован" : "Скрыт"}));
  const orders: Order[] = (salesData.rows ?? []).flatMap((s)=>{
    if (s.owner !== owner || !s.date_pay || !["WMR","RUR","RUB"].includes(s.amount_currency)) return [];
    const created = Date.parse(s.date_pay.replace(" ","T")+"+03:00");
    if (!Number.isFinite(created)) return [];
    return [{id:String(s.invoice_id),lot:String(s.product_id),title:s.product_name,amount:Math.round(s.amount_in*100),
      fee:s.amount_in >= s.amount_out ? Math.round((s.amount_in-s.amount_out)*100) : null, status:s.returned ? "Возврат" : "Оплачен",created}];
  });
  return {lots,orders};
}

export function adapter(platform: Platform): Adapter {
  if (platform === "ggsel" || platform === "plati") {
    return { allowed:process.env[ownerKeys[platform]] === "true", reference:"https://my.digiseller.com/inside/api.asp", sync:(credential)=>digiSync(credential,supported[platform]) };
  }
  return {allowed:false};
}

export const storesFor = (user: string) => all<Store>("SELECT id,user_id,platform,name,status,synced,error,created FROM stores WHERE user_id=? ORDER BY created DESC",user);

export async function syncStore(user: string, id: string) {
  const store = one<Store & {credential: string}>("SELECT * FROM stores WHERE user_id=? AND id=?",user,id);
  if (!store) throw new UserError("Магазин не найден.");
  const integration = adapter(store.platform);
  if (!integration.allowed || !integration.sync) throw new UserError("Доступ к API этой площадки отключён.");
  limit("store-sync:"+id,1,60_000);
  try {
    const data = await integration.sync(JSON.parse(decrypt(store.credential)) as Credential);
    transaction(() => {
      if (!one("SELECT 1 FROM stores WHERE user_id=? AND id=? AND credential=?",user,id,store.credential)) throw new UserError("Магазин был отключён во время синхронизации.");
      run("DELETE FROM lots WHERE store_id=?",id);
      for (const lot of data.lots) run("INSERT INTO lots VALUES (?,?,?,?,?)",id,lot.id,lot.title,lot.price,lot.state);
      for (const order of data.orders) {
        const existing = one("SELECT 1 FROM orders WHERE store_id=? AND external_id=?",id,order.id);
        run(`INSERT INTO orders(store_id,external_id,title,amount,commission,status,created,lot_id) VALUES (?,?,?,?,?,?,?,?)
          ON CONFLICT(store_id,external_id) DO UPDATE SET title=excluded.title,amount=excluded.amount,commission=excluded.commission,status=excluded.status,lot_id=excluded.lot_id`,
        id,order.id,order.title,order.amount,order.fee,order.status,order.created,order.lot);
        if (store.synced && !existing && order.status === "Оплачен") enqueueNotification(user,`Sellio · ${store.name}\nНовый оплаченный заказ №${order.id}.`);
      }
      run("UPDATE stores SET status='connected',synced=?,error=NULL WHERE id=? AND user_id=?",Date.now(),id,user);
      record(user,"store.synced",id);
    });
  } catch (error) {
    run("UPDATE stores SET status='error',error=? WHERE id=? AND user_id=?",error instanceof UserError ? error.message : "Ошибка синхронизации.",id,user);
    record(user,"store.sync_failed",id);
    enqueueNotification(user,`Sellio · ${store.name}\nОшибка синхронизации магазина.`);
    throw error;
  }
}
