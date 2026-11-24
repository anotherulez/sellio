import { currentUser } from "@/lib/session";
import { entitlement } from "@/lib/entitlements";
import { all, limit, UserError } from "@/lib/db";
import { jobFor } from "@/lib/jobs";
import type { Result } from "@/lib/search";
import { sourceConfig } from "@/lib/source-rules";
import { leadStates, siteStates } from "@/lib/catalog";

function cell(value: string) {
  const safe = /^[\s\uFEFF]*[=+@-]|^[\t\r\n]/.test(value) ? "'"+value : value;
  return '"' + safe.replaceAll('"','""') + '"';
}

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user?.verified) return new Response("Требуется вход.",{status:401});
  try {
    entitlement(user,"leads");
    limit("export:"+user.id,10,60_000);
    const id = new URL(request.url).searchParams.get("job");
    const job = id && jobFor(user.id,id);
    if (id && (!job || job.state !== "done" || !job.result)) return new Response("Задание не найдено или срок хранения истёк.",{status:404});
    const rows: {lead:Result;note:string;state:keyof typeof leadStates}[] = job && job.result ?
      (JSON.parse(job.result) as Result[]).map((lead)=>({lead,note:"",state:"new"})) :
      all<{data:string;note:string;state:keyof typeof leadStates}>("SELECT data,note,state FROM leads WHERE user_id=? ORDER BY created DESC",user.id)
        .map(({data,note,state})=>({lead:JSON.parse(data) as Result,note,state}));
    const allowed = rows.filter(({lead})=>sourceConfig(lead.source).exportable);
    if (!allowed.length && rows.length) throw new UserError("Источники этих результатов не разрешают экспорт.");
    const grid = [["Компания","Категория","Город запроса","Адрес","Рабочий контакт","Источник","Карточка","Сайт","Аудит","Причина","Дата проверки","Статус","Заметка"],
      ...allowed.map(({lead:l,note,state})=>[l.name,l.category,l.city,l.address,l.contact,sourceConfig(l.source).label,l.link,l.website,siteStates[l.audit.state],l.audit.reasons.join(" "),new Date(l.audit.date).toISOString(),leadStates[state],note])];
    return new Response("\uFEFF"+grid.map((line)=>line.map(cell).join(",")).join("\r\n"),{headers:{
      "Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="sellio-leads.csv"',"Cache-Control":"private, no-store",
    }});
  } catch(error) {
    if (error instanceof UserError) return new Response(error.message,{status:403});
    return new Response("Экспорт временно недоступен.",{status:500});
  }
}
