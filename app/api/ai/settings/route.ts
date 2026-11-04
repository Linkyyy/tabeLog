import { checkOrigin, requireAuth } from "@/lib/auth";
import { aiSettings, saveAISettings } from "@/lib/ai-service";
import { query } from "@/lib/db";
import { apiError } from "@/lib/http";
import { NO_STORE, readJSON } from "@/lib/request-utils";
export const runtime = "nodejs";
export async function GET() {
  try {
    return Response.json(
      { settings: await aiSettings((await requireAuth()).id) },
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
      {
        settings: await saveAISettings(user.id, await readJSON(request, 6000)),
      },
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
    await query("DELETE FROM ai_settings WHERE user_id=?", [user.id]);
    return Response.json({ ok: true }, { headers: NO_STORE });
  } catch (e) {
    return apiError(e);
  }
}
