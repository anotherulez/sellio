import nodemailer from "nodemailer";
import { UserError } from "./db";

function appUrl() {
  const url = new URL(process.env.APP_URL || "http://localhost:3000");
  if (url.protocol !== "https:" && !["localhost","127.0.0.1"].includes(url.hostname)) throw new Error("APP_URL requires HTTPS");
  return url;
}

export const mailReady = () => Boolean(process.env.SMTP_URL && process.env.MAIL_FROM) ||
  (process.env.NODE_ENV !== "production" && process.env.SELLIO_DEV_MAIL === "console");

export async function sendAccountMail(email: string, token: string, kind: "confirm" | "reset") {
  if (!mailReady()) throw new UserError("Отправка писем пока недоступна. Попробуйте позже.");
  const url = new URL(kind === "confirm" ? "/confirm" : "/reset", appUrl());
  url.searchParams.set("token", token);
  const subject = kind === "confirm" ? "Подтверждение почты Sellio" : "Восстановление доступа к Sellio";
  if (process.env.SMTP_URL && process.env.MAIL_FROM) {
    await nodemailer.createTransport(process.env.SMTP_URL).sendMail({
      from: process.env.MAIL_FROM, to: email, subject,
      text: `${subject}\n\n${url}\n\nЕсли вы не отправляли запрос, просто проигнорируйте письмо.`,
    });
    return;
  }
  if (!["localhost","127.0.0.1"].includes(url.hostname)) throw new Error("Console mail only supports localhost");
  console.info(`[Sellio local mail] ${subject} ${url}`);
}
