import { AppError } from "./validation";
export function apiError(error: unknown) {
  if (error instanceof AppError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error(
    "Request failed:",
    error instanceof Error ? error.name : "unknown",
  );
  return Response.json(
    { error: "暂时无法完成操作，请稍后重试" },
    { status: 500 },
  );
}
export function validId(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new AppError("记录不存在", 404);
}
