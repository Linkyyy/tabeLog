import { checkOrigin, requireAuth } from "@/lib/auth";
import { getEntry, query } from "@/lib/db";
import { apiError, validId } from "@/lib/http";
import { AppError } from "@/lib/validation";
import { removePhoto } from "@/lib/storage";
import type { MealRecord } from "@/lib/types";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; mealId: string }> };
export async function DELETE(request: Request, ctx: Context) {
  try {
    checkOrigin(request);
    const user = await requireAuth(),
      { id, mealId } = await ctx.params;
    validId(id);
    validId(mealId);
    if (!(await getEntry(id, user.id, true)))
      throw new AppError("记录不存在或不属于你", 404);
    const rows = await query<{ data: string }>(
      "DELETE FROM meal_records WHERE entry_id=? AND id=? RETURNING data",
      [id, mealId],
    );
    if (!rows.length) throw new AppError("这次用餐记录不存在", 404);
    const record = JSON.parse(rows[0].data) as MealRecord;
    await Promise.all(record.photos.map((p) => removePhoto(p.id)));
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
