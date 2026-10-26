import { randomBytes, scrypt as derive, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { AppError } from "./validation";
const scrypt = promisify(derive);
export function parseCredentials(value: unknown, register = false) {
  if (!value || typeof value !== "object")
    throw new AppError("账户信息格式不正确");
  const v = value as Record<string, unknown>;
  const email = typeof v.email === "string" ? v.email.trim().toLowerCase() : "";
  const password = typeof v.password === "string" ? v.password : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new AppError("请输入有效的邮箱地址");
  if (password.length < 12 || password.length > 128)
    throw new AppError("密码需要 12–128 个字符");
  const name = typeof v.name === "string" ? v.name.trim() : "";
  if (register && (name.length < 2 || name.length > 30))
    throw new AppError("昵称需要 2–30 个字符");
  return { email, password, name };
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, hash] = encoded.split(":");
  if (algorithm !== "scrypt" || !salt || !hash || !/^[a-f0-9]{128}$/.test(hash))
    return false;
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return timingSafeEqual(key, Buffer.from(hash, "hex"));
}
