import { one, run } from "./db";
import { decrypt } from "./security";

export async function sendTelegram(token: string, chat: string, text: string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:chat,text}),
      signal:AbortSignal.timeout(6000),redirect:"error",cache:"no-store",
    });
    return response.ok && (await response.json()).ok === true;
  } catch { return false; }
}

export function enqueueNotification(user: string, text: string) {
  if (one("SELECT 1 FROM telegram WHERE user_id=? AND enabled=1",user)) {
    run("INSERT INTO notification_queue(user_id,text,created,next_try) VALUES (?,?,?,?) ON CONFLICT DO NOTHING",user,text,Date.now(),Date.now());
  }
}

export async function sendNextNotification() {
  const now=Date.now();
  run("UPDATE notification_queue SET state='failed' WHERE state='running' AND attempts>=3 AND next_try<=?",now);
  const task = one<{id:number;user_id:string;text:string;attempts:number}>(`UPDATE notification_queue SET state='running',attempts=attempts+1,next_try=?
    WHERE id=(SELECT id FROM notification_queue WHERE state IN ('queued','running') AND next_try<=? AND attempts<3 ORDER BY id LIMIT 1) RETURNING id,user_id,text,attempts`,now+60_000,now);
  if (!task) return;
  const connection=one<{token:string;chat:string}>("SELECT token,chat FROM telegram WHERE user_id=? AND enabled=1",task.user_id);
  const ok=connection && await sendTelegram(decrypt(connection.token),connection.chat,task.text);
  run("UPDATE notification_queue SET state=?,next_try=? WHERE id=? AND attempts=?",
    ok ? "sent" : !connection || task.attempts>=3 ? "failed" : "queued",Date.now()+60_000*2**task.attempts,task.id,task.attempts);
}
