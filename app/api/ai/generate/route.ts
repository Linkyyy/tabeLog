import { checkOrigin, requireAuth } from "@/lib/auth";
import { generateRecipes } from "@/lib/ai-service";
import { apiError } from "@/lib/http";
import { limitRequests } from "@/lib/rate-limit";
import { NO_STORE, readJSON } from "@/lib/request-utils";
export const runtime = "nodejs";
export const maxDuration = 90;
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireAuth();
    await limitRequests(`ai:${user.id}`, 15);
    return Response.json(
      {
        recipes: await generateRecipes(user.id, await readJSON(request, 85000)),
      },
      { headers: NO_STORE },
    );
  } catch (e) {
    return apiError(e);
  }
}
