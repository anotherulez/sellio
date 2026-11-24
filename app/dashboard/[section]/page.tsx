import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { navigation } from "@/components/workspace-shell";
import { LeadsSearch, ResultsPage, SavedLeads, type Query } from "@/components/leads-pages";
import { AnalyticsPage, LotsPage, MessagesPage, OrdersPage, PricePage, StockPage, StoresPage, TelegramPage } from "@/components/sales-pages";
import { BillingPage, SettingsPage } from "@/components/settings-pages";

type Props={params:Promise<{section:string}>;searchParams:Promise<Query>};

export async function generateMetadata({params}:Props) {
  const {section}=await params;
  const item=navigation.map((group)=>group.items.find(([route])=>route===section)).find(Boolean);
  return {title:item?.[1]??"Кабинет"};
}

export default async function Section({params,searchParams}:Props) {
  const [user,{section},query]=await Promise.all([requireUser(),params,searchParams]);
  const id=user.id;
  switch(section) {
    case "search":return <LeadsSearch user={id} query={query}/>;
    case "results":return <ResultsPage user={id} query={query}/>;
    case "leads":return <SavedLeads user={id} query={query}/>;
    case "stores":return <StoresPage user={id}/>;
    case "lots":return <LotsPage user={id}/>;
    case "orders":return <OrdersPage user={id}/>;
    case "stock":return <StockPage user={id}/>;
    case "messages":return <MessagesPage user={id}/>;
    case "prices":return <PricePage user={id}/>;
    case "analytics":return <AnalyticsPage user={id}/>;
    case "telegram":return <TelegramPage user={id}/>;
    case "billing":return <BillingPage user={user}/>;
    case "settings":return <SettingsPage user={user}/>;
    default:notFound();
  }
}
