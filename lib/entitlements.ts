import { one, run, UserError } from "./db";
import { planById, type PlanId } from "./plans";
import type { User } from "./accounts";

export function subscription(id: string) {
  return one<{ plan: PlanId; expires: number; renew: number }>("SELECT plan,expires,renew FROM subscriptions WHERE user_id=?", id);
}

export function entitlement(user: User, feature: "leads" | "stores" | "automation") {
  if (user.role === "owner") return { searches: Infinity, stores: Infinity };
  const active = subscription(user.id);
  const plan = active && active.expires > Date.now() ? planById(active.plan) : undefined;
  if (!plan || !(plan.features as readonly string[]).includes(feature)) throw new UserError("Для этого действия нужен активный тариф с доступом к функции.");
  const quota = (key: "searches" | "stores") =>
    one<{maximum: number}>("SELECT maximum FROM quota_overrides WHERE user_id=? AND feature=?", user.id, key)?.maximum ?? plan.limits[key];
  return { searches: quota("searches"), stores: quota("stores") };
}

export function useSearchQuota(user: User) {
  const max = entitlement(user, "leads").searches;
  if (!Number.isFinite(max)) return;
  const period = new Date().toISOString().slice(0,7);
  const usage = one<{ count: number }>("SELECT count FROM quota_usage WHERE user_id=? AND feature='searches' AND period=?", user.id, period);
  if ((usage?.count ?? 0) >= max) throw new UserError("Квота поисков за календарный месяц исчерпана.");
  run("INSERT INTO quota_usage VALUES (?,'searches',?,1) ON CONFLICT DO UPDATE SET count=count+1", user.id, period);
}
