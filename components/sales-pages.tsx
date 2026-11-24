import Link from "next/link";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import { platforms } from "@/lib/catalog";
import { all, one } from "@/lib/db";
import { adapter, storesFor } from "@/lib/markets";
import { overviewFor } from "@/lib/metrics";
import { rubles } from "@/lib/plans";
import { Overview } from "./overview";
import { dateTime } from "./leads-pages";
import { Empty, PageHeader } from "./workspace-shell";
import { WorkspaceForm } from "./workspace-form";

type Order = {store_id:string;external_id:string;title:string;amount:number;commission:number|null;cost:number|null;status:string;created:number;store:string};
const cents=(value:number|null)=>value===null?"—":rubles(value/100);
const ordersFor=(user:string)=>all<Order>(`SELECT o.*,s.name AS store FROM orders o JOIN stores s ON s.id=o.store_id
  WHERE s.user_id=? ORDER BY o.created DESC LIMIT 100`,user);
const storeEmpty=(title:string,body:string)=><Empty title={title} body={body} href="/dashboard/stores" label="К магазинам"/>;

export function StoresPage({user}:{user:string}) {
  const stores=storesFor(user);
  const available=platforms.filter((p)=>adapter(p.id).allowed);
  return <><PageHeader title="Магазины" body="Подключайте свои магазины и проверяйте, какие данные доступны по каждой площадке."/>
    {stores.length ? <section className="panel"><div className="panel-head"><div><h3>Ваши магазины</h3><p>Лоты и последние 30 дней рублёвых заказов</p></div></div><div className="record-list">{stores.map((store)=><div className="store-row" key={store.id}>
      <div><strong>{store.name}</strong><small>{platforms.find((p)=>p.id===store.platform)?.label} · {store.status==="connected" ? "Подключён" : "Требует проверки"}</small>
      {store.synced && <small>Обновлено {dateTime(store.synced)} МСК</small>}{store.error && <small>{store.error}</small>}</div>
      <div className="inline-actions"><WorkspaceForm name="sync-store" id={store.id}><button className="action smaller" type="submit">Синхронизировать</button></WorkspaceForm>
        <details className="row-details"><summary>Отключить</summary><p>Синхронизированные лоты и заказы этого магазина будут удалены из Sellio.</p><WorkspaceForm name="remove-store" id={store.id}><button className="action smaller" type="submit">Отключить магазин</button></WorkspaceForm></details></div>
    </div>)}</div></section> : <Empty title="У вас пока нет магазинов" body={available.length?"Добавьте магазин через доступное подключение.":"Сейчас подключения выключены в настройках интеграций."}/>}
    {available.length>0 && <WorkspaceForm name="connect-store" className="panel">
      <div className="panel-head"><div><h3>Подключить магазин</h3><p>Укажите ID продавца и API-ключ Digiseller с правами просмотра товаров и статистики.</p></div></div>
      <div className="fields-grid"><label>Площадка<select name="platform">{available.map((p)=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
        <label>Название<input name="name" required maxLength={120}/></label><label>ID продавца<input name="seller" type="number" inputMode="numeric" min={1} required/></label>
        <label>API-ключ<input name="key" type="password" autoComplete="off" minLength={8} maxLength={200} required/></label></div>
      <button type="submit" className="action primary">Подключить <ArrowUpRight size={17}/></button>
    </WorkspaceForm>}
    <section className="panel"><div className="panel-head"><div><h3>Интеграции</h3><p>Доступные операции по площадкам</p></div></div><ul className="provider-list">
      {platforms.map((p)=>{const value=adapter(p.id);return <li key={p.id}>{value.reference ? <a href={value.reference} target="_blank" rel="noreferrer">{p.label} <ExternalLink size={13}/></a> : <strong>{p.label}</strong>}
        <span>{value.allowed ? "Синхронизация лотов и заказов" : value.sync ? "Подключение отключено в настройках сервера" : "Адаптер пока недоступен"}</span></li>;})}
    </ul><p className="empty-line">Поднятие лотов по расписанию пока недоступно.</p></section>
  </>;
}

export function LotsPage({user}:{user:string}) {
  const lots=all<{store_id:string;external_id:string;title:string;price:number;status:string;store:string}>(`SELECT l.*,s.name AS store FROM lots l JOIN stores s ON s.id=l.store_id
    WHERE s.user_id=? ORDER BY l.title LIMIT 300`,user);
  return <><PageHeader title="Лоты" body="Просматривайте опубликованные и скрытые товары подключённых магазинов."/>
    {lots.length ? <section className="panel"><div className="table-scroll" tabIndex={0} role="region" aria-label="Лоты"><table><thead><tr><th>Лот</th><th>Магазин</th><th>Цена</th><th>Статус</th></tr></thead><tbody>
      {lots.map((l)=><tr key={l.store_id+"/"+l.external_id}><td><strong>{l.title}</strong><small>№ {l.external_id}</small></td><td>{l.store}</td><td>{cents(l.price)}</td><td><span className="pill">{l.status}</span></td></tr>)}
    </tbody></table></div></section> : storeEmpty("Лотов пока нет","Синхронизируйте магазин, чтобы увидеть его товары.")}</>;
}

export function OrdersPage({user}:{user:string}) {
  const orders=ordersFor(user);
  return <><PageHeader title="Заказы" body="Смотрите заказы из подключённых магазинов и указывайте себестоимость."/>
  {orders.length ? <section className="panel"><div className="table-scroll" tabIndex={0} role="region" aria-label="Заказы"><table><thead><tr><th>Заказ</th><th>Магазин</th><th>Сумма</th><th>Статус</th><th>Себестоимость</th></tr></thead><tbody>
    {orders.map((o)=><tr key={o.store_id+"/"+o.external_id}><td><strong>{o.title}</strong><small>№ {o.external_id} · {dateTime(o.created)} МСК</small></td><td>{o.store}</td><td>{cents(o.amount)}</td>
    <td><span className="pill">{o.status}</span></td><td><details className="row-details"><summary>{o.cost===null?"Указать":cents(o.cost)}</summary>
      <WorkspaceForm name="order-cost" className="row-form"><input type="hidden" name="store" value={o.store_id}/><input type="hidden" name="order" value={o.external_id}/>
        <label>Сумма в ₽<input name="cost" type="number" min={0} max={9999999} step="0.01" required defaultValue={o.cost===null?undefined:o.cost/100}/></label><button type="submit" className="action smaller">Сохранить</button></WorkspaceForm></details></td></tr>)}
  </tbody></table></div></section> : storeEmpty("Заказов пока нет","Заказы появятся после синхронизации магазина.")}</>;
}

const stockStates:Record<string,string>={available:"Свободна",reserved:"Зарезервирована",delivered:"Выдана вручную"};

export function StockPage({user}:{user:string}) {
  const items=all<{id:string;label:string;state:string;order_id:string|null;created:number}>("SELECT id,label,state,order_id,created FROM inventory WHERE user_id=? ORDER BY created DESC",user);
  const orders=ordersFor(user).filter((o)=>o.status==="Оплачен");
  return <><PageHeader title="Склад и выдача" body="Храните товары, резервируйте их под оплаченные заказы и отмечайте ручную выдачу."/>
    <p className="notice">Автоматическая выдача через площадки пока недоступна.</p>
    <WorkspaceForm name="add-stock" className="panel">
      <div className="panel-head"><div><h3>Добавить позицию</h3><p>Содержимое позиции шифруется. Его можно открыть после резерва под оплаченный заказ.</p></div></div>
      <div className="fields-grid"><label>Название товара<input name="label" required maxLength={120}/></label><label>Ключ или содержимое<textarea name="secret" required maxLength={4000}/></label></div>
      <label className="checkbox"><input type="checkbox" name="owned" required/> У меня есть право продавать этот товар.</label><button type="submit" className="action primary">Добавить на склад</button>
    </WorkspaceForm>
    {items.length ? <section className="panel"><div className="panel-head"><div><h3>Позиции на складе</h3><p>В наличии: {items.filter((i)=>i.state==="available").length}</p></div></div><div className="record-list">
      {items.map((i)=><div key={i.id}><div><strong>{i.label}</strong><small>{stockStates[i.state]}{i.order_id&&" · Заказ № "+i.order_id}</small></div>
        {i.state!=="delivered" && <details className="row-details"><summary>Действия</summary>
          {i.state==="available" ? <>
            {orders.length>0 && <WorkspaceForm name="reserve-stock" className="row-form" id={i.id}><label>Оплаченный заказ<select required name="order">{orders.map((o)=><option key={o.store_id+"/"+o.external_id} value={o.store_id+"/"+o.external_id}>{o.store} · № {o.external_id}</option>)}</select></label><button type="submit" className="action smaller">Зарезервировать</button></WorkspaceForm>}
            <WorkspaceForm name="delete-stock" id={i.id}><button type="submit" className="action smaller">Удалить</button></WorkspaceForm>
          </> : <div className="record-actions">
            <WorkspaceForm name="reveal-stock" id={i.id}><button type="submit" className="action smaller">Открыть товар</button></WorkspaceForm>
            <WorkspaceForm name="fulfill-stock" id={i.id}><button type="submit" className="action smaller">Отметить ручную выдачу</button></WorkspaceForm>
            <WorkspaceForm name="release-stock" id={i.id}><button type="submit" className="action smaller">Снять резерв</button></WorkspaceForm></div>}
        </details>}</div>)}
    </div></section> : <Empty title="Склад пуст" body="Добавьте первый цифровой товар."/>}
  </>;
}

export function MessagesPage({user}:{user:string}) {
  const templates=all<{id:string;title:string;body:string}>("SELECT id,title,body FROM templates WHERE user_id=? ORDER BY title",user);
  return <><PageHeader title="Сообщения" body="Сохраняйте заготовки для частых вопросов покупателей."/>
    <p className="notice">Синхронизация чатов и автоответчик пока недоступны.</p>
    <WorkspaceForm name="add-template" className="panel"><div className="panel-head"><h3>Новый шаблон</h3></div>
      <div className="fields-grid"><label>Название<input name="name" required maxLength={120}/></label><label>Ответ<textarea name="body" required maxLength={2000}/></label></div><button type="submit" className="action primary">Сохранить шаблон</button>
    </WorkspaceForm>
    {!!templates.length && <section className="panel"><div className="panel-head"><h3>Шаблоны ответов</h3></div><div className="record-list">
      {templates.map((t)=><div key={t.id}><div><strong>{t.title}</strong><p className="preserve">{t.body}</p></div><WorkspaceForm name="delete-template" id={t.id}><button type="submit" className="action smaller">Удалить</button></WorkspaceForm></div>)}
    </div></section>}
  </>;
}

export function PricePage({user}:{user:string}) {
  const lots=all<{store_id:string;external_id:string;title:string;price:number;store:string}>(`SELECT l.*,s.name AS store FROM lots l JOIN stores s ON s.id=l.store_id
    WHERE s.user_id=? ORDER BY l.title LIMIT 300`,user);
  const rules=all<{id:string;lot:string;store_id:string;min:number;max:number}>("SELECT * FROM price_rules WHERE user_id=?",user);
  const selected=lots[0];
  return <><PageHeader title="Ценовые правила" body="Задавайте допустимый диапазон цены для лотов."/>
    <p className="notice">Правила сохраняются как черновики. Мониторинг рынка и автоматическое изменение цен пока недоступны.</p>
    {selected ? <section className="panel"><div className="panel-head"><div><h3>Ваши лоты</h3><p>Откройте лот, чтобы задать нижнюю и верхнюю границы.</p></div></div>
      <div className="record-list">{lots.map((l)=><div key={l.store_id+"/"+l.external_id}><div><strong>{l.title}</strong><small>{l.store} · {cents(l.price)}</small></div>
        <details className="row-details"><summary>Настроить</summary><WorkspaceForm name="add-price" className="row-form"><input type="hidden" name="store" value={l.store_id}/><input type="hidden" name="lot" value={l.external_id}/>
          <label>От, ₽<input name="min" type="number" min=".01" max="9999999" step=".01" required/></label><label>До, ₽<input name="max" type="number" min=".01" max="9999999" step=".01" required/></label>
          <button type="submit" className="action smaller">Сохранить черновик</button></WorkspaceForm></details></div>)}</div></section> : storeEmpty("Лотов пока нет","Для создания правила сначала синхронизируйте магазин.")}
    {!!rules.length && <section className="panel"><div className="panel-head"><h3>Черновики правил</h3></div><div className="record-list">{rules.map((r)=><div key={r.id}><div><strong>{lots.find((l)=>l.external_id===r.lot&&l.store_id===r.store_id)?.title ?? "Лот № "+r.lot}</strong><small>{cents(r.min)} — {cents(r.max)}</small></div><WorkspaceForm name="delete-price" id={r.id}><button className="action smaller" type="submit">Удалить</button></WorkspaceForm></div>)}</div></section>}
  </>;
}

export function AnalyticsPage({user}:{user:string}) {
  const metrics=overviewFor(user);
  return <><PageHeader title="Аналитика" body="Рублёвые продажи за последние семь дней по московскому времени."/>
    {metrics.connected ? <><div className="analytics-summary">{[["Выручка",metrics.revenue],["Комиссии",metrics.fees],["Себестоимость",metrics.costs],["Прибыль",metrics.profit]].map(([name,value])=><div className="panel" key={name}><p>{name}</p><strong>{typeof value==="number"?rubles(value):"—"}</strong></div>)}</div>
      {(metrics.costs===null||metrics.fees===null) && <p className="notice">Прибыль появится после учёта комиссий и себестоимости всех оплаченных заказов. <Link href="/dashboard/orders" className="underlined">К заказам</Link></p>}<Overview metrics={metrics}/></> :
      storeEmpty("Аналитика пока пуста","Подключите магазин и синхронизируйте заказы.")}</>;
}

export function TelegramPage({user}:{user:string}) {
  const connected=one("SELECT 1 FROM telegram WHERE user_id=? AND enabled=1",user);
  const events=all<{id:number;text:string;state:string;created:number}>("SELECT id,text,state,created FROM notification_queue WHERE user_id=? ORDER BY id DESC LIMIT 20",user);
  return <><PageHeader title="Telegram и уведомления" body="Получайте сообщения о новых заказах и ошибках синхронизации."/>
    {connected ? <WorkspaceForm name="stop-telegram" className="panel"><div className="panel-head"><div><h3>Telegram подключён</h3><p>В очередь поступают события после синхронизации магазинов.</p></div></div><button type="submit" className="action">Остановить уведомления</button></WorkspaceForm> :
      <WorkspaceForm name="connect-telegram" className="panel"><div className="panel-head"><div><h3>Подключить Telegram</h3><p>Откройте чат с вашим ботом и отправьте ему /start. Затем укажите токен бота и ID чата.</p></div></div>
        <div className="fields-grid"><label>Токен бота<input name="token" type="password" autoComplete="off" required maxLength={107}/></label><label>Числовой ID чата<input name="chat" required maxLength={21}/></label></div>
        <button type="submit" className="action primary">Отправить пробное сообщение</button></WorkspaceForm>}
    {!!events.length && <section className="panel"><div className="panel-head"><h3>Журнал уведомлений</h3></div><div className="record-list">{events.map((e)=><div key={e.id}><div><p className="preserve">{e.text}</p><small>{dateTime(e.created)}</small></div><span className="pill">{({queued:"В очереди",running:"Отправляется",sent:"Отправлено",failed:"Ошибка"})[e.state]??e.state}</span></div>)}</div></section>}
  </>;
}
