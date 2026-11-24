import { SiteLink as Link } from "./site-link";

export function Mark() {
  return <span className="mark" aria-hidden="true"><i/><i/><i/></span>;
}

export function Brand({ href = "/" }: { href?: string }) {
  return <Link className="brand" href={href} aria-label="Sellio — на главную"><Mark/> Sellio<span>.</span></Link>;
}
