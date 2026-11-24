import { Brand } from "@/components/brand";

export const metadata = { title: "Контакты" };
const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

export default function Contact() {
  return <main className="simple-page wrap"><Brand/><article><h1>Контакты</h1>
    {email ? <p>Напишите на <a className="underlined" href={`mailto:${email}`}>{email}</a>.</p> : <p>Адрес поддержки ещё не опубликован.</p>}
  </article></main>;
}
