import "server-only";
import { AppError } from "./validation";
export const localMode =
  process.env.STORAGE_MODE === "local" ||
  (!process.env.VERCEL &&
    process.env.NODE_ENV !== "production" &&
    !process.env.CLOUDFLARE_D1_DATABASE_ID);
export function assertConfig() {
  if (process.env.VERCEL && localMode)
    throw new AppError("Vercel 部署必须使用 Cloudflare 存储", 503);
  if (localMode) return;
  const required = [
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_D1_DATABASE_ID",
    "CLOUDFLARE_API_TOKEN",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "SESSION_SECRET",
  ];
  if (
    required.some((k) => !process.env[k]) ||
    (process.env.SESSION_SECRET?.length ?? 0) < 32
  )
    throw new AppError(
      "云端尚未配置完成，请按 README 设置 Cloudflare 存储和登录密钥。",
      503,
    );
}
