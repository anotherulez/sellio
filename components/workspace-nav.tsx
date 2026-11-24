"use client";

import { Children, cloneElement, isValidElement, useState, type ReactNode, type ReactElement } from "react";
import { usePathname } from "next/navigation";

function activeLinks(children: ReactNode, pathname: string): ReactNode {
  return Children.map(children,(child)=>{
    if (!isValidElement(child)) return child;
    const node=child as ReactElement<{href?:string;children?:ReactNode;"aria-current"?: "page"}>;
    if (node.props.href) return cloneElement(node,{"aria-current":node.props.href===pathname ? "page" : undefined});
    return node.props.children ? cloneElement(node,{},activeLinks(node.props.children,pathname)) : node;
  });
}

export function WorkspaceNav({children}:{children:ReactNode}) {
  const path=usePathname() ?? "/";
  const [active,setActive]=useState("");
  const open=active===path;
  return <div className="workspace-nav"><button type="button" aria-expanded={open} aria-controls="workspace-links" onClick={()=>setActive(open?"":path)}>Разделы кабинета</button>
    <nav id="workspace-links" data-open={open} aria-label="Разделы кабинета">{activeLinks(children,path)}</nav></div>;
}
