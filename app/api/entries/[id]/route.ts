import { requireAuth, currentUser, checkOrigin } from "@/lib/auth";
import { getEntry, deleteEntry, query } from "@/lib/db";
import { apiError, validId } from "@/lib/http";
import { writeEntry } from "@/lib/entry-service";
import { removePhoto } from "@/lib/storage";
import { AppError } from "@/lib/validation";
import type { Photo } from "@/lib/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, ctx: Context) {
  try {
    const user = await currentUser(),
      { id } = await ctx.params;
    validId(id);
    const entry = await getEntry(id, user?.id || null);
    if (!entry) throw new AppError("记录不存在或未公开", 404);
    return Response.json(
      { entry },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function PUT(request: Request, ctx: Context) {
  try {
    checkOrigin(request);
    const user = await requireAuth(),
      { id } = await ctx.params;
    validId(id);
    return Response.json({ entry: await writeEntry(request, user, id) });
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(request: Request, ctx: Context) {
  try {
    checkOrigin(request);
    const user = await requireAuth(),
      { id } = await ctx.params;
    validId(id);
    const old = await getEntry(id, user.id, true);
    if (!old) throw new AppError("记录不存在或不属于你", 404);
    const repeatPhotos = await query<{ id: string }>(
      "SELECT json_extract(p.value,'$.id') AS id FROM meal_records r,json_each(r.data,'$.photos') p WHERE r.entry_id=?",
      [id],
    );
    await deleteEntry(id, user.id, old.updatedAt);
    await Promise.all(
      [...old.photos, ...repeatPhotos].map((p: Pick<Photo, "id">) =>
        removePhoto(p.id),
      ),
    );
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
