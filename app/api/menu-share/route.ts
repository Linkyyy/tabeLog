import { checkOrigin, requireAuth } from "@/lib/auth";
import { ownerShare, saveShare } from "@/lib/menu-service";
import { query } from "@/lib/db";
import { apiError } from "@/lib/http";
import { NO_STORE, readJSON } from "@/lib/request-utils";
export const runtime = "nodejs";
export async function GET() {
  try {
    return Response.json(
      { share: await ownerShare((await requireAuth()).id) },
      { headers: NO_STORE },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function PUT(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireAuth();
    return Response.json(
      { share: await saveShare(user, await readJSON(request, 12000)) },
      { headers: NO_STORE },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireAuth();
    await query("UPDATE menu_shares SET enabled=0 WHERE owner_id=?", [user.id]);
    return Response.json({ ok: true }, { headers: NO_STORE });
  } catch (e) {
    return apiError(e);
  }
}
