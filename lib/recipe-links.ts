export const RECIPE_PLATFORMS = [
  {
    id: "xiaohongshu",
    name: "小红书",
    hosts: [
      "www.xiaohongshu.com",
      "xiaohongshu.com",
      "xhslink.com",
      "www.xhslink.com",
    ],
  },
  {
    id: "xiachufang",
    name: "下厨房",
    hosts: ["www.xiachufang.com", "xiachufang.com"],
  },
  {
    id: "douguo",
    name: "豆果美食",
    hosts: ["www.douguo.com", "douguo.com", "m.douguo.com"],
  },
  {
    id: "meishij",
    name: "美食杰",
    hosts: ["www.meishij.net", "meishij.net", "m.meishij.net"],
  },
  {
    id: "xiangha",
    name: "香哈菜谱",
    hosts: ["www.xiangha.com", "xiangha.com", "m.xiangha.com"],
  },
  { id: "weixin", name: "微信公众号", hosts: ["mp.weixin.qq.com"] },
  { id: "zhihu", name: "知乎", hosts: ["zhuanlan.zhihu.com", "www.zhihu.com"] },
  { id: "bilibili", name: "哔哩哔哩", hosts: ["www.bilibili.com", "b23.tv"] },
  {
    id: "douyin",
    name: "抖音",
    hosts: ["www.douyin.com", "v.douyin.com", "www.iesdouyin.com"],
  },
] as const;
export function recipePlatform(host: string) {
  return RECIPE_PLATFORMS.find((p) =>
    (p.hosts as readonly string[]).includes(host.toLowerCase()),
  );
}
export function recipeLink(
  input: string,
): { url: URL; platform: (typeof RECIPE_PLATFORMS)[number] } | null {
  const candidate = input
    .match(/https?:\/\/[^\s<>"'「」]+/i)?.[0]
    ?.replace(/[，。；！？、）》)\]}]+$/g, "");
  if (!candidate || candidate.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  )
    return null;
  const platform = recipePlatform(url.hostname);
  if (!platform) return null;
  url.protocol = "https:";
  url.hash = "";
  if (url.href.length > 2048) return null;
  return { url, platform };
}
export function hasRecipeBody(text: string) {
  return (
    text.trim().length >= 40 &&
    /食材|用料|做法|步骤|[0-9０-９]+\s*(?:克|毫升|勺|个|根|片|分钟|g\b|ml\b)/i.test(
      text,
    )
  );
}
