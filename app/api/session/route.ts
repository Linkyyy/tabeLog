import { randomUUID } from "node:crypto";
import {
  currentUser,
  checkOrigin,
  throttleLogin,
  setSession,
  clearSession,
} from "@/lib/auth";
import { parseCredentials, hashPassword, verifyPassword } from "@/lib/accounts";
import { query } from "@/lib/db";
import { apiError } from "@/lib/http";
import { localMode, assertConfig } from "@/lib/config";
import { AppError } from "@/lib/validation";
import type { User } from "@/lib/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const user = await currentUser();
    return Response.json(
      {
        user,
        authenticated: !!user,
        local: localMode,
        registrationOpen: process.env.REGISTRATION_OPEN !== "false",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    assertConfig();
    await throttleLogin(request);
    const raw = await request.json().catch(() => {
      throw new AppError("账户信息格式不正确");
    });
    if (
      !raw ||
      typeof raw !== "object" ||
      !["register", "login"].includes(raw.action)
    )
      throw new AppError("请选择登录或注册");
    const register = raw.action === "register";
    const { name, email, password } = parseCredentials(raw, register);
    let user: User;
    if (register) {
      if (process.env.REGISTRATION_OPEN === "false")
        throw new AppError("当前暂未开放注册", 403);
      const id = randomUUID(),
        hash = await hashPassword(password);
      const inserted = await query<{ id: string }>(
        "INSERT INTO users (id,email,name,password_hash,created_at) VALUES (?,?,?,?,?) ON CONFLICT(email) DO NOTHING RETURNING id",
        [id, email, name, hash, new Date().toISOString()],
      );
      if (!inserted.length)
        throw new AppError("此邮箱已经注册，请直接登录", 409);
      user = { id, name, email };
    } else {
      const rows = await query<User & { password_hash: string }>(
        "SELECT id,email,name,password_hash FROM users WHERE email=?",
        [email],
      );
      // Always perform an expensive derivation, including for unknown accounts.
      const hash =
        rows[0]?.password_hash ||
        "scrypt:00000000000000000000000000000000:" + "0".repeat(128);
      const matches = await verifyPassword(password, hash);
      if (!rows[0] || !matches) throw new AppError("邮箱或密码不正确", 401);
      const { password_hash: _, ...safe } = rows[0];
      user = safe;
    }
    await setSession(user.id);
    return Response.json(
      { user },
      {
        status: register ? 201 : 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    await clearSession();
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
