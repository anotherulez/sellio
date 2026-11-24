import { SiteLink as Link } from "@/components/site-link";
import { ArrowDown, ArrowRight, ArrowUpRight, BarChart3, Check, Globe2, MapPin, Search, Store, Workflow } from "lucide-react";
import { Brand } from "@/components/brand";
import { ProductPreview } from "@/components/overview";
import { Faq, MobileMenu, Reveal } from "@/components/landing-interactions";
import { plans, rubles } from "@/lib/plans";
import { cabinetOrigin } from "@/lib/public-app";

const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
const previewOnly = process.env.SELLIO_STATIC_PAGES === "true";
const origin = previewOnly ? cabinetOrigin() : "";
const entry = previewOnly ? "/login" : "/register";
const entryLabel = previewOnly ? "Войти" : "Создать аккаунт";

export default function Landing() {
  return <main className="landing">
    <div className="dark-stage">
      <header className="site-header wrap">
        <Brand/>
        <nav aria-label="Основная навигация"><a href="#products">Возможности</a><a href="#pricing">Тарифы</a><a href="#faq">FAQ</a></nav>
        <div className="header-actions"><Link href="/login" className="sign-in">Войти <ArrowUpRight size={16}/></Link><MobileMenu/></div>
      </header>
      <section className="hero wrap" aria-labelledby="hero-heading">
        <div className="hero-copy">
          <h1 id="hero-heading"><span>Поиск компаний</span><span className="hero-muted">и учёт продаж</span></h1>
          <p>Проверяйте сайты компаний из карт. Сверяйте заказы и выручку магазинов GGSEL и Plati Market.</p>
          <div className="hero-actions">{origin ? <a className="round-cta light" href={origin+"/login"}>Войти в кабинет <span><ArrowUpRight size={19}/></span></a> : <Link className="round-cta light" href={entry}>{entryLabel} <span><ArrowUpRight size={19}/></span></Link>}<a href="#products" className="quiet-link">Возможности <ArrowDown size={16}/></a></div>
        </div>
        <div className="hero-visual"><ProductPreview/></div>
      </section>
    </div>
    <section className="section wrap" id="products">
      <div className="section-head" data-reveal><h2>Компании и продажи</h2></div>
      <div className="product-cards">
        <article className="feature-card lead-card" data-reveal>
          <div className="feature-top"><span className="feature-icon"><Search size={23}/></span><Link href={previewOnly ? "/login" : "/dashboard/search"} aria-label="Открыть поиск компаний" className="feature-link"><ArrowUpRight size={22}/></Link></div>
          <h3>Поиск по картам</h3><p>Выберите город и категорию. Sellio покажет карточки компаний и проверит, открываются ли указанные сайты.</p>
          <div className="product-detail"><div><Search size={16}/><span>Категория или ключевое слово</span></div><div><MapPin size={16}/><span>Город и источник</span></div><div><Globe2 size={16}/><span>Статус сайта и причина оценки</span></div></div>
        </article>
        <article className="feature-card automation-card" data-reveal>
          <div className="feature-top"><span className="feature-icon"><Store size={23}/></span><Link href={previewOnly ? "/login" : "/dashboard/stores"} aria-label="Открыть магазины" className="feature-link"><ArrowUpRight size={22}/></Link></div>
          <h3>Заказы из магазинов</h3><p>Подключите GGSEL или Plati Market через Digiseller. Выручка рассчитывается по оплаченным заказам.</p>
          <div className="product-detail"><div><Store size={16}/><span>Лоты и заказы</span></div><div><Workflow size={16}/><span>Уведомления в Telegram</span></div><div><BarChart3 size={16}/><span>Рубли, комиссии и себестоимость</span></div></div>
        </article>
      </div>
    </section>
    <section className="pricing-section" id="pricing"><div className="section wrap">
      <div className="section-head" data-reveal><h2>Тарифы</h2><p>Цены за месяц. Оплата пока закрыта.</p></div>
      <div className="pricing-grid">{plans.map((plan) => <article key={plan.id} className="price-card" data-reveal>
        <h3>{plan.name}</h3><div className="price">{rubles(plan.price)} <span>/ месяц</span></div>
        <ul><li><Check size={17}/> {plan.limits.searches} поисков в месяц</li><li><Check size={17}/> {plan.limits.stores === 1 ? "1 магазин" : `До ${plan.limits.stores} магазинов`}</li>{plan.features.some((f) => f === "automation") && <li><Check size={17}/> Склад и уведомления</li>}</ul>
        <Link href={entry} className="price-link">{entryLabel} <ArrowRight size={18}/></Link>
      </article>)}</div>
    </div></section>
    <section className="section wrap faq-section" id="faq"><div data-reveal><h2>Вопросы</h2></div><Faq/></section>
    <footer className="site-footer" id="contact"><div className="wrap">
      <div className="footer-bottom"><Brand/><div>{contact && <a href={`mailto:${contact}`}>Написать нам</a>}<Link href="/contact">Контакты</Link><Link href="/privacy">Конфиденциальность</Link></div><span>© {new Date().getFullYear()} Sellio</span></div>
    </div></footer><Reveal/>
  </main>;
}
