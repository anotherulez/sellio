import { Brand } from "@/components/brand";

export const metadata = { title: "Конфиденциальность" };

export default function Privacy() {
  return <main className="simple-page wrap"><Brand/><article><h1>Конфиденциальность</h1>
    <p>Публичное демо на GitHub Pages показывает интерфейс Sellio. Оно не запрашивает данные аккаунта и не подключается к магазинам или картам.</p>
  </article></main>;
}
