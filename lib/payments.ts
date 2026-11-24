import { one, record, run, transaction, UserError } from "./db";
import { planById, type PlanId } from "./plans";
import { digest } from "./security";

export interface PaymentProvider {
  activate(input: { userId: string; plan: PlanId; requestId: string }): void;
}

const testProvider: PaymentProvider = {
  activate({userId,plan,requestId}) {
    const config = planById(plan);
    if (!config) throw new UserError("Тариф не найден.");
    const eventId = digest(userId+":"+requestId);
    transaction(() => {
      if (one("SELECT id FROM payment_events WHERE id=?",eventId)) return;
      run("INSERT INTO payment_events VALUES (?,?,?,0,'test',?)",eventId,userId,plan,Date.now());
      run(`INSERT INTO subscriptions VALUES (?,?,?,0) ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan,expires=excluded.expires,renew=0`,userId,plan,Date.now()+30*86_400_000);
      record(userId,"subscription.test_activated",plan);
    });
  },
};

export const paymentProvider = () => process.env.NODE_ENV !== "production" && process.env.SELLIO_PAYMENT_MODE === "test" ? testProvider : undefined;
