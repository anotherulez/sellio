export function cabinetOrigin(value = process.env.NEXT_PUBLIC_SELLIO_APP_ORIGIN) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password && url.pathname === "/" &&
        !url.search && !url.hash && url.hostname.includes(".") && !url.hostname.endsWith(".localhost")) return url.origin;
  } catch {}
  throw new Error("NEXT_PUBLIC_SELLIO_APP_ORIGIN requires an HTTPS origin");
}
