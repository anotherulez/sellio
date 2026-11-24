import { all, one } from "./db";

const day = 86_400_000;

export function overviewFor(user: string) {
  const todayStart = Math.floor((Date.now()+3*3_600_000)/day)*day-3*3_600_000;
  const start = todayStart-6*day;
  const connected = Boolean(one("SELECT 1 FROM stores WHERE user_id=? AND synced IS NOT NULL",user));
  const orders = all<{external_id:string;title:string;status:string;amount:number;created:number;commission:number|null;cost:number|null}>(
    `SELECT o.external_id,o.title,o.status,o.amount,o.created,o.commission,o.cost FROM orders o JOIN stores s ON s.id=o.store_id
       WHERE s.user_id=? AND o.created>=? ORDER BY o.created DESC`,user,start);
  const paid = orders.filter((order)=>order.status === "Оплачен");
  const total = (after:number,before:number) => paid.filter((o)=>o.created>=after&&o.created<before).reduce((n,o)=>n+o.amount,0)/100;
  const tracked = paid.filter((o)=>o.cost !== null && o.commission !== null);
  const profit = connected && tracked.length === paid.length ? tracked.reduce((n,o)=>n+o.amount-(o.cost??0)-(o.commission??0),0)/100 : null;
  const trend = connected ? Array.from({length:7},(_,index)=>{
    const from = start+index*day;
    return {label:new Intl.DateTimeFormat("ru-RU",{weekday:"short",timeZone:"Europe/Moscow"}).format(from),value:total(from,from+day)};
  }) : [];
  return { connected,today:total(todayStart,todayStart+day),orders:paid.length,profit,
    leads:one<{n:number}>("SELECT count(*) AS n FROM leads WHERE user_id=? AND state='new'",user)?.n ?? 0,
    recent:orders.slice(0,5).map((o)=>({...o,amount:o.amount/100})),trend,
    revenue:paid.reduce((n,o)=>n+o.amount,0)/100,
    fees:paid.every((o)=>o.commission!==null) ? paid.reduce((n,o)=>n+(o.commission??0),0)/100 : null,
    costs:paid.every((o)=>o.cost!==null) ? paid.reduce((n,o)=>n+(o.cost??0),0)/100 : null,
  };
}
