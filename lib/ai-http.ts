import { request as httpsRequest } from "node:https";
import { HttpsProxyAgent } from "https-proxy-agent";
import { AppError } from "./validation";

// Deliberately use a bounded, non-redirecting request. Keep cloud proxy and CA
// settings intact; never include upstream bodies/keys in errors or logs.
export async function postAI(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    const req = httpsRequest(
      url,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        agent: proxy ? new HttpsProxyAgent(proxy) : undefined,
        signal: AbortSignal.timeout(75000),
      },
      (res) => {
        const status = res.statusCode || 502;
        if (status < 200 || status >= 300) {
          res.resume();
          reject(
            new AppError(
              status === 401 || status === 403
                ? "AI 接口拒绝访问，请检查 API Key、账户权限和网络"
                : status === 429
                  ? "AI 接口额度不足或请求过多，请稍后重试"
                  : `AI 接口返回 HTTP ${status}，请检查地址和模型 ID`,
              502,
            ),
          );
          return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 1000000) {
            res.destroy();
            reject(new AppError("AI 返回内容过大，请减少菜品数量", 502));
          } else chunks.push(chunk);
        });
        res.on("error", () => reject(new AppError("AI 响应中断，请重试", 502)));
        res.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            reject(new AppError("AI 接口返回的不是有效 JSON", 502));
          }
        });
      },
    );
    req.on("error", (e) =>
      reject(
        new AppError(
          e.name === "AbortError"
            ? "AI 生成超时，请减少菜品数量后重试"
            : "无法连接 AI 接口，请检查 API 地址和网络",
          502,
        ),
      ),
    );
    req.end(JSON.stringify(body));
  });
}
