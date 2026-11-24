import { lookup } from "node:dns/promises";
import { request as http } from "node:http";
import { request as https } from "node:https";
import { BlockList, isIP } from "node:net";
import type { Audit } from "./search";

const blocked = new BlockList();
for (const [address, bits] of [["0.0.0.0",8],["10.0.0.0",8],["100.64.0.0",10],["127.0.0.0",8],["169.254.0.0",16],["172.16.0.0",12],["192.0.0.0",24],["192.0.2.0",24],["192.168.0.0",16],["198.18.0.0",15],["198.51.100.0",24],["203.0.113.0",24],["224.0.0.0",3]] as const) blocked.addSubnet(address,bits,"ipv4");

class AuditUnavailable extends Error {}

async function page(url: URL, signal: AbortSignal, redirects = 0): Promise<{ status: number; body: string; last: URL; type: string }> {
  if (!["http:", "https:"].includes(url.protocol) || url.port || url.username || url.password || isIP(url.hostname) ||
      !url.hostname.includes(".") || /\.(localhost|local|internal|test|onion|invalid)\.?$/i.test(url.hostname)) {
    throw new AuditUnavailable("Адрес не подходит для безопасной публичной проверки.");
  }
  if (redirects > 3) throw new AuditUnavailable("Слишком много перенаправлений.");
  const addresses = await Promise.race([
    lookup(url.hostname, { family: 4, all: true }),
    new Promise<never>((_,reject) => signal.addEventListener("abort", () => reject(new Error("timeout")), {once:true})),
  ]);
  if (!addresses.length || addresses.some(({address}) => blocked.check(address,"ipv4"))) throw new AuditUnavailable("Адрес указывает на закрытую или зарезервированную сеть.");
  const address = addresses[0].address;
  const response = await new Promise<{ status: number; body: string; type: string; location?: string }>((resolve, reject) => {
    const request = (url.protocol === "https:" ? https : http)(url, {
      signal, agent: false, family: 4, lookup: (_host, _options, callback) => callback(null, address, 4),
      headers: { "User-Agent": "SellioSiteCheck/1.0", "Accept": "text/html", "Accept-Encoding": "identity" },
    }, (reply) => {
      const status = reply.statusCode ?? 0;
      const type = reply.headers["content-type"] ?? "";
      const location = reply.headers.location;
      if (status >= 300 || !type.includes("text/html")) {
        resolve({ status, body: "", type, location });
        reply.destroy();
        return;
      }
      let size = 0;
      const chunks: Buffer[] = [];
      reply.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 140_000) {
          chunks.push(chunk.subarray(0, 140_000 - (size - chunk.length)));
          resolve({ status, body: Buffer.concat(chunks).toString("utf8"), type, location });
          reply.destroy();
        } else chunks.push(chunk);
      });
      reply.on("end", () => resolve({ status, body: Buffer.concat(chunks).toString("utf8"), type, location }));
      reply.on("error", reject);
    });
    request.on("error", reject);
    request.end();
  });
  if ([301,302,303,307,308].includes(response.status) && response.location) return page(new URL(response.location,url), signal, redirects + 1);
  return {...response, last: url};
}

export async function auditWebsite(website: string, known = true): Promise<Audit> {
  const date = Date.now();
  if (!known) return { state: "review", reasons: ["Источник не предоставил поле сайта."], date };
  if (!website) return { state: "missing", reasons: ["В данных источника нет адреса сайта."], date };
  try {
    const { status, body, last, type } = await page(new URL(website), AbortSignal.timeout(5000));
    const elapsed = Date.now() - date;
    if (status === 403 || status === 429 || status === 401) return {state:"review", reasons:[`Сайт ограничил проверку (HTTP ${status}).`],date,status,elapsed};
    const reasons: string[] = [];
    if (status < 200 || status >= 300) reasons.push(`Страница ответила HTTP ${status}.`);
    if (last.protocol !== "https:") reasons.push("Страница открылась по HTTP.");
    if (elapsed > 2500) reasons.push(`Серверная проверка заняла ${elapsed} мс.`);
    if (status < 300 && type.includes("text/html")) {
      if (!/<title[^>]*>\s*[^<\s]/i.test(body)) reasons.push("В проверенном фрагменте нет заголовка title.");
      if (!/<meta[^>]*\bname\s*=\s*["']?viewport\b/i.test(body)) reasons.push("В проверенном фрагменте нет метатега viewport.");
      if (!/<html[^>]*\blang\s*=/i.test(body)) reasons.push("В проверенном фрагменте не указан язык документа.");
    }
    return {state: reasons.length ? "problems" : type.includes("text/html") ? "checked" : "review", reasons: reasons.length ? reasons : [type.includes("text/html") ? "Базовые серверные проверки пройдены." : "Сервер не вернул HTML."], date, status, elapsed};
  } catch (error) {
    let cause = error as NodeJS.ErrnoException;
    if (cause.code === "ENOTFOUND") cause = new AuditUnavailable("Публичная запись IPv4 не найдена.");
    if (cause instanceof AuditUnavailable) return {state:"review", reasons:[cause.message],date};
    if (cause.code === "CERT_HAS_EXPIRED" || cause.code === "ERR_TLS_CERT_ALTNAME_INVALID" || cause.code === "DEPTH_ZERO_SELF_SIGNED_CERT") return {state:"problems", reasons:["Не удалось подтвердить TLS-сертификат."],date};
    return {state:"unreachable",reasons:["Ответ не получен во время серверной проверки."],date};
  }
}
