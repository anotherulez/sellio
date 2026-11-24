import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(scrypt);
export const randomToken = () => randomBytes(32).toString("base64url");
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export async function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const key = await derive(password, salt, 64) as Buffer;
  return salt + ":" + key.toString("hex");
}

export const matches = (left: string, right: string) => timingSafeEqual(Buffer.from(digest(left), "hex"), Buffer.from(digest(right), "hex"));

function encryptionKey() {
  const key = Buffer.from(process.env.SELLIO_ENCRYPTION_KEY || "", "base64");
  if (key.length !== 32) throw new Error("SELLIO_ENCRYPTION_KEY must contain 32 base64-encoded bytes");
  return key;
}

export function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

export function decrypt(value: string) {
  const data = Buffer.from(value, "base64");
  const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), data.subarray(0, 12));
  cipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString("utf8");
}
