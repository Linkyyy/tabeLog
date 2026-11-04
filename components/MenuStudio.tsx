"use client";
import { useEffect, useState } from "react";
import { Check, FileUp, KeyRound, LoaderCircle, Sparkles } from "lucide-react";
import {
  AI_PROVIDERS,
  type AIConfig,
  type AISettingView,
} from "@/lib/ai-providers";
import { parseRecipes, parseRecipeText } from "@/lib/recipe-import";
import { clientAPI } from "@/lib/client-api";
import type { Entry, EntryInput } from "@/lib/types";
import Modal from "./Modal";
type Tab = "generate" | "import" | "settings";
const defaultConfig: AIConfig = {
  provider: "deepseek",
  baseUrl: AI_PROVIDERS[0].baseUrl,
  model: AI_PROVIDERS[0].model,
};
export default function MenuStudio({
  onClose,
  onImported,
  initialTab = "generate",
}: {
  onClose: () => void;
  onImported: (entries: Entry[]) => void;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab),
    [config, setConfig] = useState<AIConfig>(defaultConfig),
    [saved, setSaved] = useState<AISettingView | null>(null);
  const [apiKey, setApiKey] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [prompt, setPrompt] = useState(
      "两人份家常晚餐，荤素搭配，30 分钟左右做好。",
    ),
    [count, setCount] = useState(3),
    [text, setText] = useState("");
  const [drafts, setDrafts] = useState<EntryInput[]>([]),
    [checked, setChecked] = useState<number[]>([]);
  useEffect(() => {
    let active = true;
    clientAPI<{ settings: AISettingView | null }>("/api/ai/settings")
      .then(({ settings }) => {
        if (active) {
          setSaved(settings);
          setConfig(settings || defaultConfig);
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
    };
  }, []);
  function switchTab(next: Tab) {
    setTab(next);
    setError("");
    setMessage("");
  }
  function preview(recipes: EntryInput[]) {
    setDrafts(recipes);
    setChecked(recipes.map((_, i) => i));
    setMessage("菜谱已整理好。确认菜名、用量和做法后再保存。");
  }
  async function saveConfig() {
    setBusy(true);
    setError("");
    try {
      const data = await clientAPI<{ settings: AISettingView }>(
        "/api/ai/settings",
        "PUT",
        { ...config, apiKey },
      );
      setSaved(data.settings);
      setApiKey("");
      setMessage("接口已保存，可以开始生成菜谱。");
      setTab("generate");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function removeConfig() {
    setBusy(true);
    setError("");
    try {
      await clientAPI("/api/ai/settings", "DELETE");
      setSaved(null);
      setConfig(defaultConfig);
      setApiKey("");
      setMessage("已删除接口配置和 API Key。");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function generate(mode: "generate" | "import") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await clientAPI<{ recipes: EntryInput[] }>(
        "/api/ai/generate",
        "POST",
        { prompt: mode === "import" ? text : prompt, count, mode },
      );
      preview(data.recipes);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function importSelected() {
    setBusy(true);
    setError("");
    try {
      const recipes = parseRecipes(checked.map((i) => drafts[i]));
      const { entries } = await clientAPI<{ entries: Entry[] }>(
        "/api/recipes/import",
        "POST",
        { recipes },
      );
      onImported(entries);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function update(index: number, patch: Partial<EntryInput>) {
    setDrafts((items) =>
      items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }
  const sameEndpoint =
    saved?.provider === config.provider && saved?.baseUrl === config.baseUrl;
  return (
    <Modal title="菜单灵感工坊" wide onClose={onClose}>
      <div className="menu-studio feature-panel" aria-busy={busy}>
        <nav className="feature-tabs" aria-label="菜谱工具">
          {(
            [
              { id: "generate", label: "AI 生成", icon: Sparkles },
              { id: "import", label: "快速导入", icon: FileUp },
              { id: "settings", label: "接口设置", icon: KeyRound },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tab === t.id}
              className={tab === t.id ? "active" : ""}
              onClick={() => switchTab(t.id)}
              disabled={busy}
            >
              <t.icon size={16} />
              {t.label}
            </button>
          ))}
        </nav>
        {error && (
          <p className="feature-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="feature-message" role="status">
            <Check size={16} />
            {message}
          </p>
        )}
        {loading ? (
          <p className="feature-loading">
            <LoaderCircle className="spin" size={18} />
            正在读取接口设置…
          </p>
        ) : tab === "settings" ? (
          <div className="feature-stack">
            <div className="feature-intro">
              <h3>连接你的 AI 厨房助手</h3>
              <p>
                默认使用 DeepSeek。API Key
                仅发送给你选定的接口，按账户加密保存。
              </p>
            </div>
            <div className="feature-grid">
              <label>
                AI 服务
                <select
                  value={config.provider}
                  onChange={(e) => {
                    const p = AI_PROVIDERS.find(
                      (p) => p.id === e.target.value,
                    )!;
                    setConfig({
                      provider: p.id,
                      baseUrl: p.baseUrl,
                      model: p.model,
                    });
                    setApiKey("");
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
                  value={config.model}
                  onChange={(e) =>
                    setConfig({ ...config, model: e.target.value })
                  }
                  placeholder="deepseek-chat"
                  maxLength={120}
                />
              </label>
            </div>
            <label>
              API 基础地址
              <input
                type="url"
                aria-label="API 基础地址"
                value={config.baseUrl}
                readOnly={config.provider !== "custom"}
                onChange={(e) =>
                  setConfig({ ...config, baseUrl: e.target.value })
                }
                placeholder="https://api.deepseek.com"
                autoComplete="off"
              />
              <small>
                {config.provider === "custom"
                  ? "填写 OpenAI 兼容基础地址（如 https://example.com/v1），域名需加入服务器 AI_ALLOWED_HOSTS。"
                  : "已填入官方地址。模型 ID 请使用你的账户可用模型。"}
              </small>
            </label>
            <label>
              API Key
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  sameEndpoint && saved.hasKey
                    ? "已保存；留空继续使用原 Key"
                    : "粘贴该服务的 API Key"
                }
                autoComplete="new-password"
                maxLength={500}
              />
            </label>
            <div className="feature-actions">
              <button
                className="button primary"
                disabled={busy}
                onClick={saveConfig}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <KeyRound size={16} />
                )}
                保存接口
              </button>
              {saved && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={removeConfig}
                >
                  删除接口与 Key
                </button>
              )}
            </div>
            <p className="feature-note">
              生成会将输入文字发送到所选 AI 服务，并消耗该账户的 API
              额度。保存接口不代表已验证连通性。
            </p>
          </div>
        ) : (
          <>
            <div className="ai-provider-banner">
              <Sparkles size={18} />
              <span>
                {saved
                  ? `${AI_PROVIDERS.find((p) => p.id === saved.provider)?.name} · ${saved.model}`
                  : "先连接一个 AI 接口，或直接导入 JSON"}
              </span>
              <button
                className="text-button"
                onClick={() => switchTab("settings")}
              >
                配置接口
              </button>
            </div>
            {tab === "generate" ? (
              <div className="feature-stack">
                <div className="feature-intro">
                  <h3>今天想吃点什么？</h3>
                  <p>
                    告诉 AI 食材、人数、口味与忌口，帮你整理成可以保存的菜谱。
                  </p>
                </div>
                <label>
                  菜单需求
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={4}
                    maxLength={20000}
                  />
                </label>
              </div>
            ) : (
              <div className="feature-stack">
                <div className="feature-intro">
                  <h3>把现有菜谱搬进来</h3>
                  <p>
                    支持 tabeLog 导出的菜谱 JSON。文字菜谱也可以交给 AI 整理。
                  </p>
                </div>
                <label className="file-import-label">
                  <FileUp size={16} />
                  选择 JSON / TXT / Markdown 文件
                  <input
                    aria-label="导入菜谱文件"
                    type="file"
                    accept=".json,.txt,.md,application/json,text/plain,text/markdown"
                    disabled={busy}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 300000) {
                        setError("文件最多 300 KB");
                        return;
                      }
                      try {
                        setText(await file.text());
                        setError("");
                      } catch {
                        setError("文件无法读取");
                      }
                    }}
                  />
                </label>
                <label>
                  粘贴菜谱内容
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={6}
                    maxLength={300000}
                    placeholder={
                      '{"recipes":[{"name":"番茄炒蛋","ingredients":"番茄 2 个\\n鸡蛋 3 个","steps":"1. 切番茄，打散鸡蛋。\\n2. 分别炒熟后拌匀。","minutes":15,"servings":2}]}'
                    }
                  />
                </label>
              </div>
            )}
            <div className="feature-actions generation-actions">
              <label>
                生成数量
                <select
                  aria-label="生成菜品数量"
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                >
                  {[1, 3, 5, 8].map((n) => (
                    <option key={n} value={n}>
                      {n} 道菜
                    </option>
                  ))}
                </select>
              </label>
              {tab === "import" && (
                <button
                  className="button secondary"
                  disabled={busy || !text.trim()}
                  onClick={() => {
                    setError("");
                    try {
                      preview(parseRecipeText(text));
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  解析 JSON
                </button>
              )}
              <button
                className="button primary"
                disabled={
                  busy || !saved || !(tab === "generate" ? prompt : text).trim()
                }
                onClick={() =>
                  generate(tab === "generate" ? "generate" : "import")
                }
              >
                {busy ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Sparkles size={16} />
                )}{" "}
                {busy
                  ? "正在整理菜谱…"
                  : tab === "generate"
                    ? "生成菜单"
                    : "AI 整理文字"}
              </button>
            </div>
            {busy && (
              <p className="feature-note" role="status">
                通常需要几十秒，请稍候。关闭窗口后可重新生成。
              </p>
            )}
            {drafts.length > 0 && (
              <section className="recipe-preview">
                <div className="preview-heading">
                  <h3>
                    预览菜谱 <small>{drafts.length} 道</small>
                  </h3>
                  <span>保存为私人 · 可编辑</span>
                </div>
                {drafts.map((d, i) => (
                  <article key={i} className="recipe-draft">
                    <div className="draft-heading">
                      <label className="inline-check">
                        <input
                          type="checkbox"
                          aria-label={`导入 ${d.name}`}
                          checked={checked.includes(i)}
                          onChange={(e) =>
                            setChecked((old) =>
                              e.target.checked
                                ? [...old, i]
                                : old.filter((x) => x !== i),
                            )
                          }
                        />
                        第 {i + 1} 道菜
                      </label>
                      <span>
                        {d.recipe?.minutes || "—"} 分钟 · {d.recipe?.servings}{" "}
                        人份
                      </span>
                    </div>
                    <label>
                      菜名
                      <input
                        value={d.name}
                        maxLength={100}
                        onChange={(e) => update(i, { name: e.target.value })}
                      />
                    </label>
                    <div className="feature-grid">
                      <label>
                        食材与用量
                        <textarea
                          rows={4}
                          maxLength={5000}
                          value={d.recipe?.ingredients || ""}
                          onChange={(e) =>
                            update(i, {
                              recipe: {
                                ...d.recipe!,
                                ingredients: e.target.value,
                              },
                            })
                          }
                        />
                      </label>
                      <label>
                        做法步骤
                        <textarea
                          rows={4}
                          maxLength={10000}
                          value={d.recipe?.steps || ""}
                          onChange={(e) =>
                            update(i, {
                              recipe: { ...d.recipe!, steps: e.target.value },
                            })
                          }
                        />
                      </label>
                    </div>
                  </article>
                ))}
                <p className="feature-note">
                  AI
                  内容请核对食材用量、过敏原和熟制要求。照片可保存后在编辑菜谱时上传；不会导入外部图片或他人的照片引用。
                </p>
                <button
                  className="button primary import-confirm"
                  disabled={busy || !checked.length}
                  onClick={importSelected}
                >
                  {busy ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <Check size={16} />
                  )}
                  保存 {checked.length} 道菜到我的菜单
                </button>
              </section>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
