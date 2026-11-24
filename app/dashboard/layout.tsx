import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { WorkspaceShell } from "@/components/workspace-shell";

export const metadata:Metadata={robots:{index:false,follow:false}};

export default async function DashboardLayout({children}:{children:React.ReactNode}) {
  const user=await requireUser();
  return <WorkspaceShell user={user}>{children}</WorkspaceShell>;
}
