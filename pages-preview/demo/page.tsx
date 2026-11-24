import { SiteLink as Link } from "@/components/site-link";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/brand";
import { Overview } from "@/components/overview";

export const metadata = { title: "Демо кабинета" };

export default function Demo() {
  return <main className="auth-page"><header className="wrap"><Brand/></header>
    <div className="wrap section" style={{ maxWidth: 1020 }}>
      <div className="workspace-inner">
        <div className="workspace-head"><div><h1>Демо кабинета</h1><p>На GitHub Pages доступен обзор интерфейса Sellio.</p></div>
          <Link href="/" className="action"><ArrowLeft size={17}/> На главную</Link></div>
        <Overview/>
        <section className="panel" id="leads"><div className="panel-head"><div><h3>Поиск компаний</h3><p>В рабочем кабинете можно выбрать город, категорию и источник, запустить поиск и сохранить подходящие результаты.</p></div></div></section>
        <section className="panel" id="automation"><div className="panel-head"><div><h3>Управление продажами</h3><p>После подключения магазина обзор показывает данные из заказов, а разделы кабинета помогают работать с лотами и складом.</p></div></div></section>
      </div>
    </div>
  </main>;
}
