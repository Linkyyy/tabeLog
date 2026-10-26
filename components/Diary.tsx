"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  ArrowRight,
  BookOpen,
  Check,
  ChefHat,
  Download,
  Globe2,
  Heart,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Utensils,
  X,
  AlertCircle,
} from "lucide-react";
import type {
  Entry,
  EntryKind,
  Location,
  MapProvider,
  User,
} from "@/lib/types";
import { CUISINES } from "@/lib/types";
import { DEMO_ENTRIES, DEMO_RECIPES } from "@/lib/demo";
import EntryForm from "./EntryForm";
import AuthForm from "./AuthForm";
import Modal from "./Modal";
import OrderingMenu, { type Quantities } from "./OrderingMenu";
import StoreExplorer from "./StoreExplorer";
import { Logo, EntryDetail } from "./EntryPresentation";
const icons: Record<string, string> = {
  日料: "🍣",
  中餐: "🍜",
  西餐: "🍝",
  咖啡: "☕",
  甜点: "🍵",
  小吃: "🥟",
  其他: "🍽️",
};
function Hero({
  kind,
  demo,
  onDemo,
}: {
  kind: EntryKind;
  demo: boolean;
  onDemo: () => void;
}) {
  const recipe = kind === "recipe";
  return (
    <section
      className={`browse-intro ${recipe ? "kitchen-intro" : "visit-intro"}`}
    >
      <div className="browse-intro-icon">
        {recipe ? (
          <ChefHat size={29} strokeWidth={1.4} />
        ) : (
          <MapPin size={28} strokeWidth={1.4} />
        )}
      </div>
      <div>
        <span className="eyebrow">
          {recipe ? "MY LITTLE KITCHEN" : "MY TASTY MAP"}
        </span>
        <h1>{recipe ? "今天，想吃点什么？" : "好吃的小店，都在这里。"}</h1>
        <p>
          {recipe
            ? "翻翻拿手菜，点一份今天的好心情。"
            : "上面看地图，下面找美味。"}
        </p>
      </div>
      <button
        className="text-button browse-demo"
        aria-label={demo ? "结束示例漫游" : "浏览示例日记"}
        onClick={onDemo}
      >
        {demo ? "回到真实记录" : recipe ? "看看示例菜单" : "看看示例小店"}
        <ArrowRight size={14} />
      </button>
    </section>
  );
}
export default function Diary() {
  const [user, setUser] = useState<User | null>(null),
    [booting, setBooting] = useState(true),
    [fatal, setFatal] = useState(""),
    [registrationOpen, setRegistrationOpen] = useState(true),
    [authOpen, setAuthOpen] = useState(false);
  const [kind, setKind] = useState<EntryKind>("visit"),
    [scope, setScope] = useState<"mine" | "public">("public"),
    [provider, setProvider] = useState<MapProvider>("osm");
  const [entries, setEntries] = useState<Entry[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [demo, setDemo] = useState(false),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("全部"),
    [favorites, setFavorites] = useState(false),
    [sort, setSort] = useState("date"),
    [privacy, setPrivacy] = useState("all");
  const [selected, setSelected] = useState<Entry | null>(null),
    [editing, setEditing] = useState<Entry | undefined>(),
    [formOpen, setFormOpen] = useState(false),
    [initialLocation, setInitialLocation] = useState<Location | undefined>(),
    [toast, setToast] = useState("");
  const [quantities, setQuantities] = useState<Quantities>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    loadId = useRef(0);
  function notify(message: string) {
    setToast(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 3500);
  }
  useEffect(() => {
    let active = true;
    fetch("/api/session", { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        if (active) {
          setUser(data.user);
          setScope(data.user ? "mine" : "public");
          setRegistrationOpen(data.registrationOpen);
        }
      })
      .catch((e) => {
        if (active) setFatal(e.message || "暂时无法连接服务");
      })
      .finally(() => {
        if (active) setBooting(false);
      });
    const saved = localStorage.getItem("tabelog-map");
    if (["osm", "google", "amap"].includes(saved || ""))
      setProvider(saved as MapProvider);
    return () => {
      active = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  async function loadEntries() {
    const id = ++loadId.current;
    if (scope === "mine" && !user) {
      setEntries([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/entries?scope=${scope}`, {
        cache: "no-store",
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      if (id === loadId.current) setEntries(data.entries);
    } catch (e) {
      if (id === loadId.current) {
        setEntries([]);
        setError(e instanceof Error ? e.message : "无法加载记录，请重试");
      }
    } finally {
      if (id === loadId.current) setLoading(false);
    }
  }
  useEffect(() => {
    if (!booting) loadEntries();
    return () => {
      loadId.current++;
    };
  }, [scope, user, booting]);
  function filtersReset() {
    setQuery("");
    setCategory("全部");
    setFavorites(false);
    setPrivacy("all");
  }
  function changeKind(next: EntryKind) {
    setKind(next);
    window.scrollTo({ top: 0, behavior: "instant" });
    setSelected(null);
    filtersReset();
  }
  function changeScope(next: "mine" | "public") {
    setScope(next);
    setQuantities({});
    setEntries([]);
    setSelected(null);
    setDemo(false);
    filtersReset();
  }
  function changeProvider(next: MapProvider) {
    setProvider(next);
    localStorage.setItem("tabelog-map", next);
  }
  const source = (
    demo ? (kind === "recipe" ? DEMO_RECIPES : DEMO_ENTRIES) : entries
  ).filter(
    (e) =>
      e.kind === kind &&
      (demo ||
        (scope === "mine"
          ? e.ownerId === user?.id
          : e.visibility === "public")),
  );
  const filtered = useMemo(
    () =>
      source
        .filter(
          (e) =>
            (scope !== "mine" ||
              privacy === "all" ||
              e.visibility === privacy) &&
            (category === "全部" || e.cuisine === category) &&
            (!favorites || e.favorite) &&
            `${e.name} ${e.address} ${e.city} ${e.review} ${e.authorName} ${e.recipe?.ingredients || ""}`
              .toLowerCase()
              .includes(query.trim().toLowerCase()),
        )
        .sort((a, b) =>
          sort === "rating"
            ? b.rating - a.rating || b.visitedAt.localeCompare(a.visitedAt)
            : b.visitedAt.localeCompare(a.visitedAt),
        ),
    [source, category, favorites, query, sort, scope, privacy],
  );
  function newEntry(point?: Location) {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setEditing(undefined);
    setInitialLocation(point);
    setFormOpen(true);
  }
  function saved(entry: Entry) {
    setEntries((current) => [
      entry,
      ...current.filter((e) => e.id !== entry.id),
    ]);
    setFormOpen(false);
    setEditing(undefined);
    setSelected(null);
    setDemo(false);
    setScope("mine");
    filtersReset();
    notify(
      entry.visibility === "public"
        ? "已保存，并分享到美味广场。"
        : "已保存，只有你自己可见。",
    );
  }
  function signedIn(next: User) {
    setUser(next);
    setAuthOpen(false);
    setDemo(false);
    changeScope("mine");
    notify(`欢迎回来，${next.name}。`);
  }
  async function logout() {
    try {
      const r = await fetch("/api/session", { method: "DELETE" });
      if (!r.ok) throw new Error();
      setUser(null);
      setQuantities({});
      setEntries([]);
      setSelected(null);
      setFormOpen(false);
      setDemo(false);
      setScope("public");
      notify("已退出登录");
    } catch {
      notify("退出失败，请重试");
    }
  }
  async function remove() {
    if (!selected) return;
    const r = await fetch(`/api/entries/${selected.id}`, { method: "DELETE" });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    setEntries((v) => v.filter((e) => e.id !== selected.id));
    setSelected(null);
    notify("这篇记录已删除");
  }
  function exportDiary() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              app: "tabeLog",
              exportedAt: new Date().toISOString(),
              entries: source,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `tabelog-${kind}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify("文字与坐标已导出；照片请另外保存。");
  }
  function changeQuantity(id: string, change: number) {
    if (!source.some((e) => e.id === id && e.kind === "recipe")) return;
    setQuantities((current) => {
      const next = { ...current };
      const count = Math.max(0, Math.min(20, (current[id] || 0) + change));
      if (count) next[id] = count;
      else delete next[id];
      return next;
    });
  }
  const recipe = kind === "recipe";
  if (booting)
    return (
      <main className="boot-screen">
        <Logo />
        <LoaderCircle className="spin" size={25} />
        <p>把美好的味道，慢慢收集。</p>
      </main>
    );
  if (fatal)
    return (
      <main className="login-page">
        <Logo />
        <div className="login-card">
          <AlertCircle size={30} />
          <h1>还差一点，就能开饭。</h1>
          <p>{fatal}</p>
          <button
            className="button secondary"
            onClick={() => window.location.reload()}
          >
            重新检查
          </button>
        </div>
      </main>
    );
  const emptyContent = (
    <div className="empty-state compact-empty">
      <div className="empty-illustration">
        {recipe ? (
          <ChefHat size={39} strokeWidth={1.2} />
        ) : (
          <BookOpen size={39} strokeWidth={1.2} />
        )}
        <span>✳</span>
      </div>
      <h3>
        {source.length
          ? "还没找到这份美味"
          : recipe
            ? "你的拿手菜，值得被记住。"
            : scope === "public"
              ? "美味广场，等你来开席。"
              : "第一口心动，从这里开始。"}
      </h3>
      <p>
        {source.length
          ? "换个关键词或分类，再找找看。"
          : recipe
            ? "写下食材和做法，把自己的小厨房变成菜单。"
            : "在地图上记下第一家小店，让美味有迹可循。"}
      </p>
      {source.length ? (
        <button className="button secondary" onClick={filtersReset}>
          清除筛选
        </button>
      ) : (
        <div className="empty-actions">
          <button className="button primary" onClick={() => newEntry()}>
            <Plus size={16} />
            {recipe ? "写下第一道菜" : "写下第一篇日记"}
          </button>
          <button
            className="text-button"
            onClick={() => {
              setDemo(true);
              setQuantities({});
            }}
          >
            先看看示例
            <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
  const controls = (
    <>
      <div className="browse-collection-heading">
        <div>
          <h2>
            {recipe ? "我的菜单" : "小店清单"}
            <span>{source.length}</span>
          </h2>
          <p>
            {recipe
              ? "一菜一味，都有自己的故事。"
              : "每一家，都藏着一份好好吃饭的记忆。"}
          </p>
        </div>
        {scope === "mine" && (
          <button
            className="icon-button export-button"
            onClick={exportDiary}
            disabled={!source.length}
            title="导出文字与坐标"
            aria-label="导出日记"
          >
            <Download size={17} />
          </button>
        )}
      </div>
      <div className="collection-toolbar">
        <div className="search-box">
          <Search size={17} />
          <input
            aria-label="搜索日记"
            placeholder={
              recipe
                ? "搜菜名、食材，或一种想念的味道"
                : "搜店名、地址，或想去的城市"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button aria-label="清空搜索" onClick={() => setQuery("")}>
              <X size={15} />
            </button>
          )}
        </div>
        <button
          className={`favorites-filter ${favorites ? "selected" : ""}`}
          aria-pressed={favorites}
          onClick={() => setFavorites(!favorites)}
        >
          <Heart size={15} fill={favorites ? "currentColor" : "none"} />
          <span>只看心头好</span>
        </button>
        {scope === "mine" && (
          <label className="visibility-filter">
            <select
              aria-label="可见范围筛选"
              value={privacy}
              onChange={(e) => setPrivacy(e.target.value)}
            >
              <option value="all">全部可见范围</option>
              <option value="private">私人收藏</option>
              <option value="public">公开分享</option>
            </select>
          </label>
        )}
        <label className="sort-select">
          <ArrowDownUp size={14} />
          <select
            aria-label="日记排序"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="date">{recipe ? "最近下厨" : "最近到店"}</option>
            <option value="rating">评分优先</option>
          </select>
        </label>
      </div>
      {!recipe && (
        <div
          className="category-tabs store-categories"
          role="group"
          aria-label="料理分类"
        >
          {["全部", ...CUISINES].map((c) => (
            <button
              key={c}
              className={category === c ? "active" : ""}
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
            >
              {c === "全部" ? <Utensils size={14} /> : <span>{icons[c]}</span>}
              {c}
            </button>
          ))}
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button className="text-button" onClick={loadEntries}>
            重试
          </button>
        </div>
      )}
    </>
  );
  return (
    <div className={`ordering-app ${recipe ? "recipe-mode" : "visit-mode"}`}>
      <header className="site-header">
        <div className="header-inner">
          <Logo />
          <nav aria-label="主导航">
            <button
              title="探店日记"
              aria-pressed={!recipe}
              className={!recipe ? "nav-link active" : "nav-link"}
              onClick={() => changeKind("visit")}
            >
              <MapPin size={17} />
              探店日记
            </button>
            <button
              title="我的菜单"
              aria-pressed={recipe}
              className={recipe ? "nav-link active" : "nav-link"}
              onClick={() => changeKind("recipe")}
            >
              <ChefHat size={18} />
              我的菜单
            </button>
          </nav>
          <div className="header-actions">
            {user ? (
              <>
                <span className="account-name" title={user.email}>
                  {user.name}
                </span>
                <button
                  className="icon-button"
                  aria-label="退出登录"
                  onClick={logout}
                >
                  <LogOut size={17} />
                </button>
              </>
            ) : (
              <button
                className="text-button login-trigger"
                onClick={() => setAuthOpen(true)}
              >
                登录 / 注册
              </button>
            )}
            <button
              className="button primary header-add"
              aria-label={recipe ? "记录一道菜" : "记一笔"}
              onClick={() => newEntry()}
            >
              <Plus size={17} />
              <span>{recipe ? "记录一道菜" : "记一笔"}</span>
            </button>
          </div>
        </div>
      </header>
      <main className="page-wrap">
        <Hero
          kind={kind}
          demo={demo}
          onDemo={() => {
            setDemo(!demo);
            setQuantities({});
            setSelected(null);
            filtersReset();
          }}
        />
        <div className="space-tabs" role="group" aria-label="浏览空间">
          <button
            className={scope === "mine" ? "active" : ""}
            aria-pressed={scope === "mine"}
            onClick={() => changeScope("mine")}
          >
            <LockKeyhole size={15} />
            我的空间<small>PRIVATE & PERSONAL</small>
          </button>
          <button
            className={scope === "public" ? "active" : ""}
            aria-pressed={scope === "public"}
            onClick={() => changeScope("public")}
          >
            <Globe2 size={15} />
            美味广场<small>GOOD TASTE, SHARED</small>
          </button>
          <span>
            {scope === "mine"
              ? "自己的美味，自己作主。"
              : "把好味道分享给更多人。"}
          </span>
        </div>
        {scope === "mine" && !user && !demo ? (
          <section className="signin-prompt">
            <div>
              <span className="eyebrow">A SPACE THAT’S TRULY YOURS</span>
              <h2>
                自己的小厨房，
                <br />
                自己的美味地图。
              </h2>
              <p>
                登录后，记下喜欢的小店和亲手做的菜。
                <br />
                私人收藏，或自在分享。
              </p>
            </div>
            <AuthForm
              onSuccess={signedIn}
              registrationOpen={registrationOpen}
            />
          </section>
        ) : (
          <section className="browse-experience">
            {demo && (
              <div className="demo-banner">
                <Sparkles size={16} />
                <span>
                  你正在浏览示例{recipe ? "菜谱" : "日记"}
                  ，内容不会保存到你的账户。
                </span>
                <button
                  onClick={() => {
                    setDemo(false);
                    setQuantities({});
                    setSelected(null);
                  }}
                >
                  回到真实记录
                  <X size={14} />
                </button>
              </div>
            )}
            {recipe ? (
              <>
                {controls}
                <OrderingMenu
                  key={`${scope}:${demo}:${user?.id || "guest"}`}
                  items={filtered}
                  allItems={source}
                  category={category}
                  onCategory={setCategory}
                  quantities={quantities}
                  onQuantity={changeQuantity}
                  onClear={() => setQuantities({})}
                  onOpen={setSelected}
                  onNew={() => newEntry()}
                  empty={emptyContent}
                  loading={loading && !demo}
                />
              </>
            ) : (
              <StoreExplorer
                key={`${scope}:${demo}:${user?.id || "guest"}`}
                items={filtered}
                provider={provider}
                onProviderChange={changeProvider}
                onOpen={setSelected}
                onNew={newEntry}
                empty={emptyContent}
                loading={loading && !demo}
              >
                {controls}
              </StoreExplorer>
            )}
          </section>
        )}
      </main>
      <footer className="site-footer">
        <span>
          <b>tabeLog</b> · 一餐一记
        </span>
        <span>探店的惊喜，厨房的烟火。</span>
        <span>
          <LockKeyhole size={12} />
          私人收藏 · 自在分享
        </span>
      </footer>
      {authOpen && (
        <Modal title="我的美味账户" onClose={() => setAuthOpen(false)}>
          <AuthForm onSuccess={signedIn} registrationOpen={registrationOpen} />
        </Modal>
      )}
      {formOpen && user && (
        <EntryForm
          entry={editing}
          kind={kind}
          initialLocation={initialLocation}
          provider={provider}
          onProviderChange={changeProvider}
          onClose={() => {
            setFormOpen(false);
            setEditing(undefined);
          }}
          onSaved={saved}
        />
      )}
      {selected && !formOpen && (
        <EntryDetail
          key={selected.id}
          entry={selected}
          demo={demo}
          canEdit={!demo && selected.ownerId === user?.id}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditing(selected);
            setFormOpen(true);
          }}
          onDelete={remove}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}
