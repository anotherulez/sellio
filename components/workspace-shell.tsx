import Link from "next/link";
import { Bell, ChartNoAxesColumnIncreasing, CreditCard, FileSearch, LayoutGrid, ListFilter, LogOut, MessagesSquare, Package, Search, Settings, ShieldCheck, ShoppingBag, Store, Tags, TrendingUp } from "lucide-react";
import type { User } from "@/lib/accounts";
import { logOut } from "@/app/account-actions";
import { Brand } from "./brand";
import { WorkspaceNav } from "./workspace-nav";

export const navigation = [
  { title:"Кабинет", items:[["","Обзор",LayoutGrid]] },
  { title:"Компании", items:[["search","Поиск компаний",Search],["results","Результаты",FileSearch],["leads","Сохранённые лиды",ListFilter]] },
  { title:"Продажи", items:[["stores","Магазины",Store],["lots","Лоты",Tags],["orders","Заказы",ShoppingBag],["stock","Склад и выдача",Package],["messages","Сообщения",MessagesSquare],["prices","Ценовые правила",TrendingUp],["analytics","Аналитика",ChartNoAxesColumnIncreasing]] },
  { title:"Аккаунт", items:[["telegram","Уведомления",Bell],["billing","Подписка",CreditCard],["settings","Настройки",Settings]] },
] as const;

export function WorkspaceShell({ user, children }: {user:User;children:React.ReactNode}) {
  return <div className="workspace">
    <aside className="sidebar"><Brand href="/dashboard"/><WorkspaceNav>
      {navigation.map((group)=><div key={group.title} className="nav-group">
        <span>{group.title}</span>
        {group.items.map(([route,label,Icon])=><Link key={route} href={route ? "/dashboard/"+route : "/dashboard"}><Icon size={17}/>{label}</Link>)}
      </div>)}
      {user.role!=="user" && <div className="nav-group"><Link href="/admin"><ShieldCheck size={17}/>Администрация</Link></div>}
    </WorkspaceNav><form className="logout" action={logOut}><button type="submit"><LogOut size={16}/> Выйти</button></form></aside>
    <main className="workspace-main"><div className="workspace-inner">{children}</div></main>
  </div>;
}

export function PageHeader({ title, body, children }: {title:string;body:string;children?:React.ReactNode}) {
  return <header className="workspace-head"><div><h1>{title}</h1><p>{body}</p></div>{children}</header>;
}

export function Empty({ title, body, href, label }: {title:string;body:string;href?:string;label?:string}) {
  return <div className="empty-box"><span aria-hidden="true"><Package size={22}/></span><h3>{title}</h3><p>{body}</p>{href && <Link href={href} className="action primary">{label}</Link>}</div>;
}
