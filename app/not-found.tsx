import { SiteLink as Link } from "@/components/site-link";
import { Brand } from "@/components/brand";

export default function NotFound() {
  return <main className="simple-page wrap"><Brand/><article><h1>Страница не найдена</h1>
    <p>Проверьте адрес или вернитесь на главную.</p><Link href="/" className="text-action">На главную</Link>
  </article></main>;
}
