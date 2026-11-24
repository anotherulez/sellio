import { notFound } from "next/navigation";
import { all } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { plans, rubles } from "@/lib/plans";
import { jobStates, platforms } from "@/lib/catalog";
import { adapter } from "@/lib/markets";
import { dateTime } from "@/components/leads-pages";
import { PageHeader, WorkspaceShell } from "@/components/workspace-shell";
import { WorkspaceForm } from "@/components/workspace-form";

export const metadata={title:"Администрирование",robots:{index:false,follow:false}};

export default async function Admin() {
  const user=await requireUser();
  if(user.role==="user") notFound();
  const users=all<{id:string;email:string;role:string;verified:number|null;plan:string|null;expires:number|null;searches:number|null;stores:number|null}>(
    `SELECT u.id,u.email,u.role,u.verified,s.plan,s.expires,
    (SELECT maximum FROM quota_overrides WHERE user_id=u.id AND feature='searches') AS searches,
    (SELECT maximum FROM quota_overrides WHERE user_id=u.id AND feature='stores') AS stores
    FROM users u LEFT JOIN subscriptions s ON s.user_id=u.id ORDER BY u.created DESC LIMIT 100`);
  const jobs=all<{id:string;state:keyof typeof jobStates;n:number}>("SELECT state,count(*) AS n FROM jobs GROUP BY state");
  const failures=all<{id:string;message:string;updated:number}>("SELECT id,message,updated FROM jobs WHERE state='failed' ORDER BY updated DESC LIMIT 20");
  const log=all<{id:number;event:string;created:number;email:string|null}>("SELECT a.id,a.event,a.created,u.email FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 40");
  const payment=all<{id:string;plan:string;mode:string;amount:number;created:number;email:string}>("SELECT p.id,p.plan,p.mode,p.amount,p.created,u.email FROM payment_events p JOIN users u ON u.id=p.user_id ORDER BY p.created DESC LIMIT 30");
  const stores=all<{id:string;platform:string;status:string;name:string;error:string|null}>("SELECT id,platform,status,name,error FROM stores ORDER BY created DESC LIMIT 30");
  return <WorkspaceShell user={user}><PageHeader title="Администрирование" body="Аккаунты, подписки, интеграции и журнал Sellio."/>
    <section className="panel"><div className="panel-head"><h3>Пользователи и подписки</h3></div><div className="record-list">{users.map((u)=><div key={u.id}>
      <div><strong>{u.email}</strong><small>{({owner:"Владелец",admin:"Администратор",user:"Пользователь"})[u.role]} · {u.verified?"Email подтверждён":"Ожидает подтверждения"}</small><small>{u.plan ? (plans.find((p)=>p.id===u.plan)?.name??u.plan)+" · до "+dateTime(u.expires??0) : "Без подписки"}</small>
      {(u.searches!==null||u.stores!==null) && <small>Лимит поисков: {u.searches??"по тарифу"} · магазинов: {u.stores??"по тарифу"}</small>}</div>
      {user.role==="owner"&&u.role!=="owner"&&u.verified && <details className="row-details"><summary>Изменить доступ</summary>
        <WorkspaceForm name="admin-role" id={u.id} className="row-form"><label>Роль<select name="role" defaultValue={u.role}><option value="user">Пользователь</option><option value="admin">Администратор</option></select></label><button type="submit" className="action smaller">Сохранить роль</button></WorkspaceForm>
        <WorkspaceForm name="admin-quota" id={u.id} className="row-form"><label>Квота<select name="feature"><option value="searches">Поиски в месяц</option><option value="stores">Магазины</option></select></label><label>Лимит<input name="maximum" type="number" min={0} max={100000} required/></label><button type="submit" className="action smaller">Сохранить квоту</button></WorkspaceForm>
      </details>}</div>)}</div></section>
    <section className="panel"><div className="panel-head"><h3>Тарифы и платежи</h3></div><div className="record-list">{plans.map((p)=><div key={p.id}><div><strong>{p.name}</strong><small>{p.limits.searches} поисков в месяц · магазинов: {p.limits.stores}</small></div>{rubles(p.price)}</div>)}
      {payment.map((p)=><div key={p.id}><div>{p.email}<small>{p.plan} · {p.mode==="test"?"Тестовый режим":p.mode} · {dateTime(p.created)}</small></div>{rubles(p.amount)}</div>)}</div></section>
    <section className="panel"><div className="panel-head"><h3>Задания поиска</h3></div>{jobs.length?<ul className="provider-list">{jobs.map((j)=><li key={j.state}>{jobStates[j.state]} <strong>{j.n}</strong></li>)}</ul>:<p className="empty-line">Заданий пока нет.</p>}
      {!!failures.length && <div className="record-list">{failures.map((f)=><div key={f.id}><div>{f.message}<small>{f.id}</small></div><span>{dateTime(f.updated)}</span></div>)}</div>}</section>
    <section className="panel"><div className="panel-head"><h3>Интеграции</h3></div><ul className="provider-list">{platforms.map((p)=><li key={p.id}>{p.label}<span>{adapter(p.id).allowed?"Включена":"Неактивна"}</span></li>)}</ul>
      {!!stores.length&&<div className="record-list">{stores.map((s)=><div key={s.id}><div>{s.name}<small>{s.platform} · {s.error??(s.status==="connected"?"Подключён":"Ошибка")}</small></div></div>)}</div>}</section>
    <section className="panel"><div className="panel-head"><h3>Журнал действий</h3></div><div className="record-list">{log.map((l)=><div key={l.id}><div>{l.event}<small>{l.email??"Система"}</small></div><span>{dateTime(l.created)}</span></div>)}</div></section>
  </WorkspaceShell>;
}
