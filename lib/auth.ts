import "server-only";
import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { localMode, assertConfig } from "./config";
import { AppError } from "./validation";
import { query } from "./db";
const COOKIE = "tabelog_session";
const digest = (s: string) => createHash("sha256").update(s).digest();
export const passwordMatches = (password: string) =>
  timingSafeEqual(digest(password), digest(process.env.DIARY_PASSWORD || ""));
function signature(payload: string) {
  return createHmac("sha256", process.env.SESSION_SECRET!)
    .update(payload)
    .digest("base64url");
}
export async function authenticated() {
  assertConfig();
  if (localMode && !process.env.DIARY_PASSWORD) return true;
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
    throw new AppError("SESSION_SECRET 至少需要 32 个字符", 503);
  const cookie = (await cookies()).get(COOKIE)?.value;
  if (!cookie) return false;
  const [expiry, sig] = cookie.split(".");
  if (!expiry || !sig || !/^\d+$/.test(expiry) || Number(expiry) < Date.now())
    return false;
  return timingSafeEqual(digest(sig), digest(signature(expiry)));
}
export async function requireAuth() {
  if (!(await authenticated())) throw new AppError("请先登录你的美食日记", 401);
}
export async function setSession() {
  const expiry = String(Date.now() + 7 * 24 * 3600 * 1000);
  (await cookies()).set(COOKIE, `${expiry}.${signature(expiry)}`, {
    httpOnly: true,
    secure: !localMode,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 3600,
  });
}
export async function clearSession() {
  (await cookies()).delete(COOKIE);
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const target = new URL(request.url);
  const expected = `${target.protocol}//${request.headers.get("host") || target.host}`;
  if (origin !== expected)
    throw new AppError("请求来源验证失败，请刷新页面后重试", 403);
}
export async function throttleLogin(request: Request) {
  // Vercel supplies the real client address in x-vercel-forwarded-for.
  const ip =
    request.headers
      .get(process.env.VERCEL ? "x-vercel-forwarded-for" : "x-forwarded-for")
      ?.split(",")[0]
      ?.trim() || "local";
  const id = createHmac(
    "sha256",
    process.env.SESSION_SECRET || "local-rate-limit",
  )
    .update(ip)
    .digest("hex");
  const now = Date.now();
  await query("DELETE FROM login_attempts WHERE expires < ?", [now]);
  const rows = await query<{ attempts: number }>(
    "INSERT INTO login_attempts (id, attempts, expires) VALUES (?, 1, ?) ON CONFLICT(id) DO UPDATE SET attempts = attempts + 1 RETURNING attempts",
    [id, now + 15 * 60 * 1000],
  );
  if (rows[0].attempts > 15)
    throw new AppError("尝试次数过多，请 15 分钟后再试", 429);
}
