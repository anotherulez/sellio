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
  ["По каким картам можно искать?", "В России — по Яндекс Картам и 2ГИС, в США — по Google Maps. Для поиска нужен подключённый источник."],
  ["Что означает «Сайт не указан»?", "В карточке источника нет адреса сайта либо источник не передал это поле. У компании при этом может быть сайт."],
  ["Откуда берутся суммы в кабинете?", "Sellio берёт суммы оплаченных заказов из Digiseller. Прибыль появится после того, как будут известны комиссии и себестоимость."],
  ["Можно ли уже оплатить тариф?", "Оплата пока недоступна. На сайте указаны предварительные цены."],
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return <div className="faq-list">{questions.map(([question, answer], i) => <div className="faq-row" key={question}>
    <button type="button" aria-expanded={open === i} aria-controls={`faq-${i}`} onClick={() => setOpen(open === i ? null : i)}>{question}<Plus size={21}/></button>
    <div className="faq-answer" id={`faq-${i}`} aria-hidden={open !== i} data-open={open === i}><div><p>{answer}</p></div></div>
  </div>)}</div>;
}

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  return <details className="mobile-menu" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>Меню</summary><div>
      <a href="#products" onClick={() => setOpen(false)}>Возможности</a>
      <a href="#pricing" onClick={() => setOpen(false)}>Тарифы</a>
      <a href="#faq" onClick={() => setOpen(false)}>FAQ</a>
      <Link href="/login">Войти</Link>
    </div>
  </details>;
}
