import { z } from "zod";
import { sourceConfig, type Source } from "./source-rules";
import { UserError } from "./db";
import type { siteStates } from "./catalog";

export const searchSchema = z.object({
  source: z.enum(["yandex", "2gis", "google"]),
  country: z.enum(["RU", "US"]),
  city: z.string().trim().min(2).max(80),
  category: z.string().trim().min(2).max(100),
  keywords: z.string().trim().max(100),
  site: z.enum(["all","missing","unreachable","review","problems","checked"]),
}).refine((input) => sourceConfig(input.source).country === input.country, "Источник не работает в выбранной стране.");
export type SearchInput = z.infer<typeof searchSchema>;
type Business = { id: string; name: string; source: Source; city: string; address: string; category: string; link: string; website: string; contact: string; websiteKnown: boolean };
export type Audit = { state: keyof typeof siteStates; reasons: string[]; date: number; status?: number; elapsed?: number };
export type Result = Business & { audit: Audit };
export class SourceError extends UserError {
  constructor(message: string, public retryable: boolean) { super(message); }
}
type GooglePlace = { id?: string; displayName?: { text?: string }; formattedAddress?: string; primaryTypeDisplayName?: { text?: string }; googleMapsUri?: string; websiteUri?: string; nationalPhoneNumber?: string };
type YandexPlace = { properties?: { CompanyMetaData?: { id?: string; name?: string; address?: string; url?: string; Categories?: { name?: string }[]; Phones?: { formatted?: string }[] } } };
type GisPlace = { id?: string; name?: string; address_name?: string; contact_groups?: { contacts?: { type: string; value?: string; url?: string }[] }[] };

export function webUrl(value = "") {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
  } catch { return ""; }
}

async function api<T>(url: string | URL, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8500) });
  } catch { throw new SourceError("Источник временно недоступен.", true); }
  if (!response.ok) {
    if (response.status === 429 || response.status >= 500) throw new SourceError(`Источник временно ограничил запросы (HTTP ${response.status}).`, true);
    throw new SourceError(`Источник отклонил запрос (HTTP ${response.status}). Проверьте ключ и разрешения.`, false);
  }
  try { return await response.json() as T; }
  catch { throw new SourceError("Источник прислал ответ в неизвестном формате.", true); }
}

export async function findBusinesses(input: SearchInput): Promise<Business[]> {
  const source = sourceConfig(input.source);
  if (!source.active || !source.key) throw new SourceError(source.reason, false);
  const context = [input.city, input.category, input.keywords].filter(Boolean).join(" ");
  const shared = { source: input.source, city: input.city, category: input.category, websiteKnown: source.websiteField };
  if (input.source === "google") {
    const result = await api<{ places?: GooglePlace[] }>("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": source.key, "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.primaryTypeDisplayName,places.googleMapsUri,places.websiteUri,places.nationalPhoneNumber" },
      body: JSON.stringify({ textQuery: context + ", USA", languageCode: "en", regionCode: "US", pageSize: 12 }),
    });
    return (result.places ?? []).flatMap((p) => !p.id || !p.displayName?.text ? [] : [{
      ...shared, id: p.id, name: p.displayName.text, address: p.formattedAddress ?? "", category: p.primaryTypeDisplayName?.text ?? input.category,
      link: webUrl(p.googleMapsUri) || "https://www.google.com/maps/search/?api=1&query=business&query_place_id=" + encodeURIComponent(p.id),
      website: webUrl(p.websiteUri), contact: p.nationalPhoneNumber ?? "",
    }]);
  }
  if (input.source === "yandex") {
    const url = new URL("https://search-maps.yandex.ru/v1/");
    url.search = new URLSearchParams({ text: context, type: "biz", lang: "ru_RU", apikey: source.key, results: "12" }).toString();
    const result = await api<{ features?: YandexPlace[] }>(url);
    if (!Array.isArray(result.features)) throw new SourceError("Яндекс Карты не вернули список организаций.", false);
    return result.features.flatMap(({properties}) => {
      const p = properties?.CompanyMetaData;
      if (!p?.id || !p.name) return [];
      return [{ ...shared, id: p.id, name: p.name, address: p.address ?? "", category: p.Categories?.[0]?.name ?? input.category,
        link: "https://yandex.ru/maps/org/" + encodeURIComponent(p.id), website: webUrl(p.url), contact: p.Phones?.[0]?.formatted ?? "" }];
    });
  }
  const url = new URL("https://catalog.api.2gis.com/3.0/items");
  url.search = new URLSearchParams({ q: context, type: "branch", key: source.key, page_size: "12",
    ...(source.websiteField ? {fields: "items.contact_groups"} : {}) }).toString();
  const reply = await api<{ meta?: { code?: number }; result?: { items?: GisPlace[] } }>(url);
  if (reply.meta?.code === 404) return [];
  if (reply.meta?.code !== 200) throw new SourceError("2ГИС отклонил запрос. Проверьте доступные поля и квоты.", false);
  return (reply.result?.items ?? []).flatMap((p) => {
    if (!p.id || !p.name) return [];
    const id = p.id.split("_")[0];
    const contacts = p.contact_groups?.flatMap((g) => g.contacts ?? []) ?? [];
    const site = contacts.find((c) => c.type === "website");
    return [{ ...shared, id, name: p.name, address: p.address_name ?? "", link: "https://2gis.ru/firm/" + encodeURIComponent(id),
      website: webUrl(site?.url ?? site?.value), contact: contacts.find((c) => c.type === "phone")?.value ?? "" }];
  });
}
