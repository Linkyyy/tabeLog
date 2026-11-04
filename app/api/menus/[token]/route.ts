import { publicMenu } from "@/lib/menu-service";
import { apiError } from "@/lib/http";
import { NO_STORE } from "@/lib/request-utils";
import { assertConfig } from "@/lib/config";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  try {
    assertConfig();
    const { token } = await ctx.params;
    return Response.json(
      { menu: (await publicMenu(token)).menu },
      { headers: NO_STORE },
    );
  } catch (e) {
    return apiError(e);
  }
}
