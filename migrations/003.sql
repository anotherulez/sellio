CREATE TABLE map_integrations (
  source TEXT PRIMARY KEY CHECK(source IN ('yandex','2gis','google')),
  credential TEXT NOT NULL,
  exportable INTEGER NOT NULL DEFAULT 0 CHECK(exportable IN (0,1)),
  contacts INTEGER NOT NULL DEFAULT 0 CHECK(contacts IN (0,1))
);
