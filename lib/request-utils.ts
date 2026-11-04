import { AppError } from "./validation";
export async function readJSON(
  request: Request,
  max = 350000,
): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > max)
    throw new AppError("请求内容过大", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("请求内容不能为空");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new AppError("请求内容过大", 413);
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError("请求格式不正确");
  }
}
export const NO_STORE = { "Cache-Control": "private, no-store" };
