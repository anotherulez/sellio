import { randomUUID } from "node:crypto";
import { one, record, run, transaction, UserError } from "./db";
import { digest, hashPassword, matches, randomToken } from "./security";

export type User = { id: string; email: string; verified: number | null; role: "user" | "admin" | "owner"; created: number };
type Kind = "confirm" | "reset" | "session";
export const userByEmail = (email: string) => one<User>("SELECT id,email,verified,role,created FROM users WHERE email=?", email);
export const userForToken = (token: string, kind: Kind) => one<User>(
  "SELECT u.id,u.email,u.verified,u.role,u.created FROM tokens t JOIN users u ON u.id=t.user_id WHERE t.hash=? AND t.kind=? AND t.expires>?",
  digest(token), kind, Date.now(),
);
export const deleteToken = (token: string, kind: Kind) => run("DELETE FROM tokens WHERE hash=? AND kind=?", digest(token), kind);

export function issueToken(user: string, kind: Kind) {
  const token = randomToken();
  const hours = { confirm: 24, reset: 1, session: 24 * 14 }[kind];
  transaction(() => {
    if (kind !== "session") run("DELETE FROM tokens WHERE user_id=? AND kind=?", user, kind);
    run("INSERT INTO tokens VALUES (?,?,?,?)", digest(token), user, kind, Date.now() + hours * 3_600_000);
  });
  return token;
}

export async function registerUser(email: string, password: string) {
  const id = randomUUID();
  const hashed = await hashPassword(password);
  return transaction(() => {
    const result = run("INSERT INTO users(id,email,password,created) VALUES (?,?,?,?) ON CONFLICT(email) DO NOTHING", id, email, hashed, Date.now());
    if (!result.changes) return;
    record(id, "account.registered");
    return id;
  });
}

export async function authenticate(email: string, password: string) {
  const user = one<User & { password: string }>("SELECT * FROM users WHERE email=?", email);
  const hashed = await hashPassword(password, user?.password.split(":")[0] ?? "d98a5d032d766edcee2ce9380f45b379");
  if (!user || !matches(hashed, user.password)) throw new UserError("Проверьте email и пароль.");
  if (!user.verified) throw new UserError("Подтвердите email по ссылке из письма.");
  return user.id;
}

export async function useAccountToken(token: string, kind: "confirm" | "reset", password?: string) {
  const hashed = password ? await hashPassword(password) : null;
  return transaction(() => {
    const user = userForToken(token, kind);
    if (!user || (kind === "reset" && !hashed)) throw new UserError("Ссылка недействительна или устарела.");
    deleteToken(token, kind);
    if (kind === "confirm") run("UPDATE users SET verified=COALESCE(verified,?) WHERE id=?", Date.now(), user.id);
    else {
      run("UPDATE users SET password=? WHERE id=?", hashed, user.id);
      run("DELETE FROM tokens WHERE user_id=? AND kind='session'", user.id);
    }
    record(user.id, kind === "confirm" ? "account.verified" : "account.password_reset");
  });
}

export function initializeOwner(user: User, code: string) {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const secret = process.env.OWNER_BOOTSTRAP_SECRET;
  if (!user.verified || user.email !== email || !secret || secret.length < 32 || !matches(secret, code)) throw new UserError("Не удалось подтвердить назначение владельца.");
  return transaction(() => {
    if (one("SELECT id FROM users WHERE role='owner'")) throw new UserError("Владелец уже назначен.");
    run("UPDATE users SET role='owner' WHERE id=? AND verified IS NOT NULL", user.id);
    record(user.id, "account.owner_initialized");
  });
}
