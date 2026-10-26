import {
  authenticated,
  checkOrigin,
  throttleLogin,
  passwordMatches,
  setSession,
  clearSession,
} from "@/lib/auth";
import { apiError } from "@/lib/http";
import { localMode } from "@/lib/config";
import { AppError } from "@/lib/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return Response.json(
      {
        authenticated: await authenticated(),
        local: localMode,
        passwordEnabled: !!process.env.DIARY_PASSWORD,
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
    await authenticated();
    await throttleLogin(request);
    const { password } = await request.json();
    if (
      typeof password !== "string" ||
      password.length > 256 ||
      !process.env.DIARY_PASSWORD ||
      !passwordMatches(password)
    )
      throw new AppError("密码不正确，请再试一次", 401);
    await setSession();
    return Response.json({ ok: true });
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
