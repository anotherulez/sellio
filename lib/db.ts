import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

let instance: DatabaseSync | undefined;

export function db() {
  if (instance) return instance;
  const path = process.env.SELLIO_DB || resolve("data/sellio.sqlite");
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const connection = new DatabaseSync(path);
  connection.exec("PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;");
  const dir = resolve("migrations");
  try {
    connection.exec("BEGIN IMMEDIATE; CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY)");
    for (const file of readdirSync(dir).filter((name) => /^\d+\.sql$/.test(name)).sort()) {
      if (connection.prepare("SELECT 1 FROM migrations WHERE name=?").get(file)) continue;
      connection.exec(readFileSync(resolve(dir, file), "utf8"));
      connection.prepare("INSERT INTO migrations VALUES (?)").run(file);
    }
    connection.exec("COMMIT");
  } catch (error) {
    connection.close();
    throw error;
  }
  instance = connection;
  return connection;
}

export const one = <T>(sql: string, ...values: SQLInputValue[]) => db().prepare(sql).get(...values) as T | undefined;
export const all = <T>(sql: string, ...values: SQLInputValue[]) => db().prepare(sql).all(...values) as T[];
export const run = (sql: string, ...values: SQLInputValue[]) => db().prepare(sql).run(...values);

export function transaction<T>(operation: () => T) {
  const connection = db();
  connection.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    connection.exec("COMMIT");
    return result;
  } catch (error) {
    connection.exec("ROLLBACK");
    throw error;
  }
}

export const record = (user: string, event: string, detail = "") =>
  run("INSERT INTO audit_log(user_id,event,detail,created) VALUES (?,?,?,?)", user, event, detail, Date.now());

export class UserError extends Error {}

export function limit(key: string, max: number, windowMs = 900_000) {
  const now = Date.now();
  const entry = one<{ count: number }>(
    `INSERT INTO rate_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET
    count=CASE WHEN expires<=? THEN 1 ELSE count+1 END,
    expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING count`,
    key, now + windowMs, now, now,
  );
  if (entry && entry.count > max) throw new UserError("Слишком много попыток. Повторите позже.");
}
