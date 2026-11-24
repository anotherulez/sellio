export const plans = [
  { id: "start", name: "Старт", price: 499, description: "Для первых поисков и одного магазина.", limits: { searches: 25, stores: 1 }, features: ["leads", "stores"] },
  { id: "growth", name: "Рабочий", price: 799, description: "До 100 поисков в месяц и до трёх магазинов.", limits: { searches: 100, stores: 3 }, features: ["leads", "stores", "automation"] },
  { id: "pro", name: "Про", price: 999, description: "Для работы с большим объёмом.", limits: { searches: 300, stores: 10 }, features: ["leads", "stores", "automation"] },
] as const;
export type PlanId = typeof plans[number]["id"];
export const planById = (id: string) => plans.find((plan) => plan.id === id);
export const rubles = (amount: number) => new Intl.NumberFormat("ru-RU").format(amount) + " ₽";
