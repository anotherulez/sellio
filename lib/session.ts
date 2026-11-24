import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { userForToken } from "./accounts";

export const sessionCookie = "sellio_session";

export async function currentUser() {
  const token = (await cookies()).get(sessionCookie)?.value;
  return token ? userForToken(token, "session") : undefined;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user?.verified) redirect("/login");
  return user;
}
