export const sources = [
  { id: "yandex", label: "Яндекс Карты", country: "RU", key: "YANDEX_MAPS_KEY", docs: "https://yandex.ru/maps-api/products/geosearch-api" },
  { id: "2gis", label: "2ГИС", country: "RU", key: "TWO_GIS_KEY", docs: "https://docs.2gis.com/en/api/search/places/overview" },
  { id: "google", label: "Google Maps", country: "US", key: "GOOGLE_MAPS_KEY", docs: "https://developers.google.com/maps/documentation/places/web-service/policies" },
] as const;

export const platforms = [
  { id: "funpay", label: "FunPay" },
  { id: "playerok", label: "Playerok" },
  { id: "lolz", label: "Lolzteam" },
  { id: "ggsel", label: "GGSEL" },
  { id: "plati", label: "Plati Market" },
] as const;

export const siteStates = {
  missing: "Сайт не указан",
  unreachable: "Сайт не отвечает",
  review: "Требует проверки",
  problems: "Обнаружены проблемы",
  checked: "Проверен",
} as const;
export const leadStates = { new: "Новый", contacted: "Связались", closed: "Закрыт" } as const;
export const jobStates = { queued: "В очереди", running: "Выполняется", done: "Готово", failed: "Ошибка", cancelled: "Отменено" } as const;
