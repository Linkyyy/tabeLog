import { checkOrigin } from "@/lib/auth";
import { assertConfig } from "@/lib/config";
import { placeOrder } from "@/lib/menu-service";
import { apiError } from "@/lib/http";
import { limitRequests, clientIP } from "@/lib/rate-limit";
import { NO_STORE, readJSON } from "@/lib/request-utils";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  try {
    assertConfig();
    checkOrigin(request);
    const { token } = await ctx.params;
    await limitRequests(`order:${clientIP(request)}`, 30);
    return Response.json(
      { order: await placeOrder(token, await readJSON(request, 12000)) },
      { status: 201, headers: NO_STORE },
    );
  } catch (e) {
    return apiError(e);
  }
}
