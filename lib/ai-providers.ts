import { AppError } from "./validation";
export const AI_PROVIDERS = [
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    protocol: "openai",
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    protocol: "openai",
  },
  {
    id: "qwen",
    name: "通义千问",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    protocol: "openai",
  },
  {
    id: "moonshot",
    name: "Kimi / Moonshot",
    baseUrl: "https://api.moonshot.cn/v1",
    model: "moonshot-v1-8k",
    protocol: "openai",
  },
  {
    id: "glm",
    name: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4-plus",
    protocol: "openai",
  },
  {
    id: "anthropic",
    name: "Claude",
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-sonnet-4-5",
    protocol: "anthropic",
  },
  {
    id: "gemini",
    name: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-flash",
    protocol: "gemini",
  },
  {
    id: "custom",
    name: "自定义 OpenAI 兼容接口",
    baseUrl: "",
    model: "",
    protocol: "openai",
  },
] as const;
export type AIConfig = { provider: string; baseUrl: string; model: string };
export type AISettingView = AIConfig & { hasKey: boolean };
export function parseAIConfig(value: unknown, customHosts = ""): AIConfig {
  const v = value as Record<string, unknown> | null;
  const preset = AI_PROVIDERS.find((p) => p.id === v?.provider);
  if (
    !preset ||
    typeof v?.baseUrl !== "string" ||
    typeof v.model !== "string" ||
    !/^[a-zA-Z0-9_.:/-]{1,120}$/.test(v.model)
  )
    throw new AppError("请选择接口并填写有效的模型 ID");
  let url: URL;
  try {
    url = new URL(v.baseUrl);
  } catch {
    throw new AppError("API 地址格式不正确");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.port && url.port !== "443")
  )
    throw new AppError("API 地址必须是无查询参数的 HTTPS 基础地址");
  const baseUrl = url.href.replace(/\/+$/, "");
  if (
    preset.id !== "custom" &&
    baseUrl !== preset.baseUrl &&
    !(preset.id === "deepseek" && baseUrl === "https://api.deepseek.com/v1")
  )
    throw new AppError("此服务请使用预设 API 地址；第三方服务请选择自定义接口");
  if (preset.id === "custom") {
    const allowed = customHosts
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
    if (
      !allowed.includes(url.hostname) ||
      /^(localhost|.*\.localhost|.*\.local|.*\.internal)$/.test(url.hostname) ||
      /^[\d.[\]:]+$/.test(url.hostname)
    )
      throw new AppError(
        "自定义 API 域名需由管理员加入 AI_ALLOWED_HOSTS（仅支持公网域名）",
      );
  }
  return { provider: preset.id, baseUrl, model: v.model };
}
export function aiRequest(
  config: AIConfig,
  key: string,
  instruction: string,
): { url: string; headers: Record<string, string>; body: unknown } {
  const protocol = AI_PROVIDERS.find((p) => p.id === config.provider)!.protocol;
  if (protocol === "anthropic")
    return {
      url: `${config.baseUrl}/messages`,
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: {
        model: config.model,
        max_tokens: 6000,
        messages: [{ role: "user", content: instruction }],
      },
    };
  if (protocol === "gemini")
    return {
      url: `${config.baseUrl}/models/${encodeURIComponent(config.model)}:generateContent`,
      headers: { "x-goog-api-key": key },
      body: {
        contents: [{ parts: [{ text: instruction }] }],
        generationConfig: {
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      },
    };
  return {
    url: `${config.baseUrl}/chat/completions`,
    headers: { Authorization: `Bearer ${key}` },
    body: {
      model: config.model,
      max_tokens: 6000,
      messages: [{ role: "user", content: instruction }],
      stream: false,
    },
  };
}
export function aiText(config: AIConfig, value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AppError("AI 接口返回内容无效", 502);
  const v = value as {
    choices?: { message?: { content?: unknown }; finish_reason?: string }[];
    content?: { type: string; text?: string }[];
    stop_reason?: string;
    candidates?: {
      content?: { parts?: { text?: string; thought?: boolean }[] };
      finishReason?: string;
    }[];
  };
  if (
    v.choices?.[0]?.finish_reason === "length" ||
    v.stop_reason === "max_tokens" ||
    v.candidates?.[0]?.finishReason === "MAX_TOKENS"
  )
    throw new AppError("模型输出被截断，请减少菜品数量后重试", 502);
  const protocol = AI_PROVIDERS.find((p) => p.id === config.provider)!.protocol;
  const content = Array.isArray(v.content) ? v.content : [];
  const parts = Array.isArray(v.candidates?.[0]?.content?.parts)
    ? v.candidates![0].content!.parts!
    : [];
  const text =
    protocol === "anthropic"
      ? content
          .filter((p) => p?.type === "text")
          .map((p) => (typeof p.text === "string" ? p.text : ""))
          .join("")
      : protocol === "gemini"
        ? parts
            .filter((p) => p && !p.thought)
            .map((p) => (typeof p.text === "string" ? p.text : ""))
            .join("")
        : v.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim())
    throw new AppError("模型没有返回菜谱内容，请检查模型 ID", 502);
  return text;
}
