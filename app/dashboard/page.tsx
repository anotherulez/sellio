import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { requireUser } from "@/lib/session";
import { overviewFor } from "@/lib/metrics";
import { Overview } from "@/components/overview";
import { PageHeader } from "@/components/workspace-shell";

export const metadata={title:"Обзор"};

export default async function Dashboard() {
  const user=await requireUser();
  const metrics=overviewFor(user.id);
  return <>
    <PageHeader title="Обзор" body="Продажи и новые лиды в вашем кабинете.">
      <Link href={metrics.connected?"/dashboard/analytics":"/dashboard/stores"} className="action primary">{metrics.connected?"Открыть аналитику":"Подключить магазин"} <ArrowUpRight size={18}/></Link>
    </PageHeader>
    <Overview metrics={metrics}/>
  </>;
}
