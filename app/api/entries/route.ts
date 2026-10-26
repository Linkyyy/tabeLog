import { requireAuth, currentUser, checkOrigin } from "@/lib/auth";
import { listEntries } from "@/lib/db";
import { apiError } from "@/lib/http";
import { writeEntry } from "@/lib/entry-service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const scope =
      new URL(request.url).searchParams.get("scope") === "public"
        ? "public"
        : "mine";
    const user = scope === "mine" ? await requireAuth() : await currentUser();
    return Response.json(
      { entries: await listEntries(user?.id || null, scope) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireAuth();
    return Response.json(
      { entry: await writeEntry(request, user) },
      { status: 201 },
    );
  } catch (e) {
    return apiError(e);
  }
}
