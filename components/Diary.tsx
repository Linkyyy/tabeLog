"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  Settings,
  QrCode,
  ClipboardList,
  Dices,
  ChartNoAxesColumnIncreasing,
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
import ThemeSettings from "./ThemeSettings";
import MenuStudio from "./MenuStudio";
import MenuSharing from "./MenuSharing";
import MenuSurface from "./MenuSurface";
import MealDraw from "./MealDraw";
import CompactSearch from "./CompactSearch";
import ToolbarSelect from "./ToolbarSelect";
import DiaryTools from "./DiaryTools";
import TasteStatistics from "./TasteStatistics";
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
  const pathname = usePathname();
  const router = useRouter();
  const kind: EntryKind = pathname === "/map" ? "visit" : "recipe";
  const [user, setUser] = useState<User | null>(null),
    [booting, setBooting] = useState(true),
    [fatal, setFatal] = useState(""),
    [registrationOpen, setRegistrationOpen] = useState(true),
    [authOpen, setAuthOpen] = useState(false);
  const [scope, setScope] = useState<"mine" | "public">("public"),
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drawOpen, setDrawOpen] = useState(false);
  const [statisticsOpen, setStatisticsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [studioOpen, setStudioOpen] = useState<"generate" | "settings" | null>(
    null,
  );
  const [sharingOpen, setSharingOpen] = useState<"share" | "orders" | null>(
    null,
  );
  function openMenuTool(tool: "generate" | "settings" | "share" | "orders") {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (tool === "generate" || tool === "settings") setStudioOpen(tool);
    else setSharingOpen(tool);
  }
  function recipesImported(imported: Entry[]) {
    if (kind !== "recipe") router.push("/menu");
    setScope("mine");
    setDemo(false);
    setSnap("half");
    setEntries((current) => [
      ...imported,
      ...current.filter((e) => e.ownerId === user?.id),
    ]);
    filtersReset();
    setStudioOpen(null);
    notify(`已将 ${imported.length} 道菜保存到我的菜单，仅自己可见。`);
  }
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
    try {
      const saved = localStorage.getItem("tabelog-map");
      if (["osm", "google", "amap"].includes(saved || ""))
        setProvider(saved as MapProvider);
    } catch {
      // Browser storage is optional for map and appearance preferences.
    }
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
  useEffect(() => {
    setSnap("half");
    setActiveId(undefined);
    setSelected(null);
    setFormOpen(false);
    setEditing(undefined);
    setDrawOpen(false);
    setStudioOpen(null);
    setSharingOpen(null);
    setAuthOpen(false);
    filtersReset();
  }, [kind]);
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
    try {
      localStorage.setItem("tabelog-map", next);
    } catch {}
  }
  const source = useMemo(
    () =>
      (demo
        ? kind === "recipe"
          ? DEMO_RECIPES
          : DEMO_ENTRIES
        : entries
      ).filter(
        (e) =>
          e.kind === kind &&
          (demo ||
            (scope === "mine"
              ? e.ownerId === user?.id
              : e.visibility === "public")),
      ),
    [demo, kind, entries, scope, user?.id],
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
  const mapEntries = useMemo(
    () => (kind === "recipe" ? [] : filtered),
    [kind, filtered],
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
  async function exportDiary() {
    if (exporting) return;
    setExporting(true);
    try {
      let content: unknown = {
        app: "tabeLog",
        exportedAt: new Date().toISOString(),
        entries: source,
        mealRecords: [],
      };
      if (!demo) {
        const r = await fetch(`/api/export?kind=${kind}`, {
          cache: "no-store",
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "导出失败");
        content = data;
      }
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(content, null, 2)], {
          type: "application/json",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `tabelog-${kind}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify("日记、价格和每次用餐评价已导出；照片文件请另外保存。");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setExporting(false);
    }
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
  const Panel = recipe ? MenuSurface : BottomSheet;
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
          <button
            className={`button primary ${recipe ? "recipe-create-button" : ""}`}
            onClick={() => newEntry()}
          >
            {recipe ? (
              <span className="recipe-create-icon">
                <Plus size={17} />
              </span>
            ) : (
              <Plus size={16} />
            )}
            <span>{recipe ? "写下第一道菜" : "写下第一篇日记"}</span>
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
  const drawerHeight = recipe
    ? Math.max(132, viewport - 86)
    : sheetStops(viewport)[snap];
  const toolbar = (
    <>
      <div className="toolbar-filters" role="group" aria-label="列表筛选">
        <ToolbarSelect
          label="浏览空间"
          value={scope}
          onChange={(next) => changeScope(next as "mine" | "public")}
          options={[
            { value: "mine", label: "我的空间", short: "我的" },
            { value: "public", label: "美味广场", short: "广场" },
          ]}
        />
        {scope === "mine" && (
          <ToolbarSelect
            label="可见范围筛选"
            value={privacy}
            onChange={setPrivacy}
            options={[
              { value: "all", label: "全部可见范围", short: "全部" },
              { value: "private", label: "私人收藏", short: "私人" },
              { value: "public", label: "公开分享", short: "公开" },
            ]}
          />
        )}
        <ToolbarSelect
          label="日记排序"
          value={sort}
          onChange={setSort}
          options={[
            {
              value: "date",
              label: recipe ? "最近下厨" : "最近到店",
              short: "最近",
            },
            { value: "rating", label: "评分优先", short: "评分" },
          ]}
        />
        {!recipe && (
          <ToolbarSelect
            label="料理分类"
            value={category}
            onChange={setCategory}
            options={["全部", ...CUISINES].map((value) => ({
              value,
              label: value === "全部" ? "全部分类" : value,
              short: value === "全部" ? "分类" : value,
            }))}
          />
        )}
      </div>
      <CompactSearch
        key={kind}
        value={query}
        onChange={setQuery}
        placeholder={recipe ? "搜索菜名或食材" : "搜索店名或地址"}
        onOpen={() => {
          if (snap === "collapsed") setSnap("half");
        }}
      />
      <button
        className={`favorites-filter ${favorites ? "selected" : ""}`}
        aria-label="只看心头好"
        aria-pressed={favorites}
        onClick={() => setFavorites(!favorites)}
      >
        <Heart size={16} fill={favorites ? "currentColor" : "none"} />
      </button>
      <DiaryTools
        key={kind}
        recipe={recipe}
        demo={demo}
        onOpen={() => {
          if (!recipe && viewport < 700) setSnap("expanded");
          else if (snap === "collapsed") setSnap("half");
        }}
        onDraw={() => setDrawOpen(true)}
        onAI={() => openMenuTool("generate")}
        onShare={() => openMenuTool("share")}
        onOrders={() => openMenuTool("orders")}
        onStatistics={() => setStatisticsOpen(true)}
        onToggleDemo={toggleDemo}
        onSettings={() => setSettingsOpen(true)}
        onReset={filtersReset}
        onExport={scope === "mine" ? exportDiary : undefined}
        exportDisabled={!source.length}
        exporting={exporting}
      />
    </>
  );
  return (
    <div
      className={`ordering-app map-application ${recipe ? "menu-application recipe-mode" : "visit-mode"}`}
      data-sheet-snap={recipe ? undefined : snap}
      style={{ "--drawer-height": `${drawerHeight}px` } as CSSProperties}
    >
      {!recipe && (
        <main className="workspace-map" aria-label="店铺地图">
          <MapView
            key={`${scope}:${demo}:${user?.id || "guest"}`}
            entries={mapEntries}
            selectedId={active?.id}
            focus={active ? mapFocus : null}
            bottomInset={Math.min(drawerHeight + 20, viewport - 250)}
            topInset={88}
            provider={provider}
            demo={demo}
            showProvider={false}
            onProviderChange={changeProvider}
            onSelect={(id) => {
              const entry = filtered.find((e) => e.id === id);
              if (entry) focusStore(entry, true);
            }}
          />
        </main>
      )}
      <header className="map-topbar">
        <Link href="/menu" className="compact-brand" aria-label="tabeLog 首页">
          <Utensils size={20} />
          <span>tabeLog</span>
        </Link>
        <nav className="workspace-tabs" aria-label="主导航">
          <Link
            href="/menu"
            prefetch={false}
            aria-current={recipe ? "page" : undefined}
          >
            <ChefHat size={16} />
            <span>我的菜单</span>
          </Link>
          <Link
            href="/map"
            prefetch={false}
            aria-current={!recipe ? "page" : undefined}
          >
            <MapPin size={16} />
            <span>美食地图</span>
          </Link>
        </nav>
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
      <Panel
        snap={snap}
        onSnap={setSnap}
        viewport={viewport}
        label={recipe ? "我的菜单" : "店铺抽屉"}
        summary={`${filtered.length} ${recipe ? "道菜" : "家店"}`}
        toolbar={toolbar}
      >
        {scope === "mine" && !user && !demo ? (
          <AuthForm onSuccess={signedIn} registrationOpen={registrationOpen} />
        ) : (
          <>
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
      </Panel>
      {statisticsOpen && (
        <TasteStatistics
          items={filtered}
          kind={kind}
          demo={demo}
          onClose={() => setStatisticsOpen(false)}
          onOpen={(entry) => {
            setStatisticsOpen(false);
            setSelected(entry);
          }}
        />
      )}
      {drawOpen && (
        <MealDraw
          items={filtered}
          demo={demo}
          kind={kind}
          onLocate={(entry) => {
            setDrawOpen(false);
            focusStore(entry);
          }}
          onClose={() => setDrawOpen(false)}
          onOpen={(entry) => {
            setDrawOpen(false);
            setSelected(entry);
          }}
          onNew={() => {
            setDrawOpen(false);
            newEntry();
          }}
          onAdd={(dishes) => {
            setQuantities((current) => {
              const next = { ...current };
              for (const dish of dishes)
                if (source.some((e) => e.id === dish.id))
                  next[dish.id] = Math.min(20, (next[dish.id] || 0) + 1);
              return next;
            });
            setDrawOpen(false);
            notify(`已将 ${dishes.length} 道菜加入今日菜单。`);
          }}
        />
      )}
      {settingsOpen && (
        <ThemeSettings
          provider={provider}
          onProviderChange={changeProvider}
          onClose={() => setSettingsOpen(false)}
          onAISettings={() => {
            setSettingsOpen(false);
            openMenuTool("settings");
          }}
        />
      )}
      {studioOpen && user && (
        <MenuStudio
          key={user.id}
          initialTab={studioOpen}
          onClose={() => setStudioOpen(null)}
          onImported={recipesImported}
        />
      )}
      {sharingOpen && user && (
        <MenuSharing
          key={user.id}
          user={user}
          initialTab={sharingOpen}
          onClose={() => setSharingOpen(null)}
        />
      )}
      {authOpen && (
        <Modal
          title="我的美味账户"
          hideHeader
          onClose={() => setAuthOpen(false)}
        >
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
          onStats={(stats) => {
            setSelected((current) =>
              current ? { ...current, mealStats: stats } : null,
            );
            setEntries((current) =>
              current.map((entry) =>
                entry.id === selected.id
                  ? { ...entry, mealStats: stats }
                  : entry,
              ),
            );
          }}
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
