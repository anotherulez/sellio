import Link from "next/link";
import type { ComponentProps } from "react";

export function SiteLink({ href, ...props }: ComponentProps<"a"> & {href:string}) {
  const base = process.env.NEXT_PUBLIC_SELLIO_PAGES_BASE;
  if (base === undefined) return <Link href={href} {...props}/>;
  const [path,hash] = href.split("#",2);
  return <a href={base + (path.endsWith("/") ? path : path + "/") + (hash ? "#" + hash : "")} {...props}/>;
}
