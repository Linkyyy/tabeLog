import { requireAuth } from "@/lib/auth";
import { listEntries, query } from "@/lib/db";
import { apiError } from "@/lib/http";
import { NO_STORE } from "@/lib/request-utils";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const user = await requireAuth(),
      kind =
        new URL(request.url).searchParams.get("kind") === "visit"
          ? "visit"
          : "recipe";
    const entries = (await listEntries(user.id, "mine")).filter(
      (e) => e.kind === kind,
    );
    const rows = await query<{ data: string }>(
      "SELECT r.data FROM meal_records r JOIN entries e ON e.id=r.entry_id WHERE json_extract(e.data,'$.ownerId')=? AND json_extract(e.data,'$.kind')=? ORDER BY r.visited_at DESC,r.created_at DESC",
      [user.id, kind],
    );
    return Response.json(
      {
        app: "tabeLog",
        version: 3,
        exportedAt: new Date().toISOString(),
        entries,
        mealRecords: rows.map((row) => JSON.parse(row.data)),
      },
      { headers: NO_STORE },
    );
  } catch (e) {
    return apiError(e);
  }
}
