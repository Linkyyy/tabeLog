import "server-only";
import {
  createHmac,
  timingSafeEqual,
  createHash,
  randomBytes,
} from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { localMode, assertConfig } from "./config";
import { AppError } from "./validation";
import { query } from "./db";
import type { User } from "./types";
const COOKIE = "tabelog_account";
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
let secretPromise: Promise<string> | undefined;
async function secret() {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32)
    return process.env.SESSION_SECRET;
  if (!localMode) throw new AppError("SESSION_SECRET 至少需要 32 个字符", 503);
  return (secretPromise ||= (async () => {
    const dir = process.env.LOCAL_DATA_DIR || path.join(process.cwd(), ".data");
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, "session-secret");
    try {
      await writeFile(file, randomBytes(32).toString("hex"), {
        flag: "wx",
        mode: 0o600,
      });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
    return readFile(file, "utf8");
  })());
}
async function sign(token: string) {
  return createHmac("sha256", await secret())
    .update(token)
    .digest("hex");
}
async function sessionToken() {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  const [token, signature, ...extra] = value.split(".");
  if (
    extra.length ||
    !token ||
    !signature ||
    !/^[a-f0-9]{64}$/.test(token) ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    return null;
  return timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(await sign(token), "hex"),
  )
    ? token
    : null;
}
export async function currentUser(): Promise<User | null> {
  assertConfig();
  const token = await sessionToken();
  if (!token) return null;
  const rows = await query<User>(
    "SELECT u.id,u.name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>?",
    [digest(token), Date.now()],
  );
  return rows[0] || null;
}
export async function requireAuth() {
  const user = await currentUser();
  if (!user) throw new AppError("请先登录你的账户", 401);
  return user;
}
export async function setSession(userId: string) {
  // Revoke an existing session before rotating the browser's cookie.
  const old = await sessionToken();
  if (old)
    await query("DELETE FROM sessions WHERE token_hash=?", [digest(old)]);
  const token = randomBytes(32).toString("hex");
  await query("DELETE FROM sessions WHERE expires<?", [Date.now()]);
  await query(
    "INSERT INTO sessions (token_hash,user_id,expires) VALUES (?,?,?)",
    [digest(token), userId, Date.now() + 7 * 86400000],
  );
  (await cookies()).set(COOKIE, `${token}.${await sign(token)}`, {
    httpOnly: true,
    secure: !localMode,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 86400,
  });
  // Drop the former shared-diary cookie; it grants no account access.
  (await cookies()).delete("tabelog_session");
}
export async function clearSession() {
  const token = await sessionToken();
  if (token)
    await query("DELETE FROM sessions WHERE token_hash=?", [digest(token)]);
  (await cookies()).delete(COOKIE);
}
export function checkOrigin(request: Request) {
  const target = new URL(request.url);
  if (
    request.headers.get("origin") !==
    `${target.protocol}//${request.headers.get("host") || target.host}`
  )
    throw new AppError("请求来源验证失败，请刷新页面后重试", 403);
}
export async function throttleLogin(request: Request) {
  const ip =
    request.headers
      .get(process.env.VERCEL ? "x-vercel-forwarded-for" : "x-forwarded-for")
      ?.split(",")[0]
      ?.trim() || "local";
  const id = createHmac("sha256", await secret())
      .update(ip)
      .digest("hex"),
    now = Date.now();
  await query("DELETE FROM login_attempts WHERE expires<?", [now]);
  const rows = await query<{ attempts: number }>(
    "INSERT INTO login_attempts (id,attempts,expires) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET attempts=attempts+1 RETURNING attempts",
    [id, now + 15 * 60000],
  );
  if (rows[0].attempts > 15)
    throw new AppError("尝试次数过多，请 15 分钟后再试", 429);
}
