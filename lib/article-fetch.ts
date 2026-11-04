import { lookup as dnsLookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";
import { HttpsProxyAgent } from "https-proxy-agent";
import { recipeLink } from "./recipe-links";
import { AppError } from "./validation";
const MAX_BYTES = 2 * 1024 * 1024;
export const ARTICLE_FALLBACK =
  "这篇文章暂时无法直接读取，请在平台复制菜谱正文，粘贴后再整理。";
export function publicAddress(address: string) {
  if (isIP(address) === 4) {
    const blocked = new BlockList();
    for (const [base, prefix] of [
      ["0.0.0.0", 8],
      ["10.0.0.0", 8],
      ["100.64.0.0", 10],
      ["127.0.0.0", 8],
      ["169.254.0.0", 16],
      ["172.16.0.0", 12],
      ["192.0.0.0", 24],
      ["192.168.0.0", 16],
      ["192.0.2.0", 24],
      ["198.18.0.0", 15],
      ["198.51.100.0", 24],
      ["203.0.113.0", 24],
      ["224.0.0.0", 3],
    ] as const)
      blocked.addSubnet(base, prefix, "ipv4");
    return !blocked.check(address, "ipv4");
  }
  if (isIP(address) === 6) {
    const allowed = new BlockList();
    allowed.addSubnet("2000::", 3, "ipv6");
    const blocked = new BlockList();
    blocked.addSubnet("2001:db8::", 32, "ipv6");
    blocked.addSubnet("2001::", 23, "ipv6");
    blocked.addSubnet("2002::", 16, "ipv6");
    return allowed.check(address, "ipv6") && !blocked.check(address, "ipv6");
  }
  return false;
}
export type ArticleResponse = {
  status: number;
  location?: string;
  type: string;
  html: string;
};
export async function requestArticle(
  url: URL,
  address: { address: string; family: number },
  signal: AbortSignal,
): Promise<ArticleResponse> {
  return new Promise((resolve, reject) => {
    const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    const req = httpsRequest(
      url,
      {
        method: "GET",
        agent: proxy ? new HttpsProxyAgent(proxy) : undefined,
        lookup: (_host, _options, callback) =>
          callback(null, address.address, address.family),
        signal,
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "Accept-Encoding": "identity",
          "User-Agent": "Mozilla/5.0 (compatible; tabeLogRecipeImporter/1.0)",
        },
      },
      (res) => {
        const status = res.statusCode || 502,
          type = String(res.headers["content-type"] || "");
        if ([301, 302, 303, 307, 308].includes(status)) {
          res.resume();
          resolve({ status, location: res.headers.location, type, html: "" });
          return;
        }
        if (
          status !== 200 ||
          !/text\/html|application\/xhtml\+xml/i.test(type)
        ) {
          res.destroy();
          reject(new AppError(ARTICLE_FALLBACK, 422));
          return;
        }
        if (Number(res.headers["content-length"]) > MAX_BYTES) {
          res.destroy();
          reject(new AppError("文章内容过大，请复制菜谱正文后导入", 422));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            res.destroy();
            reject(new AppError("文章内容过大，请复制菜谱正文后导入", 422));
          } else chunks.push(chunk);
        });
        res.on("error", () => reject(new AppError(ARTICLE_FALLBACK, 422)));
        res.on("end", () => {
          try {
            let body = Buffer.concat(chunks);
            const encoding = String(res.headers["content-encoding"] || "");
            if (encoding === "gzip")
              body = gunzipSync(body, { maxOutputLength: MAX_BYTES });
            else if (encoding === "br")
              body = brotliDecompressSync(body, { maxOutputLength: MAX_BYTES });
            else if (encoding === "deflate")
              body = inflateSync(body, { maxOutputLength: MAX_BYTES });
            else if (encoding && encoding !== "identity")
              throw new Error("Unsupported encoding");
            const charset = /charset\s*=\s*["']?(gbk|gb2312|gb18030)/i.test(
              type + body.subarray(0, 1500).toString("ascii"),
            )
              ? "gb18030"
              : "utf-8";
            resolve({
              status,
              type,
              html: new TextDecoder(charset).decode(body),
            });
          } catch {
            reject(new AppError(ARTICLE_FALLBACK, 422));
          }
        });
      },
    );
    req.on("error", () => reject(new AppError(ARTICLE_FALLBACK, 422)));
    req.end();
  });
}
type Dependencies = {
  resolve: (host: string) => Promise<{ address: string; family: number }[]>;
  request: typeof requestArticle;
};
export async function fetchRecipeArticle(
  input: string,
  dependencies: Dependencies = {
    resolve: (host) => dnsLookup(host, { all: true }),
    request: requestArticle,
  },
) {
  const initial = recipeLink(input);
  if (!initial)
    throw new AppError("请使用支持平台的文章链接，或直接粘贴菜谱正文");
  const signal = AbortSignal.timeout(10000);
  let url = initial.url;
  for (let hop = 0; hop < 5; hop++) {
    if (signal.aborted) throw new AppError(ARTICLE_FALLBACK, 422);
    const link = recipeLink(url.href);
    if (!link || link.platform.id !== initial.platform.id)
      throw new AppError("文章跳转到了其他网站，请复制正文后导入", 422);
    url = link.url;
    let addresses;
    try {
      addresses = await Promise.race([
        dependencies.resolve(url.hostname),
        new Promise<never>((_, reject) =>
          signal.addEventListener(
            "abort",
            () => reject(new Error("Timed out")),
            { once: true },
          ),
        ),
      ]);
    } catch {
      throw new AppError(ARTICLE_FALLBACK, 422);
    }
    if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
      throw new AppError("文章链接无法安全读取，请复制正文后导入", 422);
    const address = addresses.find((a) => a.family === 4) || addresses[0];
    const result = await dependencies.request(url, address, signal);
    if ([301, 302, 303, 307, 308].includes(result.status) && result.location) {
      try {
        url = new URL(result.location, url);
      } catch {
        throw new AppError(ARTICLE_FALLBACK, 422);
      }
      continue;
    }
    if (result.status !== 200) throw new AppError(ARTICLE_FALLBACK, 422);
    return { html: result.html, url: url.href };
  }
  throw new AppError("文章跳转次数过多，请复制正文后导入", 422);
}
