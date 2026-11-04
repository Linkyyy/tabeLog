import { checkOrigin, requireAuth } from "@/lib/auth";
import { changeOrder } from "@/lib/menu-service";
import { apiError } from "@/lib/http";
import { NO_STORE, readJSON } from "@/lib/request-utils";
export const runtime = "nodejs";
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(request);
    const user = await requireAuth();
    const { id } = await ctx.params;
    const v = (await readJSON(request, 1000)) as { status?: unknown };
    await changeOrder(user.id, id, v?.status);
    return Response.json({ ok: true }, { headers: NO_STORE });
  } catch (e) {
    return apiError(e);
  }
}
