"use client";

import { useEffect, useState } from "react";
import { SiteLink as Link } from "./site-link";
import { Plus } from "lucide-react";

export function Reveal() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.animate([{ opacity: .6, transform: "translateY(13px)" }, { opacity: 1, transform: "translateY(0)" }],
          { duration: 650, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
        observer.unobserve(entry.target);
      }
    }, { threshold: .13 });
    document.querySelectorAll("[data-reveal]").forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
  return null;
}

const questions = [
  ["Что такое Sellio?", "Sellio объединяет поиск компаний и проверку их сайтов с управлением магазинами цифровых товаров."],
  ["В каких странах можно искать компании?", "В России поиск предусмотрен через Яндекс Карты и 2ГИС, в США — через Google Maps. Доступность зависит от настроек источника и разрешений на использование его данных."],
  ["Что означает «Сайт не указан»?", "В карточке источника нет адреса сайта либо источник не передал это поле. У компании при этом может быть сайт."],
  ["Как узнать, что умеет конкретная интеграция?", "Откройте раздел «Магазины» в кабинете. Доступные действия зависят от площадки, выданных разрешений и настроек подключения."],
  ["Можно ли уже оплатить тариф?", "Цены и предполагаемый период указаны для ознакомления. Продажи начнутся после согласования условий подписки и подключения платёжного провайдера."],
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return <div className="faq-list">{questions.map(([question, answer], i) => <div className="faq-row" key={question}>
    <button type="button" aria-expanded={open === i} aria-controls={`faq-${i}`} onClick={() => setOpen(open === i ? null : i)}>{question}<Plus size={21}/></button>
    <p id={`faq-${i}`} hidden={open !== i}>{answer}</p>
  </div>)}</div>;
}

export function MobileMenu({ preview = false }: { preview?: boolean }) {
  const [open, setOpen] = useState(false);
  return <details className="mobile-menu" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>Меню</summary><div>
      <a href="#products" onClick={() => setOpen(false)}>Возможности</a>
      <a href="#pricing" onClick={() => setOpen(false)}>Тарифы</a>
      <a href="#faq" onClick={() => setOpen(false)}>FAQ</a>
      <Link href={preview ? "/demo" : "/login"}>{preview ? "Демо" : "Войти"}</Link>
    </div>
  </details>;
}
