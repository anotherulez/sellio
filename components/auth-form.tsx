"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { accountAction } from "@/app/account-actions";

export const authModes = {
  register: { title: "Создайте аккаунт", text: "Откройте рабочий кабинет Sellio.", action: "Зарегистрироваться" },
  login: { title: "Вход в Sellio", text: "Войдите, чтобы открыть свой кабинет.", action: "Войти" },
  forgot: { title: "Восстановление доступа", text: "Отправим ссылку для смены пароля на вашу почту.", action: "Отправить ссылку" },
  resend: { title: "Подтверждение почты", text: "Запросите новое письмо для подтверждения адреса.", action: "Отправить письмо" },
  confirm: { title: "Подтвердите email", text: "Подтвердите адрес, чтобы завершить регистрацию.", action: "Подтвердить email" },
  reset: { title: "Новый пароль", text: "Используйте не менее 12 символов.", action: "Сохранить пароль" },
};
type Mode = keyof typeof authModes;

export function AuthForm({ mode, token, notice }: { mode: Mode; token?: string; notice?: string }) {
  const [state, action, pending] = useActionState(accountAction.bind(null, mode), {});
  const config = authModes[mode];
  const tokenMode = mode === "confirm" || mode === "reset";
  return <article className="auth-card">
    <h1>{config.title}</h1><p>{config.text}</p>
    {notice && <p className="notice" role="status">{notice}</p>}
    <form action={action} className="form-stack">
      {state.error && <p className="notice error" role="alert">{state.error}</p>}
      {state.success && <p className="notice" role="status">{state.success}</p>}
      {tokenMode ? <input type="hidden" name="token" value={token || ""}/> :
        <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="mail@example.com"/></label>}
      {["login","register","reset"].includes(mode) && <label>Пароль<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "login" ? undefined : 12} maxLength={128} required aria-describedby={mode === "register" ? "password-length" : undefined}/>{mode === "register" && <small id="password-length">Минимум 12 символов</small>}</label>}
      <button className="action primary" type="submit" disabled={pending}>{pending ? "Подождите…" : config.action} <ArrowUpRight size={17}/></button>
    </form>
    <div className="auth-links">{mode === "login" ? <><Link href="/register">Создать аккаунт</Link><Link href="/forgot">Забыли пароль?</Link><Link href="/resend">Запросить письмо</Link></> : <Link href="/login">Вернуться ко входу</Link>}</div>
  </article>;
}
