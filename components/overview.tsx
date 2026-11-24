import { Activity, ArrowDownRight, ArrowUpRight, ChartNoAxesColumnIncreasing, CircleHelp, LayoutGrid, ListFilter, Package, Search, ShoppingBag, Store } from "lucide-react";
import { Mark } from "./brand";
import { rubles } from "@/lib/plans";

type Order = { store_id: string; external_id: string; title: string; status: string; amount: number };
type Metrics = { today: number; orders: number; profit: number | null; leads: number | null; connected: boolean; lastSync: number | null; recent: Order[]; trend: { label: string; value: number }[] };
export const emptyMetrics: Metrics = { today: 0, orders: 0, profit: null, leads: null, connected: false, lastSync: null, recent: [], trend: [] };

export function Overview({ metrics = emptyMetrics, preview = false }: { metrics?: Metrics; preview?: boolean }) {
  const max = Math.max(1, ...metrics.trend.map((point) => point.value));
  return <div className="overview">
    <section className="primary-metric">
      <div><span className="metric-label">Выручка сегодня</span><strong>{metrics.connected ? rubles(metrics.today) : "—"}</strong>
        {!!metrics.lastSync && <span className="metric-label">Синхронизация {new Intl.DateTimeFormat("ru-RU",{dateStyle:"short",timeStyle:"short",timeZone:"Europe/Moscow"}).format(metrics.lastSync)} МСК</span>}</div>
      <span className="metric-icon"><ArrowUpRight size={20}/></span>
    </section>
    <div className="metric-grid">
      <div><ShoppingBag/><span>Заказы за 7 дней</span><strong>{metrics.connected ? metrics.orders : "—"}</strong></div>
      <div><ChartNoAxesColumnIncreasing/><span>Прибыль за период</span><strong>{metrics.connected && metrics.profit !== null ? rubles(metrics.profit) : "—"}</strong></div>
      <div><Search/><span>Новые лиды</span><strong>{metrics.leads ?? "—"}</strong></div>
    </div>
    <section className="chart-panel">
      <div className="panel-head"><div><h3>Динамика продаж</h3><p>Выручка за последние 7 дней</p></div><span className="chart-range">7 дней</span></div>
      <div className="chart-area">
        {metrics.trend.length ? <div className="bars" aria-label="Выручка по дням">{metrics.trend.map((point) => <div key={point.label}><i style={{ height: 100 * point.value / max + "%" }} title={rubles(point.value)}/><span>{point.label}</span></div>)}</div> :
          <div className="chart-empty"><Activity size={21}/><span>{preview ? "Здесь появятся продажи" : "Подключите магазин, чтобы видеть продажи"}</span></div>}
      </div>
      {!metrics.trend.length && <div className="chart-days" aria-hidden="true">{["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map((s)=><span key={s}>{s}</span>)}</div>}
    </section>
    {!preview && <section className="panel"><div className="panel-head"><div><h3>Последние заказы</h3></div></div>
      {metrics.recent.length ? <div className="recent">{metrics.recent.map((item)=><div key={item.store_id+"/"+item.external_id}><Package size={18}/><span>{item.title}{item.status==="Возврат" && " · Возврат"}</span><strong>{rubles(item.amount)}</strong></div>)}</div> : <p className="empty-line">Заказов пока нет.</p>}</section>}
  </div>;
}

const previewNav = [[LayoutGrid,"Обзор"],[Search,"Поиск компаний"],[ListFilter,"Сохранённые лиды"],[Store,"Магазины"],[ShoppingBag,"Заказы"],[ChartNoAxesColumnIncreasing,"Аналитика"]] as const;

export function ProductPreview() {
  return <div className="product-frame" aria-label="Предпросмотр интерфейса Sellio">
    <div className="window-bar"><span className="window-dots"><i/><i/><i/></span><span>Кабинет Sellio</span><ArrowDownRight size={14}/></div>
    <div className="preview-layout">
      <aside className="preview-nav">
        <div className="preview-brand"><Mark/> Sellio<span>.</span></div>
        {previewNav.map(([Icon,label],i)=><div className={i === 0 ? "selected" : ""} key={label}><Icon size={15}/><span>{label}</span></div>)}
        <div className="preview-help"><CircleHelp size={15}/> Помощь</div>
      </aside>
      <div className="preview-main">
        <div className="preview-title"><h2>Обзор</h2><span className="preview-avatar">S</span></div>
        <Overview preview/>
      </div>
    </div>
  </div>;
}
