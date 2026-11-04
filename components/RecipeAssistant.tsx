"use client";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ExternalLink,
  KeyRound,
  Link2,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import {
  AI_PROVIDERS,
  type AIConfig,
  type AISettingView,
} from "@/lib/ai-providers";
import { clientAPI } from "@/lib/client-api";
import type { EntryInput } from "@/lib/types";
import type { RecipeSuggestion } from "@/lib/recipe-suggestion";
const initialConfig: AIConfig = {
  provider: "deepseek",
  baseUrl: AI_PROVIDERS[0].baseUrl,
  model: AI_PROVIDERS[0].model,
};
export default function RecipeAssistant({
  form,
  disabled,
  onApply,
  onUndo,
  canUndo,
  onBusy,
}: {
  form: EntryInput;
  disabled: boolean;
  onApply: (
    suggestion: RecipeSuggestion,
    snapshot: EntryInput,
    replace: boolean,
  ) => number;
  onUndo: () => void;
  canUndo: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const [settings, setSettings] = useState<AISettingView | null>(null),
    [config, setConfig] = useState<AIConfig>(initialConfig),
    [key, setKey] = useState("");
  const [loading, setLoading] = useState(true),
    [configOpen, setConfigOpen] = useState(false),
    [articleOpen, setArticleOpen] = useState(false),
    [content, setContent] = useState(""),
    [replace, setReplace] = useState(false),
    [busy, setBusy] = useState(false),
    [savingKey, setSavingKey] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    let active = true;
    clientAPI<{ settings: AISettingView | null }>("/api/ai/settings")
      .then((data) => {
        if (active) {
          setSettings(data.settings);
          setConfig(data.settings || initialConfig);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.current?.abort();
    };
  }, []);
  async function configure() {
    setSavingKey(true);
    setError("");
    try {
      const data = await clientAPI<{ settings: AISettingView }>(
        "/api/ai/settings",
        "PUT",
        { ...config, apiKey: key },
      );
      setSettings(data.settings);
      setKey("");
      setConfigOpen(false);
      setMessage("AI 接口已保存，可以快速填入菜谱了。");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingKey(false);
    }
  }
  async function assist(mode: "name" | "article") {
    if (mode === "name" && !form.name.trim()) {
      setError("先填写上方的菜名，再点击 AI 快速填入。");
      return;
    }
    if (mode === "name" && !settings) {
      setConfigOpen(true);
      setError("请先配置你的 AI 接口和 API Key。");
      return;
    }
    const snapshot = structuredClone(form);
    setBusy(true);
    onBusy(true);
    setError("");
    setMessage("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await fetch("/api/recipes/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          content: mode === "name" ? form.name.trim() : content,
        }),
        signal: abort.signal,
      });
      const data = await response.json();
      if (!response.ok) {
        if (String(data.error).includes("接口设置")) setConfigOpen(true);
        throw new Error(data.error || "暂时无法整理菜谱");
      }
      const suggestion = data as RecipeSuggestion;
      const changed = onApply(suggestion, snapshot, replace);
      setMessage(
        changed
          ? `已将${suggestion.method === "structured" ? "文章中的菜谱" : "菜谱草稿"}填入下方，可继续修改，点击保存才会加入菜单。`
          : "现有内容已保留。如需重写，请勾选「替换已有内容」再填入。",
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      controller.current = null;
      setBusy(false);
      onBusy(false);
    }
  }
  const sameEndpoint =
    settings?.provider === config.provider &&
    settings?.baseUrl === config.baseUrl;
  return (
    <section
      className="recipe-assistant span-2"
      aria-label="菜谱快速填入"
      aria-busy={busy}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
          e.preventDefault();
          if (configOpen && !savingKey && !busy) configure();
        }
      }}
    >
      <div className="assistant-heading">
        <Sparkles size={16} />
        <div>
          <strong>先写菜名，剩下的交给 AI</strong>
          <span>
            {loading
              ? "正在读取 AI 配置…"
              : settings
                ? `${AI_PROVIDERS.find((p) => p.id === settings.provider)?.name} · ${settings.model}`
                : "生成需要配置 AI 接口；公开网页中的标准菜谱可直接导入。"}
          </span>
        </div>
        <button
          className="assistant-settings"
          type="button"
          aria-label="配置菜谱 AI 接口"
          disabled={busy || savingKey || disabled}
          onClick={() => setConfigOpen(!configOpen)}
        >
          <KeyRound size={14} />
          <span>配置</span>
        </button>
      </div>
      <div className="assistant-actions">
        <button
          type="button"
          className="button primary assistant-generate"
          disabled={disabled || busy || loading || !form.name.trim()}
          onClick={() => assist("name")}
        >
          {busy ? (
            <LoaderCircle size={15} className="spin" />
          ) : (
            <Sparkles size={15} />
          )}
          AI 快速填入
        </button>
        <button
          type="button"
          className="button secondary"
          aria-expanded={articleOpen}
          disabled={disabled || busy}
          onClick={() => {
            setArticleOpen(!articleOpen);
            setError("");
          }}
        >
          <Link2 size={15} />
          文章菜谱导入
          <ChevronDown size={13} />
        </button>
      </div>
      {articleOpen && (
        <div className="article-import-panel">
          <label>
            文章链接 / 菜谱正文
            <textarea
              aria-label="文章链接或菜谱正文"
              rows={4}
              maxLength={18000}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="粘贴小红书分享链接，或复制任何平台的食材、用量和做法正文。"
              disabled={busy || disabled}
            />
          </label>
          <p>
            支持小红书、下厨房、豆果、微信公众号等公开图文文章。需要登录、图片内文字或视频菜谱，请复制正文粘贴；照片可在下方自行添加。
          </p>
          <button
            type="button"
            className="button secondary"
            disabled={disabled || busy || !content.trim()}
            onClick={() => assist("article")}
          >
            {busy ? (
              <LoaderCircle size={15} className="spin" />
            ) : (
              <Link2 size={15} />
            )}
            整理并填入表单
          </button>
        </div>
      )}
      <div className="assistant-options">
        <label>
          <input
            type="checkbox"
            checked={replace}
            onChange={(e) => setReplace(e.target.checked)}
            disabled={busy || disabled}
          />
          替换已有内容
        </label>
        <span>默认填空白项，保留你的修改。</span>
        {canUndo && !busy && (
          <button
            type="button"
            onClick={() => {
              onUndo();
              setMessage("已撤销本次填入，保留了之后手动修改的内容。");
            }}
          >
            <RotateCcw size={12} />
            撤销填入
          </button>
        )}
      </div>
      {busy && (
        <p className="assistant-message" role="status">
          <LoaderCircle size={14} className="spin" />
          正在整理，可继续编辑其他字段。
          <button type="button" onClick={() => controller.current?.abort()}>
            取消
          </button>
        </p>
      )}
      {error && (
        <p className="assistant-error" role="alert">
          {error}
        </p>
      )}
      {message && !busy && (
        <p className="assistant-message" role="status">
          <Check size={14} />
          {message}
        </p>
      )}
      {configOpen && (
        <div className="assistant-config">
          <div className="assistant-config-title">
            <strong>AI 接口设置</strong>
            <button
              type="button"
              aria-label="收起 AI 接口设置"
              onClick={() => setConfigOpen(false)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="form-grid">
            <label>
              AI 服务
              <select
                aria-label="快速填入 AI 服务"
                value={config.provider}
                onChange={(e) => {
                  const p = AI_PROVIDERS.find((p) => p.id === e.target.value)!;
                  setConfig({
                    provider: p.id,
                    baseUrl: p.baseUrl,
                    model: p.model,
                  });
                  setKey("");
                }}
              >
                {AI_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              模型 ID
              <input
                aria-label="快速填入模型 ID"
                maxLength={120}
                value={config.model}
                onChange={(e) =>
                  setConfig({ ...config, model: e.target.value })
                }
              />
            </label>
            <label className="span-2">
              API 基础地址
              <input
                aria-label="快速填入 API 地址"
                type="url"
                value={config.baseUrl}
                readOnly={config.provider !== "custom"}
                onChange={(e) =>
                  setConfig({ ...config, baseUrl: e.target.value })
                }
                placeholder="https://api.deepseek.com"
              />
            </label>
            <label className="span-2">
              API Key
              <input
                aria-label="快速填入 API Key"
                type="password"
                autoComplete="new-password"
                maxLength={500}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={
                  sameEndpoint && settings?.hasKey
                    ? "已保存；留空使用原 Key"
                    : "粘贴自己的 API Key"
                }
              />
            </label>
          </div>
          <button
            type="button"
            className="button secondary"
            disabled={savingKey || busy || disabled}
            onClick={configure}
          >
            {savingKey ? (
              <LoaderCircle className="spin" size={14} />
            ) : (
              <KeyRound size={14} />
            )}
            保存 AI 接口
          </button>
          <p>
            输入的菜名或正文会发送给所选 AI 服务，并消耗你的 API 额度；Key
            按账户加密保存。自定义域名须加入服务器 AI_ALLOWED_HOSTS。
          </p>
        </div>
      )}
      {form.source && (
        <div className="assistant-source">
          <a href={form.source.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={13} />
            {form.source.platform} · {form.source.title || "查看原文"}
          </a>
        </div>
      )}
    </section>
  );
}
