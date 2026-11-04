import "server-only";
import { createHmac } from "node:crypto";
import { serverSecret } from "./auth";
import { query } from "./db";
import { AppError } from "./validation";
export async function limitRequests(
  key: string,
  max: number,
  window = 15 * 60000,
) {
  const now = Date.now();
  const id = createHmac("sha256", await serverSecret())
    .update(key)
    .digest("hex");
  await query("DELETE FROM request_limits WHERE expires<?", [now]);
  const rows = await query<{ attempts: number }>(
    "INSERT INTO request_limits(id,attempts,expires) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET attempts=attempts+1 RETURNING attempts",
    [id, now + window],
  );
  if (rows[0].attempts > max)
    throw new AppError("操作太频繁，请 15 分钟后再试", 429);
}
export function clientIP(request: Request) {
  return (
    request.headers
      .get(process.env.VERCEL ? "x-vercel-forwarded-for" : "x-forwarded-for")
      ?.split(",")[0]
      ?.trim() || "local"
  );
}
