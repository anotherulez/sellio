import Link from "next/link";
import { Download, ExternalLink, Search } from "lucide-react";
import { all, one } from "@/lib/db";
import { jobsFor, jobFor } from "@/lib/jobs";
import { leadStates, jobStates, siteStates, sources } from "@/lib/catalog";
import { sourceConfig, type Source } from "@/lib/source-rules";
import type { Result, SearchInput } from "@/lib/search";
import { Empty, PageHeader } from "./workspace-shell";
import { WorkspaceForm } from "./workspace-form";
import { SearchForm } from "./search-form";
import { JobRefresh } from "./job-refresh";

export type Query = Record<string,string|string[]|undefined>;
export const str = (value:Query[string]) => typeof value==="string" ? value : "";
export const dateTime=(time:number)=>new Intl.DateTimeFormat("ru-RU",{dateStyle:"short",timeStyle:"short",timeZone:"Europe/Moscow"}).format(time);
type SavedLead = {id:string;data:string;source:Source;favorite:number;state:keyof typeof leadStates;note:string;created:number};
type LeadRow = {result:Result;saved?:SavedLead};

export function LeadsSearch({ user, query }: {user:string;query:Query}) {
  const searches=all<{id:string;label:string;query:string}>("SELECT id,label,query FROM saved_searches WHERE user_id=? ORDER BY created DESC",user);
  const savedId=str(query.saved);
  const saved=savedId && one<{query:string}>("SELECT query FROM saved_searches WHERE user_id=? AND id=?",user,savedId);
  const initial=saved ? JSON.parse(saved.query) as SearchInput : undefined;
  const providers=sources.map(({id,label,country})=>{
    const {active,reason}=sourceConfig(id);
    return {id,label,country,active,reason};
  });
  return <><PageHeader title="Поиск компаний" body="Задайте город и категорию. Sellio проверит доступные сайты по базовым техническим признакам."/>
    <SearchForm key={savedId} providers={providers} initial={initial}/>
    <section className="panel"><div className="panel-head"><div><h3>Сохранённые запросы</h3><p>Откройте запрос, чтобы заполнить форму поиска.</p></div></div>
      {searches.length ? <div className="record-list">{searches.map((search)=><div key={search.id}>
        <Link className="underlined" href={"/dashboard/search?saved="+search.id}>{search.label}</Link>
        <WorkspaceForm name="delete-search" id={search.id}><button type="submit" className="action smaller">Удалить</button></WorkspaceForm>
      </div>)}</div> : <p className="empty-line">Запросов пока нет.</p>}
    </section>
    <section className="panel"><div className="panel-head"><div><h3>Источники</h3><p>Статус определяется настройками и правами по лицензии.</p></div></div><ul className="provider-list">
      {sources.map(({id,label,docs})=><li key={id}><a href={docs} target="_blank" rel="noreferrer">{label} <ExternalLink size={13}/></a><span>{sourceConfig(id).active?"Доступен":sourceConfig(id).reason}</span></li>)}</ul></section>
  </>;
}

function LeadFilters({query,job,saved}: {query:Query;job?:string;saved?:boolean}) {
  return <form method="get" className="filters">
    {job && <input type="hidden" name="job" value={job}/>}
    <label>Компания<input name="q" defaultValue={str(query.q)} placeholder="Найти по названию" maxLength={120}/></label>
    <label>Проверка сайта<select name="site" defaultValue={str(query.site)}><option value="">Все статусы</option>{Object.entries(siteStates).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>
    {saved && <label>Статус лида<select name="state" defaultValue={str(query.state)}><option value="">Все лиды</option>{Object.entries(leadStates).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>}
    <label>Порядок<select name="sort" defaultValue={str(query.sort)}><option value="">По дате</option><option value="name">По названию</option></select></label>
    {saved && <label className="checkbox filter-check"><input type="checkbox" name="fav" defaultChecked={str(query.fav)==="on"}/> Избранные</label>}
    <button type="submit" className="action smaller">Применить</button>
  </form>;
}

function filtered(rows:LeadRow[],q:Query) {
  const search=str(q.q).trim().toLowerCase();
  const site=str(q.site);
  const state=str(q.state);
  const fav=str(q.fav)==="on";
  return rows.filter(({result:r,saved})=> (!search||r.name.toLowerCase().includes(search)) && (!site||r.audit.state===site) &&
    (!state||saved?.state===state) && (!fav||saved?.favorite)).sort((a,b)=>str(q.sort)==="name" ?
      a.result.name.localeCompare(b.result.name,"ru") : (b.saved?.created??b.result.audit.date)-(a.saved?.created??a.result.audit.date));
}

function LeadTable({rows,job}: {rows:LeadRow[];job?:string}) {
  return <div className="table-scroll" tabIndex={0} role="region" aria-label="Компании"><table><thead><tr>
    <th>Компания</th><th>Рабочий контакт</th><th>Источник и сайт</th><th>Проверка сайта</th><th>Лид</th>
  </tr></thead><tbody>{rows.map(({result:r,saved})=><tr key={saved?.id??r.id}>
    <td><strong>{r.name}</strong><small>{r.category} · {r.city}</small>{r.address && <small>{r.address}</small>}</td>
    <td>{r.contact||"—"}</td><td><a className="underlined" href={r.link} target="_blank" rel="noreferrer">{sourceConfig(r.source).label} <ExternalLink size={12}/></a>{r.website && <small><a className="underlined" href={r.website} target="_blank" rel="noreferrer">{new URL(r.website).hostname}</a></small>}</td>
    <td><span className="pill">{siteStates[r.audit.state]}</span><small>{r.audit.reasons.join(" ")}</small><small>{dateTime(r.audit.date)} МСК</small></td>
    <td>{saved ? <details className="row-details"><summary>{saved.favorite ? "Избранный · " : ""}{leadStates[saved.state]}</summary>
      <WorkspaceForm name="edit-lead" id={saved.id} className="row-form"><label>Статус<select name="state" defaultValue={saved.state}>{Object.entries(leadStates).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <label>Заметка<textarea name="note" defaultValue={saved.note} maxLength={2000}/></label><label className="checkbox"><input type="checkbox" name="favorite" defaultChecked={Boolean(saved.favorite)}/> Избранное</label><button className="action smaller" type="submit">Сохранить</button></WorkspaceForm>
      <WorkspaceForm name="delete-lead" id={saved.id}><button className="action smaller" type="submit">Удалить лид</button></WorkspaceForm></details> :
      job && <WorkspaceForm name="save-lead" id={job}><input name="resultId" type="hidden" value={r.id}/><button className="action smaller" type="submit">Сохранить</button></WorkspaceForm>}</td>
  </tr>)}</tbody></table></div>;
}

export function ResultsPage({user,query}:{user:string;query:Query}) {
  const jobs=jobsFor(user);
  const selected=str(query.job);
  const job=selected ? jobFor(user,selected) : jobs[0];
  const full=job && (job.result!==null ? job : jobFor(user,job.id));
  const input=full && JSON.parse(full.query) as SearchInput|undefined;
  const provider=input && sourceConfig(input.source);
  const pending=jobs.some((j)=>["queued","running"].includes(j.state));
  const results=full?.result && provider?.active ? (JSON.parse(full.result) as Result[]).map((result)=>({result})) : [];
  const rows=filtered(results,query);
  return <><PageHeader title="Результаты" body="Проверяйте ход поиска и сохраняйте подходящие компании."><Link className="action primary" href="/dashboard/search"><Search size={17}/> Новый поиск</Link></PageHeader>
  {pending && <JobRefresh/>}
  {!jobs.length ? <Empty title="Поисков пока нет" body="Запустите поиск компаний, чтобы получить результаты." href="/dashboard/search" label="Перейти к поиску"/> :
    <section className="panel"><div className="panel-head"><div><h3>Задания поиска</h3><p>Недавние задания и их статусы</p></div></div><div className="record-list">{jobs.map((j)=>{
      const search=JSON.parse(j.query) as SearchInput;
      return <div key={j.id}><Link className={j.id===full?.id?"underlined":""} href={"/dashboard/results?job="+j.id}><strong>{search.category} · {search.city}</strong><small>{sourceConfig(search.source).label} · {dateTime(j.created)}</small></Link>
        <span className="pill">{jobStates[j.state]} {j.state==="running" && j.progress+"%"}</span></div>;
    })}</div></section>}
  {full && input && <section className="panel">
    <div className="panel-head"><div><h3>{input.category} · {input.city}</h3><p>{jobStates[full.state]} · {provider?.label}</p></div>
      {["queued","running","failed","cancelled"].includes(full.state) && <WorkspaceForm name={["queued","running"].includes(full.state)?"cancel-job":"retry-job"} id={full.id}><button type="submit" className="action smaller">{["queued","running"].includes(full.state)?"Отменить":"Повторить"}</button></WorkspaceForm>}
    </div>
    {full.state==="running" && <progress aria-label="Ход поиска" max={100} value={full.progress}/>}
    {full.message && <p className="notice" role="status">{full.message}</p>}
    {full.state==="queued" && <p className="empty-line">Рабочий процесс обработает задание, когда оно дойдёт до очереди.</p>}
    {full.state==="done" && (!provider?.active ? <p className="empty-line">Доступ к источнику отключён.</p> : !full.result ? <p className="empty-line">Срок хранения результатов истёк.</p> : <>
      {results.length ? <><LeadFilters query={query} job={full.id}/>{rows.length ? <LeadTable rows={rows} job={full.id}/> : <p className="empty-line">По выбранным фильтрам ничего не найдено.</p>}
        {provider.exportable ? <a className="action smaller export-action" href={"/dashboard/export?job="+full.id}><Download size={16}/> Скачать CSV</a> : <p className="empty-line">Экспорт CSV для этого источника отключён.</p>}</> : <p className="empty-line">Подходящих компаний по этому запросу нет.</p>}
    </>)}
  </section>}
  {selected && !full && <p className="notice">Задание не найдено.</p>}</>;
}

export function SavedLeads({user,query}:{user:string;query:Query}) {
  const saved=all<SavedLead>("SELECT id,data,source,favorite,state,note,created FROM leads WHERE user_id=? ORDER BY created DESC",user);
  const active=saved.filter((row)=>sourceConfig(row.source).active).map((row)=>({result:JSON.parse(row.data) as Result,saved:row}));
  const rows=filtered(active,query);
  return <><PageHeader title="Сохранённые лиды" body="Отмечайте перспективные компании и фиксируйте историю работы."/>
    {!saved.length ? <Empty title="Здесь появятся сохранённые компании" body="Сохраните компанию из результатов поиска." href="/dashboard/results" label="К результатам"/> :
      <section className="panel"><LeadFilters query={query} saved/>{rows.length ? <LeadTable rows={rows}/> : <p className="empty-line">По выбранным фильтрам нет доступных лидов.</p>}
        {active.some((row)=>sourceConfig(row.result.source).exportable) && <a className="action smaller export-action" href="/dashboard/export"><Download size={16}/> Скачать разрешённые записи</a>}
        {saved.length>active.length && <p className="empty-line">Часть записей скрыта после отключения источников.</p>}
      </section>}
  </>;
}
