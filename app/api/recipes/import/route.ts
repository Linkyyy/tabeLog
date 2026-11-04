import { randomUUID } from "node:crypto";
import { checkOrigin, requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { apiError } from "@/lib/http";
import { parseRecipes } from "@/lib/recipe-import";
import { NO_STORE, readJSON } from "@/lib/request-utils";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireAuth();
    const recipes = parseRecipes(await readJSON(request));
    const now = new Date().toISOString();
    const entries = recipes.map((r) => ({
      ...r,
      id: randomUUID(),
      ownerId: user.id,
      authorName: user.name,
      photos: [],
      createdAt: now,
      updatedAt: now,
    }));
    // One statement is atomic on both SQLite and D1; no partial imports.
    await query(
      "INSERT INTO entries(id,data,updated_at) SELECT json_extract(value,'$.id'),value,json_extract(value,'$.updatedAt') FROM json_each(?)",
      [JSON.stringify(entries)],
    );
    return Response.json({ entries }, { status: 201, headers: NO_STORE });
  } catch (e) {
    return apiError(e);
  }
}
