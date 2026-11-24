"use client";

import { useActionState, type ReactNode } from "react";
import { workspaceAction, revealStock } from "@/app/workspace-actions";

export function WorkspaceForm({ name, children, className = "", id }: { name:string;children:ReactNode;className?:string;id?:string }) {
  const [state,action,pending]=useActionState(name==="reveal-stock" ? revealStock : workspaceAction,{});
  return <form action={action} className={className}>
    <input type="hidden" name="operation" value={name}/>
    {id && <input type="hidden" name="id" value={id}/>}
    <fieldset disabled={pending} className="form-fields">{children}</fieldset>
    {state.error && <p className="notice error" role="alert">{state.error}</p>}
    {state.success && <p className={"notice"+(name==="reveal-stock" ? " revealed-secret" : "")} role="status">{state.success}</p>}
    {pending && <p className="working" role="status">Выполняется…</p>}
  </form>;
}
