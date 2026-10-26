import { currentUser } from "@/lib/auth";
import { apiError, validId } from "@/lib/http";
import { canReadPhoto } from "@/lib/db";
import { AppError } from "@/lib/validation";
import { readPhoto } from "@/lib/storage";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await currentUser();
    const { id } = await ctx.params;
    validId(id);
    if (!(await canReadPhoto(id, user?.id || null)))
      throw new AppError("照片不存在或未公开", 404);
    const data = await readPhoto(id);
    return new Response(data as BodyInit, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      (("code" in e && e.code === "ENOENT") ||
        ("name" in e && e.name === "NoSuchKey"))
    )
      return Response.json({ error: "照片不存在" }, { status: 404 });
    return apiError(e);
  }
}
