import { SiteLink as Link } from "@/components/site-link";
import { ArrowDown, ArrowRight, ArrowUpRight, BarChart3, Check, Globe2, MapPin, Search, Store, Workflow } from "lucide-react";
import { Brand } from "@/components/brand";
import { ProductPreview } from "@/components/overview";
import { Faq, MobileMenu, Reveal } from "@/components/landing-interactions";
import { plans, rubles } from "@/lib/plans";

const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
const previewOnly = process.env.SELLIO_STATIC_PAGES === "true";
const entry = previewOnly ? "/demo" : "/register";
const entryLabel = previewOnly ? "Открыть демо" : "Начать сейчас";

export default function Landing() {
  return <main className="landing">
    <div className="dark-stage">
      <header className="site-header wrap">
        <Brand/>
        <nav aria-label="Основная навигация"><a href="#products">Возможности</a><a href="#pricing">Тарифы</a><a href="#faq">FAQ</a></nav>
        <div className="header-actions"><Link href={previewOnly ? "/demo" : "/login"} className="sign-in">{previewOnly ? "Демо" : "Войти"} <ArrowUpRight size={16}/></Link><MobileMenu preview={previewOnly}/></div>
      </header>
      <section className="hero wrap" aria-labelledby="hero-heading">
        <div className="hero-copy">
          <h1 id="hero-heading"><span>Находите лиды.</span><span>Управляйте</span><span className="hero-muted">продажами.</span></h1>
          <p>Поиск компаний, проверка их сайтов и автоматизация продаж на маркетплейсах в одном кабинете.</p>
          <div className="hero-actions"><Link className="round-cta light" href={entry}>{entryLabel} <span><ArrowUpRight size={19}/></span></Link><a href="#products" className="quiet-link">Как это работает <ArrowDown size={16}/></a></div>
        </div>
        <div className="hero-visual"><div className="visual-grid"/><ProductPreview/><span className="preview-caption"><span/> Интерфейс Sellio</span></div>
      </section>
      <div className="source-strip wrap"><span>Два направления. Один кабинет.</span><div><span><MapPin size={17}/> Поиск компаний</span><span><Store size={17}/> Управление магазинами</span></div></div>
    </div>
    <section className="section wrap" id="products">
      <div className="section-head" data-reveal><h2>Что можно делать<br/> в Sellio</h2><p>Найдите компании, которым может пригодиться ваша работа. Или соберите продажи своих цифровых товаров в одном месте.</p></div>
      <div className="product-cards">
        <article className="feature-card lead-card" data-reveal>
          <div className="feature-top"><span className="feature-icon"><Search size={23}/></span><Link href={previewOnly ? "/demo#leads" : "/dashboard/search"} aria-label={previewOnly ? "Посмотреть демо поиска" : "Открыть поиск компаний"} className="feature-link"><ArrowUpRight size={22}/></Link></div>
          <h3>Sellio Leads</h3><p>Ищите компании по городу и категории. Сохраняйте подходящие контакты и проверяйте сайты.</p>
          <div className="product-detail"><div><Search size={16}/><span>Категория или ключевое слово</span></div><div><MapPin size={16}/><span>Город и источник</span></div><div><Globe2 size={16}/><span>Статус сайта и причина оценки</span></div></div>
        </article>
        <article className="feature-card automation-card" data-reveal>
          <div className="feature-top"><span className="feature-icon"><Workflow size={23}/></span><Link href={previewOnly ? "/demo#automation" : "/dashboard/stores"} aria-label={previewOnly ? "Посмотреть демо продаж" : "Открыть магазины"} className="feature-link"><ArrowUpRight size={22}/></Link></div>
          <h3>Sellio Automation</h3><p>Подключайте свои магазины. Работайте с заказами, лотами и уведомлениями по мере доступности интеграций.</p>
          <div className="product-detail"><div><Store size={16}/><span>Магазины и заказы</span></div><div><Workflow size={16}/><span>Правила автоматизации</span></div><div><BarChart3 size={16}/><span>Выручка и прибыль</span></div></div>
        </article>
      </div>
    </section>
    <section className="pricing-section" id="pricing"><div className="section wrap">
      <div className="section-head" data-reveal><h2>Тариф под ваш<br/> объём работы</h2><p>Предварительные цены за месяц. Возможности и лимиты будут уточнены перед запуском продаж.</p></div>
      <div className="pricing-grid">{plans.map((plan) => <article key={plan.id} className="price-card" data-reveal>
        <h3>{plan.name}</h3><p>{plan.description}</p><div className="price">{rubles(plan.price)} <span>/ месяц</span></div>
        <ul><li><Check size={17}/> Поиск и сохранение компаний</li><li><Check size={17}/> Управление магазинами</li>{plan.features.some((f) => f === "automation") && <li><Check size={17}/> Доступные автоматизации</li>}</ul>
        <Link href={entry} className="price-link">{entryLabel} <ArrowRight size={18}/></Link>
      </article>)}</div>
    </div></section>
    <section className="section wrap faq-section" id="faq"><div data-reveal><h2>Частые<br/> вопросы</h2><a href="#contact" className="text-action">Связаться с Sellio <ArrowUpRight size={17}/></a></div><Faq/></section>
    <footer className="site-footer" id="contact"><div className="wrap">
      <div className="footer-main"><div><h2>Начните с Sellio.</h2><p>{previewOnly ? "Посмотрите, как устроен рабочий кабинет." : contact ? "Есть вопросы о продукте или подключении?" : "Создайте аккаунт, чтобы открыть рабочий кабинет."}</p></div><Link href={entry} className="round-cta light">{entryLabel} <span><ArrowUpRight size={19}/></span></Link></div>
      <div className="footer-bottom"><Brand/><div>{contact && <a href={`mailto:${contact}`}>Написать нам</a>}<Link href="/contact">Контакты</Link><Link href="/privacy">Конфиденциальность</Link></div><span>© {new Date().getFullYear()} Sellio</span></div>
    </div></footer><Reveal/>
  </main>;
}
