"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authenticate, deleteToken, issueToken, registerUser, useAccountToken, userByEmail } from "@/lib/accounts";
import { limit, UserError } from "@/lib/db";
import { mailReady, sendAccountMail } from "@/lib/mail";
import { sessionCookie } from "@/lib/session";
import { digest } from "@/lib/security";

const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());
const passwordSchema = z.string().min(12).max(128);
const tokenSchema = z.string().regex(/^[\w-]{43}$/);

export type FormState = { error?: string; success?: string };

export async function accountAction(mode: string, _previous: FormState, data: FormData): Promise<FormState> {
  let destination: string | undefined;
  try {
    if (mode === "login" || mode === "register" || mode === "forgot" || mode === "resend") {
      const email = emailSchema.safeParse(data.get("email"));
      if (!email.success) return { error: "Введите корректный email." };
      limit("account:global:" + mode, 250);
      limit("account:" + mode + ":" + digest(email.data), mode === "login" ? 8 : 4);
      if (mode === "login") {
        const password = z.string().min(1).max(128).safeParse(data.get("password"));
        if (!password.success) return { error: "Введите пароль." };
        const id = await authenticate(email.data, password.data);
        const jar = await cookies();
        jar.set(sessionCookie, issueToken(id, "session"), {
          path: "/", httpOnly: true, sameSite: "lax", secure: process.env.APP_URL?.startsWith("https:") ?? process.env.NODE_ENV === "production", maxAge: 14 * 86_400,
        });
        destination = "/dashboard";
      } else {
        if (!mailReady()) throw new UserError("Отправка писем пока недоступна. Попробуйте позже.");
        let user = userByEmail(email.data);
        if (mode === "register") {
          const password = passwordSchema.safeParse(data.get("password"));
          if (!password.success) return { error: "Пароль должен содержать от 12 до 128 символов." };
          if (!user) {
            await registerUser(email.data, password.data);
            user = userByEmail(email.data);
          }
        }
        if (user && (mode === "forgot" ? user.verified : !user.verified)) {
          const kind = mode === "forgot" ? "reset" : "confirm";
          await sendAccountMail(user.email, issueToken(user.id, kind), kind);
        }
        return { success: "Если адрес подходит для этого действия, на него отправлена ссылка." };
      }
    } else if (mode === "confirm" || mode === "reset") {
      const token = tokenSchema.safeParse(data.get("token"));
      if (!token.success) throw new UserError("Ссылка недействительна.");
      limit("account:token:" + digest(token.data), 10);
      if (mode === "reset") {
        const password = passwordSchema.safeParse(data.get("password"));
        if (!password.success) return { error: "Пароль должен содержать от 12 до 128 символов." };
        await useAccountToken(token.data, "reset", password.data);
      } else await useAccountToken(token.data, "confirm");
      destination = "/login?" + (mode === "confirm" ? "verified=1" : "changed=1");
    } else return { error: "Действие недоступно." };
  } catch (error) {
    return { error: error instanceof UserError ? error.message : "Не удалось выполнить действие. Повторите позже." };
  }
  if (destination) redirect(destination);
  return {};
}

export async function logOut() {
  const jar = await cookies();
  const token = jar.get(sessionCookie)?.value;
  if (token) deleteToken(token, "session");
  jar.delete(sessionCookie);
  redirect("/");
}
