import { requireAuth, checkOrigin } from "@/lib/auth";
import { listEntries } from "@/lib/db";
import { apiError } from "@/lib/http";
import { writeEntry } from "@/lib/entry-service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await requireAuth();
    return Response.json(
      { entries: await listEntries() },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    await requireAuth();
    return Response.json({ entry: await writeEntry(request) }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
