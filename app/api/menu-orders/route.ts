import { requireAuth } from "@/lib/auth";
import { ownerOrders } from "@/lib/menu-service";
import { apiError } from "@/lib/http";
import { NO_STORE } from "@/lib/request-utils";
export const runtime = "nodejs";
export async function GET() {
  try {
    return Response.json(
      { orders: await ownerOrders((await requireAuth()).id) },
      { headers: NO_STORE },
    );
  } catch (e) {
    return apiError(e);
  }
}
