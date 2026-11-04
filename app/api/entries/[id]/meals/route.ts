import { checkOrigin, currentUser, requireAuth } from "@/lib/auth";
import { getEntry } from "@/lib/db";
import { readMeals, writeMeal } from "@/lib/meal-service";
import { apiError, validId } from "@/lib/http";
import { AppError } from "@/lib/validation";
import { NO_STORE } from "@/lib/request-utils";
import { limitRequests } from "@/lib/rate-limit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, ctx: Context) {
  try {
    const { id } = await ctx.params;
    validId(id);
    const user = await currentUser(),
      entry = await getEntry(id, user?.id || null);
    if (!entry) throw new AppError("记录不存在或未公开", 404);
    const params = new URL(request.url).searchParams;
    let before: undefined | { date: string; created: string; id: string };
    if (params.has("before")) {
      try {
        before = JSON.parse(params.get("before")!);
        if (
          !before ||
          !/^\d{4}-\d{2}-\d{2}$/.test(before.date) ||
          !/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(before.created) ||
          typeof before.id !== "string"
        )
          throw new Error();
        validId(before.id);
      } catch {
        throw new AppError("分页参数不正确");
      }
    }
    return Response.json(await readMeals(entry, before), { headers: NO_STORE });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request, ctx: Context) {
  try {
    checkOrigin(request);
    const user = await requireAuth(),
      { id } = await ctx.params;
    validId(id);
    const entry = await getEntry(id, user.id, true);
    if (!entry) throw new AppError("记录不存在或不属于你", 404);
    await limitRequests(`meals:${user.id}`, 60);
    return Response.json(
      { record: await writeMeal(request, entry) },
      { status: 201, headers: NO_STORE },
    );
  } catch (e) {
    return apiError(e);
  }
}
