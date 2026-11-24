"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { siteStates } from "@/lib/catalog";
import type { SearchInput } from "@/lib/search";
import { WorkspaceForm } from "./workspace-form";

export function SearchForm({providers, initial}:{
  providers:{id:SearchInput["source"];label:string;country:string;active:boolean;reason:string}[];
  initial?:SearchInput;
}) {
  const [country,setCountry]=useState<"RU"|"US">(initial?.country ?? "RU");
  const initialSource=initial?.source ?? providers.find((p)=>p.country===country&&p.active)?.id ?? "yandex";
  const [source,setSource]=useState(initialSource);
  const available=providers.filter((p)=>p.country===country);
  const selected=available.find((p)=>p.id===source);
  return <WorkspaceForm name="search" className="panel search-form">
    <div className="fields-grid">
      <label>Страна<select name="country" value={country} onChange={(event)=>{
        const next=event.target.value as "RU"|"US";
        setCountry(next);
        const pool=providers.filter((p)=>p.country===next);
        setSource((pool.find((p)=>p.active)??pool[0]).id);
      }}><option value="RU">Россия</option><option value="US">США</option></select></label>
      <label>Источник<select name="source" value={source} onChange={(e)=>setSource(e.target.value as SearchInput["source"])}>{available.map((p)=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
      <label>Город<input name="city" placeholder={country==="RU"?"Например, Екатеринбург":"Например, Austin, TX"} required minLength={2} maxLength={80} defaultValue={initial?.city}/></label>
      <label>Категория<input name="category" placeholder="Например, стоматология" required minLength={2} maxLength={100} defaultValue={initial?.category}/></label>
      <label>Ключевые слова<input name="keywords" placeholder="Уточните запрос" maxLength={100} defaultValue={initial?.keywords}/></label>
      <label>Статус сайта<select name="site" defaultValue={initial?.site ?? "all"}><option value="all">Любой</option>{Object.entries(siteStates).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>
    </div>
    {selected && !selected.active && <p className="notice">Источник недоступен. {selected.reason}</p>}
    <div className="form-actions"><button type="submit" className="action primary" name="action" value="search" disabled={!selected?.active}><Search size={17}/> Начать поиск</button>
      <button type="submit" className="action" name="action" value="save-search">Сохранить запрос</button></div>
  </WorkspaceForm>;
}
