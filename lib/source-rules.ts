import { sources } from "./catalog";
import { one } from "./db";
import { decrypt } from "./security";

export type Source = typeof sources[number]["id"];

export function sourceConfig(id: Source) {
  const provider = sources.find((source) => source.id === id)!;
  const prefix = provider.key.replace(/_KEY$/, "");
  const saved = one<{credential:string;exportable:number;contacts:number}>("SELECT credential,exportable,contacts FROM map_integrations WHERE source=?",id);
  if (saved) return {
    ...provider, key:decrypt(saved.credential), active:true, exportable:!!saved.exportable, websiteField:id !== "2gis" || !!saved.contacts,
    reason:"",
  };
  const key = process.env[provider.key];
  const active = Boolean(key && process.env[prefix + "_CRM_ALLOWED"] === "true");
  return {
    ...provider, key, active, exportable: active && process.env[prefix + "_CSV_ALLOWED"] === "true",
    websiteField: id !== "2gis" || process.env.TWO_GIS_CONTACTS_ALLOWED === "true",
    reason: !key ? "Ключ источника не настроен." : "Доступ к данным для сохранения в CRM по лицензии не подтверждён.",
  };
}
