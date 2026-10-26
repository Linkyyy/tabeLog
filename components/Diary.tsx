"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowDownUp,
  ArrowRight,
  BookOpen,
  Check,
  ChefHat,
  Download,
  Globe2,
  Heart,
  LayoutGrid,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Map as MapIcon,
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
import { Logo, EntryCard, EntryDetail } from "./EntryPresentation";
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="map-placeholder">
      <LoaderCircle className="spin" />
      正在展开地图…
    </div>
  ),
});
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
    <section className={`journal-hero ${recipe ? "recipe-hero" : ""}`}>
      <div className="hero-copy">
        <div className="eyebrow">
          <span className="tiny-line" />
          {recipe ? "COOK. CREATE. CHERISH." : "TASTE. REMEMBER. REPEAT."}
        </div>
        <h1>
          {recipe ? "把日子，" : "好好吃饭，"}
          <br />
          <span>{recipe ? "煮成喜欢的味道。" : "慢慢记录。"}</span>
          <span className="hero-period">✳</span>
        </h1>
        <p>
          {recipe ? (
            <>
              那些拿手的家常菜，和偶然成功的小尝试，
              <br className="desktop-break" />
              都是属于你的，独一份的烟火气。
            </>
          ) : (
            <>
              把路过的城市、喜欢的小店，和每一口心动，
              <br className="desktop-break" />
              都收藏进自己的美食地图。
            </>
          )}
        </p>
        <div className="hero-bottom">
          <span className="hero-signature">
            {recipe ? "厨房很小，日子很香。" : "一餐一记，一味一忆。"}
          </span>
          <button
            className="text-button"
            aria-label={demo ? "结束示例漫游" : "浏览示例日记"}
            onClick={onDemo}
          >
            {demo
              ? "回到真实记录"
              : recipe
                ? "翻翻示例菜谱"
                : "随便逛逛 · 示例日记"}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
      <div className="hero-art" aria-hidden="true">
        <div className="art-label">
          {recipe ? "HOMEMADE WITH LOVE." : "THE LITTLE THINGS"}
          <br />
          {recipe ? "HAPPINESS ON A PLATE." : "THAT TASTE LIKE LIFE."}
        </div>
        <div className="art-ring ring-one" />
        <div className="art-ring ring-two" />
        <div className="plate">
          <div className="plate-inner">
            <div className="food-leaf leaf-one" />
            <div className="food-leaf leaf-two" />
            <div className="food-leaf leaf-three" />
            <div className="salmon salmon-one" />
            <div className="salmon salmon-two" />
            <div className="salmon salmon-three" />
            <div className="lemon" />
            <div className="tomato tomato-one" />
            <div className="tomato tomato-two" />
          </div>
        </div>
        <div className="chopstick chopstick-one" />
        <div className="chopstick chopstick-two" />
        <div className="art-sticker">
          <span>{recipe ? "てづくり" : "おいしい"}</span>
          <strong>{recipe ? "自炊" : "日常"}</strong>
          <span>GOOD FOOD, GOOD MOOD</span>
        </div>
        <span className="art-spark spark-one">✳</span>
        <span className="art-spark spark-two">+</span>
        <span className="art-note">
          {recipe
            ? "made by me, made with love ↗"
            : "made of little happy moments ↗"}
        </span>
      </div>
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
    [view, setView] = useState<"journal" | "map">("journal"),
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
    [focus, setFocus] = useState<Location | null>(null),
    [toast, setToast] = useState("");
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
    setView("journal");
    setSelected(null);
    filtersReset();
  }
  function changeScope(next: "mine" | "public") {
    setScope(next);
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
  function locate(entry: Entry) {
    setView("map");
    setFocus({ lat: entry.lat, lng: entry.lng });
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
  return (
    <>
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
              ? "私人收藏，也可以自在分享。"
              : "看看大家的美味日常。"}
          </span>
        </div>
        <section className="stats-row" aria-label="美食统计">
          {[
            {
              icon: recipe ? ChefHat : Utensils,
              value: source.length,
              label: recipe ? "道亲手做的菜" : "篇探店日记",
            },
            {
              icon: recipe ? BookOpen : MapPin,
              value: recipe
                ? new Set(source.map((e) => e.cuisine)).size
                : new Set(source.map((e) => e.city).filter(Boolean)).size,
              label: recipe ? "种料理风味" : "座城市足迹",
            },
            {
              icon: Heart,
              value: source.filter((e) => e.favorite).length,
              label: recipe ? "道拿手好菜" : "家心头好",
            },
            {
              icon: Globe2,
              value: source.filter((e) => e.visibility === "public").length,
              label: "篇公开分享",
            },
          ].map((s, i) => (
            <div className="stat" key={i}>
              <span className="stat-icon">
                <s.icon size={20} />
              </span>
              <div>
                <strong>{String(s.value).padStart(2, "0")}</strong>
                <span>{s.label}</span>
              </div>
            </div>
          ))}
          <span className="stats-note">
            一口一份记忆 <Sparkles size={15} />
          </span>
        </section>
        {scope === "mine" && !user && !demo ? (
          <section className="signin-prompt">
            <div>
              <span className="eyebrow">A SPACE THAT’S TRULY YOURS</span>
              <h2>
                让每一份美味，
                <br />
                都有自己的位置。
              </h2>
              <p>
                登录后，收藏探店的足迹，记下自己做的菜。
                <br />
                私人保存，或把喜欢的味道分享出去。
              </p>
            </div>
            <AuthForm
              onSuccess={signedIn}
              registrationOpen={registrationOpen}
            />
          </section>
        ) : (
          <section className="journal-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  {recipe ? "FROM MY LITTLE KITCHEN" : "MY TASTY COLLECTION"}
                </span>
                <h2>
                  {recipe
                    ? "我的菜单"
                    : view === "map"
                      ? "探店地图"
                      : "探店手帖"}
                  <span>{source.length}</span>
                </h2>
              </div>
              <div className="section-actions">
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
                {!recipe && (
                  <div className="view-switch" aria-label="浏览方式">
                    <button
                      className={view === "journal" ? "selected" : ""}
                      aria-label="卡片视图"
                      aria-pressed={view === "journal"}
                      onClick={() => setView("journal")}
                    >
                      <LayoutGrid size={16} />
                      <span>手帖</span>
                    </button>
                    <button
                      className={view === "map" ? "selected" : ""}
                      aria-label="地图视图"
                      aria-pressed={view === "map"}
                      onClick={() => setView("map")}
                    >
                      <MapIcon size={16} />
                      <span>地图</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            {demo && (
              <div className="demo-banner">
                <Sparkles size={16} />
                <span>
                  你正在浏览示例{recipe ? "菜谱" : "日记"}
                  ，内容不会保存到你的账户。
                </span>
                <button onClick={() => setDemo(false)}>
                  回到真实记录 <X size={14} />
                </button>
              </div>
            )}
            <div className="collection-toolbar">
              <div className="search-box">
                <Search size={17} />
                <input
                  aria-label="搜索日记"
                  placeholder={
                    recipe ? "找一道菜，或一种食材…" : "找一家店，或一种味道…"
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
                只看心头好
              </button>
              {scope === "mine" && (
                <label className="visibility-filter">
                  <select
                    aria-label="可见范围筛选"
                    onChange={(e) => {
                      setQuery("");
                      const next = e.target.value;
                      setPrivacy(next);
                    }}
                    value={privacy}
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
                  <option value="date">
                    {recipe ? "最近下厨" : "最近到店"}
                  </option>
                  <option value="rating">评分优先</option>
                </select>
              </label>
            </div>
            <div className="category-tabs" role="group" aria-label="料理分类">
              {["全部", ...CUISINES].map((c) => (
                <button
                  key={c}
                  className={category === c ? "active" : ""}
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                >
                  {c === "全部" ? (
                    <Utensils size={14} />
                  ) : (
                    <span>{icons[c]}</span>
                  )}
                  {c}
                </button>
              ))}
            </div>
            {error && (
              <div className="error-banner" role="alert">
                <AlertCircle size={18} />
                <span>{error}</span>
                <button className="text-button" onClick={loadEntries}>
                  重试
                </button>
              </div>
            )}
            {loading && !demo ? (
              <div className="loading-state">
                <LoaderCircle className="spin" />
                <p>正在翻开美味记忆…</p>
              </div>
            ) : view === "map" && !recipe ? (
              <div className="map-layout">
                <aside className="map-sidebar">
                  <div className="map-list-heading">
                    <strong>地图上的美味</strong>
                    <span>{filtered.length} 家店</span>
                  </div>
                  {filtered.map((e) => (
                    <button
                      className="map-list-item"
                      key={e.id}
                      onClick={() => {
                        setFocus({ lat: e.lat, lng: e.lng });
                        setSelected(e);
                      }}
                    >
                      <span className="map-list-emoji">
                        {icons[e.cuisine] || "🍽️"}
                      </span>
                      <div>
                        <strong>{e.name}</strong>
                        <span>
                          {e.city || e.cuisine} · {e.authorName}
                        </span>
                        <span>★ {e.rating.toFixed(1)}</span>
                      </div>
                    </button>
                  ))}
                  {!filtered.length && (
                    <div className="map-empty">
                      <MapPin size={26} />
                      <p>这里还没有记录</p>
                      <span>点击地图，开始你的美食足迹。</span>
                    </div>
                  )}
                  <div className="map-list-tip">
                    <MapPin size={14} />
                    点击空白位置，记下新发现。
                  </div>
                </aside>
                <div className="main-map">
                  <MapView
                    entries={filtered}
                    selectedId={selected?.id}
                    focus={focus}
                    provider={provider}
                    onProviderChange={changeProvider}
                    onSelect={(id) =>
                      setSelected(filtered.find((e) => e.id === id) || null)
                    }
                    pickMode
                    onPick={newEntry}
                  />
                </div>
              </div>
            ) : filtered.length ? (
              <div className="entries-grid">
                {filtered.map((e) => (
                  <EntryCard
                    key={e.id}
                    entry={e}
                    onOpen={() => setSelected(e)}
                    onLocate={() => locate(e)}
                  />
                ))}
                <button className="add-card" onClick={() => newEntry()}>
                  <span>
                    <Plus size={25} />
                  </span>
                  <strong>
                    {recipe ? "今天，想做点什么？" : "下一站，吃什么？"}
                  </strong>
                  <p>
                    {recipe
                      ? "把厨房里的小幸福，也记下来。"
                      : "把新的美味，也记在这里。"}
                  </p>
                  <span className="add-card-action">
                    {recipe ? "记录一道菜" : "写一篇日记"}{" "}
                    <ArrowRight size={14} />
                  </span>
                </button>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-illustration">
                  {recipe ? (
                    <ChefHat size={44} strokeWidth={1.2} />
                  ) : (
                    <BookOpen size={43} strokeWidth={1.2} />
                  )}
                  <span>✳</span>
                </div>
                <span className="eyebrow">
                  {recipe
                    ? "A LITTLE KITCHEN, A LOT OF LOVE"
                    : "A BLANK PAGE, A NEW TASTE"}
                </span>
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
                      ? "写下食材与做法，拍下出锅的瞬间。"
                      : "记录喜欢的小店，让美好的味道有迹可循。"}
                </p>
                {source.length ? (
                  <button className="button secondary" onClick={filtersReset}>
                    清除筛选
                  </button>
                ) : (
                  <div className="empty-actions">
                    <button
                      className="button primary"
                      onClick={() => newEntry()}
                    >
                      <Plus size={17} />
                      {recipe ? "写下第一道菜" : "写下第一篇日记"}
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setDemo(true)}
                    >
                      先看看示例 <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="collection-bottom">
              <span>
                {filtered.length
                  ? `已经翻完 ${filtered.length} 份美味记忆`
                  : "等一顿好饭，也等一个好故事"}
              </span>
              <span>生活的滋味，要慢慢尝。</span>
            </div>
          </section>
        )}
        <section className="bottom-note">
          <span>“</span>
          <p>
            在外寻味，也在家寻常。
            <br />
            <strong>每一餐，都可以被好好记住。</strong>
          </p>
          <div>
            WITH LOVE & A GOOD APPETITE
            <Utensils size={19} />
          </div>
        </section>
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
    </>
  );
}
