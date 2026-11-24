import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { AuthForm } from "@/components/auth-form";

const modes = ["login","register","forgot","resend","confirm","reset"] as const;

export default async function Info({ params, searchParams }: {
  params: Promise<{ info: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { info } = await params;
  const mode = modes.find((item) => item === info);
  if (mode) {
    const { token, verified, changed } = await searchParams;
    return <main className="auth-page"><header className="wrap"><Brand/></header>
      <AuthForm mode={mode} token={typeof token === "string" ? token : undefined}
        notice={mode === "login" ? verified === "1" ? "Email подтверждён. Теперь можно войти." : changed === "1" ? "Пароль обновлён." : undefined : undefined}/>
    </main>;
  }
  if (!["privacy", "contact"].includes(info)) notFound();
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return <main className="simple-page wrap"><Brand/><article>
    {info === "contact" ? <><h1>Контакты</h1>{email ? <p>По вопросам о Sellio пишите на <a className="underlined" href={`mailto:${email}`}>{email}</a>.</p> : <p>Адрес поддержки ещё не опубликован.</p>}</> :
      <><h1>Конфиденциальность</h1><p>Sellio использует адрес электронной почты для входа, подтверждения регистрации и восстановления доступа. Данные кабинета связаны с вашим аккаунтом.</p><p>Ключи интеграций и данные цифрового склада хранятся в зашифрованном виде. Доступ к данным источников и выгрузкам зависит от условий их использования.</p>{email && <p>Вопросы об обработке данных можно отправлять на <a className="underlined" href={`mailto:${email}`}>{email}</a>.</p>}</>}
  </article></main>;
}
