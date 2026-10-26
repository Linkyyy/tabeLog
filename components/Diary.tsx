"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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
  MoreHorizontal,
  UserRound,
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
import BottomSheet from "./BottomSheet";
import { sheetStops, type SheetSnap } from "@/lib/sheet";
import { Logo, EntryDetail } from "./EntryPresentation";
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="map-placeholder">正在展开地图…</div>,
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
  const [snap, setSnap] = useState<SheetSnap>("half");
  const [viewport, setViewport] = useState(844);
  const [activeId, setActiveId] = useState<string>();
  const [mapFocus, setMapFocus] = useState<Location | null>(null);
  useEffect(() => {
    const update = () => setViewport(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("resize", update);
      document.body.style.overflow = previous;
    };
  }, []);
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
    setSnap("half");
    setActiveId(undefined);
    setSelected(null);
    filtersReset();
  }
  function changeScope(next: "mine" | "public") {
    setScope(next);
    setActiveId(undefined);
    setMapFocus(null);
    setSnap(next === "mine" && !user ? "expanded" : "half");
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
    setSnap("half");
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
      setActiveId(undefined);
      setMapFocus(null);
      setSnap("half");
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
  function toggleDemo() {
    setDemo(!demo);
    setQuantities({});
    setSelected(null);
    setActiveId(undefined);
    setMapFocus(null);
    filtersReset();
    setSnap("half");
  }
  function focusStore(entry: Entry, fromMap = false) {
    setActiveId(entry.id);
    setMapFocus({ lat: entry.lat, lng: entry.lng });
    setSnap(fromMap ? "half" : "collapsed");
  }
  const active = recipe ? undefined : filtered.find((e) => e.id === activeId);
  const drawerHeight = sheetStops(viewport)[snap];
  const toolbar = (
    <>
      <div className="search-box">
        <Search size={16} />
        <input
          aria-label="搜索日记"
          placeholder={recipe ? "搜索菜名或食材" : "搜索店名或地址"}
          value={query}
          onFocus={() => {
            if (snap === "collapsed") setSnap("half");
          }}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button aria-label="清空搜索" onClick={() => setQuery("")}>
            <X size={14} />
          </button>
        )}
      </div>
      <button
        className={`favorites-filter ${favorites ? "selected" : ""}`}
        aria-label="只看心头好"
        aria-pressed={favorites}
        onClick={() => setFavorites(!favorites)}
      >
        <Heart size={16} fill={favorites ? "currentColor" : "none"} />
      </button>
    </>
  );
  const filters = (
    <div className="sheet-filters">
      {scope === "mine" && (
        <select
          aria-label="可见范围筛选"
          value={privacy}
          onChange={(e) => setPrivacy(e.target.value)}
        >
          <option value="all">全部可见范围</option>
          <option value="private">私人收藏</option>
          <option value="public">公开分享</option>
        </select>
      )}
      <select
        aria-label="日记排序"
        value={sort}
        onChange={(e) => setSort(e.target.value)}
      >
        <option value="date">{recipe ? "最近下厨" : "最近到店"}</option>
        <option value="rating">评分优先</option>
      </select>
      {demo && (
        <span className="sheet-demo-note">
          <Sparkles size={11} />
          <span>你正在浏览示例{recipe ? "菜谱" : "日记"}</span>
          <button onClick={toggleDemo} aria-label="回到真实记录">
            <X size={12} />
          </button>
        </span>
      )}
    </div>
  );
  return (
    <div
      className={`ordering-app map-application ${recipe ? "recipe-mode" : "visit-mode"}`}
      data-sheet-snap={snap}
      style={{ "--drawer-height": `${drawerHeight}px` } as CSSProperties}
    >
      <main className="workspace-map" aria-label="店铺地图">
        <MapView
          key={`${scope}:${demo}:${user?.id || "guest"}`}
          entries={recipe ? [] : filtered}
          selectedId={active?.id}
          focus={active ? mapFocus : null}
          bottomInset={Math.min(drawerHeight + 20, viewport - 250)}
          topInset={88}
          provider={provider}
          onProviderChange={changeProvider}
          onSelect={(id) => {
            const entry = filtered.find((e) => e.id === id);
            if (entry) focusStore(entry, true);
          }}
        />
      </main>
      <header className="map-topbar">
        <a href="/" className="compact-brand" aria-label="tabeLog 首页">
          <Utensils size={20} />
          <span>tabeLog</span>
        </a>
        <label className="module-select">
          {recipe ? <ChefHat size={16} /> : <MapPin size={16} />}
          <select
            aria-label="模块切换"
            value={kind}
            onChange={(e) => changeKind(e.target.value as EntryKind)}
          >
            <option value="visit">探店日记</option>
            <option value="recipe">我的菜单</option>
          </select>
        </label>
        <select
          className="space-select"
          aria-label="浏览空间"
          value={scope}
          onChange={(e) => changeScope(e.target.value as "mine" | "public")}
        >
          <option value="mine">我的空间</option>
          <option value="public">美味广场</option>
        </select>
        <div className="topbar-actions">
          <button
            className="topbar-icon topbar-add"
            aria-label={recipe ? "记录一道菜" : "记一笔"}
            onClick={() => newEntry()}
          >
            <Plus size={19} />
          </button>
          <button
            className="topbar-icon"
            aria-label={user ? "退出登录" : "登录 / 注册"}
            title={user ? `${user.name} · 退出登录` : "登录 / 注册"}
            onClick={() => (user ? logout() : setAuthOpen(true))}
          >
            {user ? <LogOut size={17} /> : <UserRound size={18} />}
          </button>
          <details
            className="topbar-more"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                e.currentTarget.open = false;
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") e.currentTarget.open = false;
            }}
          >
            <summary className="topbar-icon" aria-label="更多操作">
              <MoreHorizontal size={20} />
            </summary>
            <div className="topbar-dropdown">
              <button
                aria-label={demo ? "结束示例漫游" : "浏览示例日记"}
                onClick={(e) => {
                  toggleDemo();
                  e.currentTarget.closest("details")?.removeAttribute("open");
                }}
              >
                <Sparkles size={14} />
                {demo ? "回到真实记录" : "查看示例"}
              </button>
              {scope === "mine" && (
                <button
                  aria-label="导出日记"
                  disabled={!source.length}
                  onClick={(e) => {
                    exportDiary();
                    e.currentTarget.closest("details")?.removeAttribute("open");
                  }}
                >
                  <Download size={14} />
                  导出我的记录
                </button>
              )}
              <button
                onClick={(e) => {
                  filtersReset();
                  e.currentTarget.closest("details")?.removeAttribute("open");
                }}
              >
                <Search size={14} />
                清除筛选
              </button>
            </div>
          </details>
        </div>
      </header>
      {active && snap !== "expanded" && (
        <div className="workspace-selected" aria-live="polite">
          <MapPin size={16} />
          <strong>{active.name}</strong>
          <button
            onClick={() => setSelected(active)}
            aria-label={`查看选中店铺 ${active.name}`}
          >
            查看日记
            <ArrowRight size={14} />
          </button>
        </div>
      )}
      <BottomSheet
        snap={snap}
        onSnap={setSnap}
        viewport={viewport}
        label={recipe ? "菜品抽屉" : "店铺抽屉"}
        summary={`${filtered.length} ${recipe ? "道菜" : "家店"}`}
        toolbar={toolbar}
      >
        {scope === "mine" && !user && !demo ? (
          <AuthForm onSuccess={signedIn} registrationOpen={registrationOpen} />
        ) : (
          <>
            {filters}
            {error && (
              <div className="error-banner" role="alert">
                <AlertCircle size={16} />
                <span>{error}</span>
                <button className="text-button" onClick={loadEntries}>
                  重试
                </button>
              </div>
            )}
            {recipe ? (
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
            ) : (
              <>
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
                      {c === "全部" ? (
                        <Utensils size={13} />
                      ) : (
                        <span>{icons[c]}</span>
                      )}
                      {c}
                    </button>
                  ))}
                </div>
                <StoreExplorer
                  items={filtered}
                  activeId={activeId}
                  onLocate={(entry) => focusStore(entry)}
                  onOpen={setSelected}
                  empty={emptyContent}
                  loading={loading && !demo}
                />
              </>
            )}
          </>
        )}
      </BottomSheet>
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
