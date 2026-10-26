import { requireAuth, checkOrigin } from "@/lib/auth";
import { getEntry, deleteEntry } from "@/lib/db";
import { apiError, validId } from "@/lib/http";
import { writeEntry } from "@/lib/entry-service";
import { removePhoto } from "@/lib/storage";
import { AppError } from "@/lib/validation";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, ctx: Context) {
  try {
    checkOrigin(request);
    await requireAuth();
    const { id } = await ctx.params;
    validId(id);
    return Response.json({ entry: await writeEntry(request, id) });
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(request: Request, ctx: Context) {
  try {
    checkOrigin(request);
    await requireAuth();
    const { id } = await ctx.params;
    validId(id);
    const old = await getEntry(id);
    if (!old) throw new AppError("这篇日记不存在", 404);
    await deleteEntry(id);
    await Promise.all(old.photos.map((p) => removePhoto(p.id)));
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
