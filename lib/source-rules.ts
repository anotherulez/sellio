import { sources } from "./catalog";

export type Source = typeof sources[number]["id"];

export function sourceConfig(id: Source) {
  const provider = sources.find((source) => source.id === id)!;
  const prefix = provider.key.replace(/_KEY$/, "");
  const key = process.env[provider.key];
  const active = Boolean(key && process.env[prefix + "_CRM_ALLOWED"] === "true");
  return {
    ...provider, key, active, exportable: active && process.env[prefix + "_CSV_ALLOWED"] === "true",
    websiteField: id !== "2gis" || process.env.TWO_GIS_CONTACTS_ALLOWED === "true",
    reason: !key ? "Ключ источника не настроен." : "Доступ к данным для сохранения в CRM по лицензии не подтверждён.",
  };
}
