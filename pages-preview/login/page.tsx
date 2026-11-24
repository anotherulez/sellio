import { ArrowUpRight } from "lucide-react";
import { Brand } from "@/components/brand";
import { SiteLink } from "@/components/site-link";
import { cabinetOrigin } from "@/lib/public-app";

export const metadata = {title:"Вход"};

export default function Entry() {
  const origin = cabinetOrigin();
  const local = process.env.SELLIO_PAGES_LOCAL_CABINET === "true";
  return <main className="simple-page wrap"><Brand/><article>
    <h1>Вход в Sellio</h1>
    {origin ? <><p>Кабинет работает на отдельном сервере.</p><a className="action primary export-action" href={origin+"/login"}>Перейти ко входу <ArrowUpRight size={17}/></a></> :
      local ? <><p>Кабинет запускается на компьютере владельца. Откройте вход на том же компьютере.</p>
        <a className="action primary export-action" href="http://127.0.0.1:3050/login">Войти на этом компьютере <ArrowUpRight size={17}/></a></> :
        <><p>Сервер кабинета пока не подключён.</p><SiteLink className="text-action" href="/">На главную</SiteLink></>}
  </article></main>;
}
