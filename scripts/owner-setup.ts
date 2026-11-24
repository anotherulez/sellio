import { createServer } from "node:http";
import { setTimeout } from "node:timers";
import { one, record, run, transaction } from "../lib/db";
import { registerUser, userByEmail } from "../lib/accounts";
import { hashPassword, matches, randomToken } from "../lib/security";

const origin = "http://127.0.0.1:3046";
const secret = randomToken();

async function main() {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!email || !/^[\w.!#$%&'*+/=?^\x60{|}~-]+@[\w.-]+\.[a-z]{2,}$/i.test(email)) throw new Error("Укажите OWNER_EMAIL в .env.local.");
  if (one("SELECT id FROM users WHERE role='owner'") || userByEmail(email)?.verified) throw new Error("Аккаунт уже активирован.");
  if (!userByEmail(email)) await registerUser(email,randomToken());
  const account = userByEmail(email);
  if (!account || account.verified) throw new Error("Не удалось создать ожидающий активации аккаунт.");

  const server = createServer(async (req,res) => {
    function send(status:number,title:string,body:string) {
      res.writeHead(status,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Frame-Options":"DENY",
        "Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
        "Referrer-Policy":"no-referrer"});
      res.end(`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title} · Sellio</title><style>
      body{margin:0;background:#f8f8f9;color:#111116;font:16px system-ui}main{max-width:480px;margin:10vh auto;padding:36px;background:#fff;border:1px solid #e4e4e9;border-radius:18px}h1{letter-spacing:-.04em}form,label{display:grid;gap:10px}form{gap:16px}input,button{font:inherit;padding:10px;border:1px solid #bbb;border-radius:9px}button{background:#111116;color:#fff;cursor:pointer}</style><main><h1>${title}</h1>${body}</main></html>`);
    }
    if (req.headers.host !== "127.0.0.1:3046" || req.url !== "/") return send(404,"Страница не найдена","");
    if (req.method==="GET") return send(200,"Пароль владельца",
      `<p>Задайте пароль для Sellio на этом компьютере.</p><form method="post"><input name="token" type="hidden" value="${secret}">
      <label>Новый пароль<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label>
      <label>Повторите пароль<input name="repeat" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label>
      <button>Активировать аккаунт</button></form>`);
    if (req.method!=="POST" || req.headers.origin!==origin || !req.headers["content-type"]?.startsWith("application/x-www-form-urlencoded")) return send(403,"Запрос отклонён","");
    try {
      let data = "";
      for await (const chunk of req) {
        data += chunk.toString();
        if (data.length > 3000) return send(413,"Форма слишком большая","");
      }
      const form = new URLSearchParams(data);
      if (!matches(form.get("token")||"",secret)) return send(403,"Запрос отклонён","");
      const password = form.get("password")||"";
      if (password.length<12 || password.length>128 || password!==form.get("repeat")) return send(422,"Проверьте пароль",'<p>Введите одинаковые пароли длиной от 12 до 128 символов.</p><a href="/">Вернуться к форме</a>');
      const hash = await hashPassword(password);
      transaction(()=>{
        const result = run("UPDATE users SET password=?,verified=?,role='owner' WHERE id=? AND verified IS NULL AND NOT EXISTS (SELECT 1 FROM users WHERE role='owner')",hash,Date.now(),account.id);
        if (!result.changes) throw new Error("Account already activated");
        run("DELETE FROM tokens WHERE user_id=?",account.id);
        record(account.id,"account.owner_provisioned_locally");
      });
      send(200,"Аккаунт активирован","<p>Войдите через кнопку «Войти» на сайте Sellio. Эту вкладку можно закрыть.</p>");
      server.close();
    } catch {
      send(409,"Не удалось активировать аккаунт",'<a href="/">Вернуться к форме</a>');
    }
  });
  server.listen(3046,"127.0.0.1",()=>console.info("Sellio owner setup: "+origin));
  setTimeout(()=>server.close(),60*60_000).unref();
}

void main().catch((error)=>{console.error(error.message);process.exitCode=1;});
