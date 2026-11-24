import { randomUUID } from "node:crypto";
import { all, limit, one, record, run, transaction } from "./db";
import { digest } from "./security";
import { findBusinesses, SourceError, type Result, type SearchInput } from "./search";
import { auditWebsite } from "./site-audit";
import { sourceConfig } from "./source-rules";

export type Job = { id: string; user_id: string; query: string; state: "queued"|"running"|"done"|"failed"|"cancelled"; progress: number; attempts: number; created: number; updated: number; message: string | null; result: string | null; lease: string | null };
export const jobsFor = (user: string) => all<Job>("SELECT id,user_id,query,state,progress,attempts,created,updated,message,lease,NULL AS result FROM jobs WHERE user_id=? ORDER BY created DESC LIMIT 30", user);
export const jobFor = (user: string, id: string) => one<Job>("SELECT * FROM jobs WHERE user_id=? AND id=?", user, id);

export function resultKey(item: Result) {
  return digest(item.name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "") + "|" + item.city.toLowerCase() + "|" +
    (item.address ? item.address.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "") : item.source + ":" + item.id));
}

export async function workNext() {
  const lease = randomUUID();
  const now = Date.now();
  const job = transaction(() => {
    run("UPDATE jobs SET state='failed',lease=NULL,message='Рабочий процесс прерван.',updated=? WHERE state='running' AND updated<? AND attempts>=3", now, now-90_000);
    return one<Job>(`UPDATE jobs SET state='running',attempts=attempts+1,progress=0,updated=?,lease=?
      WHERE id=(SELECT id FROM jobs WHERE (state='queued' AND run_after<=?) OR (state='running' AND updated<? AND attempts<3) ORDER BY run_after LIMIT 1) RETURNING *`,
      now, lease, now, now-90_000);
  });
  if (!job) return false;
  const update = (progress: number) => Boolean(run("UPDATE jobs SET progress=?,updated=? WHERE id=? AND lease=? AND state='running'",progress,Date.now(),job.id,lease).changes);
  try {
    const input = JSON.parse(job.query) as SearchInput;
    const cap = Math.max(1, Math.min(60, Number(process.env.SEARCH_REQUESTS_PER_SOURCE_PER_MINUTE) || 5));
    try { limit("source:"+input.source, cap, 60_000); }
    catch { throw new SourceError("Достигнут внутренний лимит запросов к источнику.", true); }
    const rows = await findBusinesses(input);
    if (!update(15)) return true;
    const results: Result[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < rows.length; index += 3) {
      const batch = await Promise.all(rows.slice(index,index+3).map(async (item) => ({...item, audit: await auditWebsite(item.website,item.websiteKnown)})));
      for (const item of batch) {
        const key = resultKey(item);
        if (!seen.has(key) && (input.site === "all" || input.site === item.audit.state)) results.push(item);
        seen.add(key);
      }
      if (!update(Math.min(95, 15 + Math.round((index+3)/rows.length*75)))) return true;
    }
    transaction(() => {
      const active = sourceConfig(input.source).active;
      const done = run("UPDATE jobs SET state=?,progress=100,result=?,message=?,updated=?,lease=NULL WHERE id=? AND lease=? AND state='running'",
        active ? "done" : "failed", active ? JSON.stringify(results) : null, active ? null : "Доступ к источнику отключён.", Date.now(), job.id, lease);
      if (done.changes) record(job.user_id, "search.finished", job.id);
    });
  } catch (error) {
    const retry = error instanceof SourceError && error.retryable && job.attempts < 3;
    const message = error instanceof SourceError ? error.message : "Не удалось выполнить поиск.";
    run("UPDATE jobs SET state=?,message=?,run_after=?,lease=NULL,updated=? WHERE id=? AND lease=? AND state='running'",
      retry ? "queued" : "failed", message, retry ? Date.now() + 60_000 * 2 ** (job.attempts - 1) : Date.now(), Date.now(), job.id, lease);
  }
  return true;
}
