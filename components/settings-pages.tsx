import { randomUUID } from "node:crypto";
import Link from "next/link";
import { all, one } from "@/lib/db";
import type { User } from "@/lib/accounts";
import { subscription } from "@/lib/entitlements";
import { paymentProvider } from "@/lib/payments";
import { planById, plans, rubles } from "@/lib/plans";
import { PageHeader } from "./workspace-shell";
import { WorkspaceForm } from "./workspace-form";
import { dateTime } from "./leads-pages";
import { sources } from "@/lib/catalog";
import { sourceConfig } from "@/lib/source-rules";

export function BillingPage({user}:{user:User}) {
  const active=subscription(user.id);
  const test=Boolean(paymentProvider());
  const payments=all<{id:string;plan:string;amount:number;mode:string;created:number}>("SELECT * FROM payment_events WHERE user_id=? ORDER BY created DESC",user.id);
  return <><PageHeader title="Подписка" body="Тариф, срок доступа и история операций."/>
    <section className="panel"><div className="panel-head"><div><h3>{user.role==="owner"?"Доступ владельца":active&&active.expires>Date.now()?planById(active.plan)?.name:"Активного тарифа нет"}</h3>
    <p>{user.role==="owner"?"Все возможности доступны без подписки. Технические лимиты источников действуют.":active?"Срок доступа до "+dateTime(active.expires)+" МСК.":"Продажи тарифов пока закрыты."}</p></div></div>
    {active?.renew ? <WorkspaceForm name="stop-renew"><button className="action" type="submit">Отменить продление</button></WorkspaceForm> : active && <p className="empty-line">Автопродление отключено.</p>}</section>
    {user.role!=="owner" && <div className="pricing-grid">{plans.map((p)=><article className="price-card" key={p.id}><h3>{p.name}</h3><p>{p.description}</p><div className="price">{rubles(p.price)}</div><p>Предварительная цена за месяц</p>
      {test && <WorkspaceForm name="test-plan"><input type="hidden" name="plan" value={p.id}/><input type="hidden" name="requestId" value={randomUUID()}/><button type="submit" className="action smaller">{active?"Сменить тестовый тариф":"Активировать тестовый тариф"}</button></WorkspaceForm>}
    </article>)}</div>}
    {test && user.role!=="owner" && <p className="notice">Тестовый доступ действует 30 дней. Деньги не списываются.</p>}
    <section className="panel"><div className="panel-head"><h3>История операций</h3></div>{payments.length ? <div className="record-list">{payments.map((p)=><div key={p.id}><div>{planById(p.plan)?.name}<small>{dateTime(p.created)} МСК · {p.mode==="test"?"Тестовая активация":p.mode}</small></div><strong>{rubles(p.amount)}</strong></div>)}</div> : <p className="empty-line">Операций пока нет.</p>}</section>
  </>;
}

export function SettingsPage({user}:{user:User}) {
  const pendingOwner=user.email===process.env.OWNER_EMAIL?.trim().toLowerCase()&&Boolean(process.env.OWNER_BOOTSTRAP_SECRET)&&!one("SELECT id FROM users WHERE role='owner'");
  return <><PageHeader title="Настройки" body="Ваш аккаунт и управление доступом."/>
    <section className="panel"><div className="panel-head"><div><h3>Аккаунт</h3><p>Доступ активирован</p></div></div><p className="empty-line"><strong>{user.email}</strong></p>
      <Link href="/forgot" className="action smaller export-action">Изменить пароль</Link></section>
    {pendingOwner && <WorkspaceForm name="owner" className="panel"><div className="panel-head"><div><h3>Назначение владельца</h3><p>Введите одноразовый код, заданный на сервере.</p></div></div><label>Код<input name="code" type="password" minLength={32} maxLength={512} required/></label><button type="submit" className="action primary">Подтвердить назначение</button></WorkspaceForm>}
    {user.role==="owner" && <section className="panel"><div className="panel-head"><div><h3>Подключение карт</h3><p>Ключи хранятся в зашифрованном виде. Хранение и выгрузка зависят от лицензии источника.</p></div></div>
      <div className="record-list">{sources.map(({id,label,docs})=>{
        const config=sourceConfig(id);
        const saved=!!one("SELECT 1 FROM map_integrations WHERE source=?",id);
        return <div key={id}><div><strong>{label}</strong><small>{config.active?"Ключ настроен":config.reason}</small></div>
          <details className="row-details"><summary>{config.active?"Изменить ключ":"Подключить"}</summary>
            <WorkspaceForm name="save-map" className="row-form">
              <input type="hidden" name="source" value={id}/><label>API-ключ<input name="key" type="password" required minLength={8} maxLength={300} autoComplete="off"/></label>
              <label className="checkbox"><input name="crm" type="checkbox" required/> Лицензия разрешает хранить данные в CRM</label>
              <label className="checkbox"><input name="exportable" type="checkbox" defaultChecked={config.exportable}/> Лицензия разрешает выгрузку CSV</label>
              {id==="2gis" && <label className="checkbox"><input name="contacts" type="checkbox" defaultChecked={config.websiteField}/> В API открыт доступ к контактам</label>}
              <button className="action smaller" type="submit">Сохранить ключ</button>
            </WorkspaceForm>
            {saved && <WorkspaceForm name="remove-map" className="row-form"><input type="hidden" name="source" value={id}/><button type="submit" className="action smaller">Удалить ключ</button></WorkspaceForm>}
            <a href={docs} className="underlined" target="_blank" rel="noreferrer">Документация API</a>
          </details></div>;
      })}</div>
    </section>}
  </>;
}
