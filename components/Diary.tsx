"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowDownUp,
  ArrowRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Download,
  Heart,
  LayoutGrid,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Map as MapIcon,
  MapPin,
  Navigation,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  Utensils,
  X,
  Pencil,
  CalendarDays,
  Wallet,
  AlertCircle,
} from "lucide-react";
import type { Entry, Location, MapProvider } from "@/lib/types";
import { CUISINES, CURRENCIES } from "@/lib/types";
import { DEMO_ENTRIES } from "@/lib/demo";
import EntryForm from "./EntryForm";
import Modal from "./Modal";
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
function Logo() {
  return (
    <a href="/" className="brand" aria-label="tabeLog 美食日记首页">
      <span className="brand-mark">
        <Utensils size={22} strokeWidth={1.6} />
      </span>
      <span>
        tabe<span className="brand-log">Log</span>
        <small>私の、おいしい記録。</small>
      </span>
    </a>
  );
}
function Stars({ rating }: { rating: number }) {
  return (
    <span className="stars" aria-label={`${rating} 星`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          size={12}
          key={n}
          fill={n <= rating ? "currentColor" : "none"}
          className={n > rating ? "unfilled" : ""}
        />
      ))}
      <b>{rating.toFixed(1)}</b>
    </span>
  );
}
function FoodCover({
  entry,
  small = false,
}: {
  entry: Entry;
  small?: boolean;
}) {
  return (
    <div
      className={`food-cover cuisine-${CUISINES.indexOf(entry.cuisine)} ${small ? "small" : ""}`}
    >
      {entry.photos[0] ? (
        <img
          src={entry.photos[0].url}
          alt={`${entry.name}的美食照片`}
          loading="lazy"
        />
      ) : (
        <>
          <span className="cover-orbit orbit-one" />
          <span className="cover-orbit orbit-two" />
          <span className="food-emoji" aria-hidden="true">
            {icons[entry.cuisine] || "🍽️"}
          </span>
          <span className="cover-label">a little taste of happiness</span>
        </>
      )}
    </div>
  );
}
function EntryCard({
  entry,
  onOpen,
  onLocate,
}: {
  entry: Entry;
  onOpen: () => void;
  onLocate: () => void;
}) {
  return (
    <article className="entry-card">
      <button
        className="card-cover-button"
        onClick={onOpen}
        aria-label={`查看 ${entry.name}`}
      >
        <FoodCover entry={entry} />
        <span className="cuisine-pill">{entry.cuisine}</span>
        {entry.favorite && (
          <span className="card-heart">
            <Heart size={15} fill="currentColor" />
          </span>
        )}
        {entry.photos.length > 1 && (
          <span className="photo-count">{entry.photos.length} 张照片</span>
        )}
      </button>
      <div className="card-body">
        <div className="card-meta">
          <span>{entry.visitedAt.replaceAll("-", ".")}</span>
          <Stars rating={entry.rating} />
        </div>
        <button className="card-title" onClick={onOpen}>
          {entry.name}
        </button>
        <div className="card-address">
          <MapPin size={13} />
          <span>{entry.address || entry.city || "已标记地图位置"}</span>
        </div>
        <p className="card-review">
          {entry.review || "有些美味，不用太多言语。"}
        </p>
        <div className="card-footer">
          <span>
            {entry.price !== null ? (
              <>
                {CURRENCIES[entry.currency]}
                {entry.price.toLocaleString()}
                <small> / 人</small>
              </>
            ) : (
              <small>一餐一记</small>
            )}
          </span>
          <button onClick={onLocate} aria-label={`在地图查看 ${entry.name}`}>
            去地图看看 <Navigation size={12} />
          </button>
        </div>
      </div>
    </article>
  );
}
function EntryDetail({
  entry,
  demo,
  onClose,
  onEdit,
  onDelete,
}: {
  entry: Entry;
  demo: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const [index, setIndex] = useState(0),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const photo = entry.photos[index];
  return (
    <Modal title="美味的记忆" onClose={onClose}>
      <div className="detail-body">
        <div className="detail-cover">
          {photo ? (
            <img src={photo.url} alt={`${entry.name}的照片 ${index + 1}`} />
          ) : (
            <FoodCover entry={entry} />
          )}{" "}
          {entry.photos.length > 1 && (
            <>
              <button
                className="gallery-prev"
                aria-label="上一张照片"
                onClick={() =>
                  setIndex(
                    (index + entry.photos.length - 1) % entry.photos.length,
                  )
                }
              >
                <ChevronLeft />
              </button>
              <button
                className="gallery-next"
                aria-label="下一张照片"
                onClick={() => setIndex((index + 1) % entry.photos.length)}
              >
                <ChevronRight />
              </button>
              <span className="gallery-index">
                {index + 1} / {entry.photos.length}
              </span>
            </>
          )}
        </div>
        <div className="detail-content">
          <div className="detail-kicker">
            <span className="tag">{entry.cuisine}</span>
            {entry.city && <span>{entry.city}</span>}
            {entry.favorite && (
              <span className="favorite-text">
                <Heart size={14} fill="currentColor" />
                心头好
              </span>
            )}
          </div>
          <h2>{entry.name}</h2>
          <Stars rating={entry.rating} />
          <div className="detail-facts">
            <span>
              <CalendarDays size={15} />
              {entry.visitedAt}
            </span>
            {entry.price !== null && (
              <span>
                <Wallet size={15} />
                {CURRENCIES[entry.currency]}
                {entry.price} / 人
              </span>
            )}
          </div>
          <p className="detail-address">
            <MapPin size={16} />
            {entry.address ||
              `${entry.lat.toFixed(5)}, ${entry.lng.toFixed(5)}`}
          </p>
          <div className="detail-review">
            {entry.review || "这篇日记还没有写下文字。"}
          </div>
          <p className="detail-coordinates">
            WGS-84 · {entry.lat.toFixed(6)}, {entry.lng.toFixed(6)}
          </p>
          {demo ? (
            <p className="demo-detail-note">
              这是一条示例记录，不会保存到你的日记。
            </p>
          ) : (
            <div className="detail-actions">
              <button className="button secondary" onClick={onEdit}>
                <Pencil size={15} />
                编辑日记
              </button>
              <button
                className="text-button danger"
                onClick={() => setConfirm(true)}
              >
                <Trash2 size={15} />
                删除
              </button>
            </div>
          )}
          {confirm && (
            <div className="delete-confirm" role="alert">
              <strong>确定删除这篇日记？</strong>
              <p>文字和照片将一起删除，无法恢复。</p>
              <div>
                <button
                  className="button secondary"
                  onClick={() => setConfirm(false)}
                  disabled={busy}
                >
                  再想想
                </button>
                <button
                  className="button destructive"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await onDelete();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "删除失败");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? "正在删除…" : "确认删除"}
                </button>
              </div>
              {error && <p className="form-error">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
export default function Diary() {
  const [session, setSession] = useState<{
      local: boolean;
      passwordEnabled: boolean;
    } | null>(null),
    [loggedIn, setLoggedIn] = useState(false),
    [booting, setBooting] = useState(true),
    [fatal, setFatal] = useState("");
  const [password, setPassword] = useState(""),
    [loginError, setLoginError] = useState(""),
    [loggingIn, setLoggingIn] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]),
    [dataLoading, setDataLoading] = useState(false),
    [error, setError] = useState(""),
    [demo, setDemo] = useState(false);
  const [provider, setProvider] = useState<MapProvider>("osm"),
    [view, setView] = useState<"journal" | "map">("journal"),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("全部"),
    [favorites, setFavorites] = useState(false),
    [sort, setSort] = useState("date");
  const [selected, setSelected] = useState<Entry | null>(null),
    [editing, setEditing] = useState<Entry | undefined>(),
    [formOpen, setFormOpen] = useState(false),
    [initialLocation, setInitialLocation] = useState<Location | undefined>(),
    [mapFocus, setMapFocus] = useState<Location | null>(null),
    [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function notify(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  }
  async function loadEntries() {
    setDataLoading(true);
    setError("");
    try {
      const r = await fetch("/api/entries", { cache: "no-store" });
      const data = await r.json();
      if (r.status === 401) {
        setLoggedIn(false);
        return;
      }
      if (!r.ok) throw new Error(data.error);
      setEntries(data.entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法加载记录，请检查网络");
    } finally {
      setDataLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    fetch("/api/session", { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        if (active) {
          setSession(data);
          setLoggedIn(data.authenticated);
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
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);
  useEffect(() => {
    if (loggedIn) loadEntries();
  }, [loggedIn]);
  function changeProvider(v: MapProvider) {
    setProvider(v);
    localStorage.setItem("tabelog-map", v);
  }
  const source = demo ? DEMO_ENTRIES : entries;
  const filtered = useMemo(
    () =>
      source
        .filter(
          (e) =>
            (category === "全部" || e.cuisine === category) &&
            (!favorites || e.favorite) &&
            `${e.name} ${e.address} ${e.city} ${e.review}`
              .toLocaleLowerCase()
              .includes(query.toLocaleLowerCase().trim()),
        )
        .sort((a, b) =>
          sort === "rating"
            ? b.rating - a.rating || b.visitedAt.localeCompare(a.visitedAt)
            : b.visitedAt.localeCompare(a.visitedAt),
        ),
    [source, category, favorites, query, sort],
  );
  const cities = new Set(source.map((e) => e.city.trim()).filter(Boolean)).size;
  const average = source.length
    ? (source.reduce((s, e) => s + e.rating, 0) / source.length).toFixed(1)
    : "—";
  function newEntry(p?: Location) {
    setEditing(undefined);
    setInitialLocation(p);
    setFormOpen(true);
  }
  function saved(entry: Entry) {
    setEntries((v) => [entry, ...v.filter((e) => e.id !== entry.id)]);
    setFormOpen(false);
    setEditing(undefined);
    setSelected(null);
    setDemo(false);
    setCategory("全部");
    setFavorites(false);
    setQuery("");
    notify("这份美味，已经好好收藏。");
  }
  function locate(entry: Entry) {
    setView("map");
    setMapFocus({ lat: entry.lat, lng: entry.lng });
  }
  async function remove() {
    if (!selected) return;
    const r = await fetch(`/api/entries/${selected.id}`, { method: "DELETE" });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    setEntries((v) => v.filter((e) => e.id !== selected.id));
    setSelected(null);
    notify("日记已删除");
  }
  function exportDiary() {
    const data = JSON.stringify(
      { app: "tabeLog", exportedAt: new Date().toISOString(), entries: source },
      null,
      2,
    );
    const url = URL.createObjectURL(
      new Blob([data], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `tabelog-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify("文字与坐标已导出；照片请另外保存。");
  }
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError("");
    try {
      const r = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setPassword("");
      setLoggedIn(true);
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : "登录失败");
    } finally {
      setLoggingIn(false);
    }
  }
  async function logout() {
    try {
      const r = await fetch("/api/session", { method: "DELETE" });
      if (!r.ok) throw new Error();
      setEntries([]);
      setSelected(null);
      setLoggedIn(false);
      setDemo(false);
    } catch {
      notify("退出失败，请重试");
    }
  }
  if (booting)
    return (
      <main className="boot-screen">
        <Logo />
        <LoaderCircle size={25} className="spin" />
        <p>把美好的味道，慢慢收集。</p>
      </main>
    );
  if (fatal)
    return (
      <main className="login-page">
        <Logo />
        <div className="login-card">
          <AlertCircle size={32} />
          <h1>还差一点，就能开饭。</h1>
          <p>{fatal}</p>
          <p>请检查环境变量，并运行数据库初始化脚本。</p>
          <button
            className="button secondary"
            onClick={() => window.location.reload()}
          >
            重新检查
          </button>
        </div>
      </main>
    );
  if (!loggedIn)
    return (
      <main className="login-page">
        <Logo />
        <div className="login-decoration">
          おいしい
          <br />
          <span>日常を、記録する。</span>
        </div>
        <form className="login-card" onSubmit={login}>
          <span className="login-icon">
            <LockKeyhole size={27} />
          </span>
          <span className="eyebrow">YOUR PRIVATE FOOD JOURNAL</span>
          <h1>
            欢迎回到
            <br />
            你的美味日常。
          </h1>
          <p>每一顿认真吃的饭，都值得被记住。</p>
          <label>
            日记密码
            <input
              autoFocus
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入你的私人密码"
              maxLength={256}
            />
          </label>
          {loginError && (
            <p className="form-error" role="alert">
              {loginError}
            </p>
          )}
          <button className="button primary" disabled={loggingIn}>
            {loggingIn ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <>
                打开我的日记 <ArrowRight size={17} />
              </>
            )}
          </button>
          <small>
            <LockKeyhole size={12} />
            只属于你的，一餐一记。
          </small>
        </form>
        <footer>tabeLog · 美食日记</footer>
      </main>
    );
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Logo />
          <nav aria-label="主导航">
            <button
              title="我的日记"
              className={view === "journal" ? "nav-link active" : "nav-link"}
              onClick={() => setView("journal")}
            >
              <BookOpen size={17} />
              我的日记
            </button>
            <button
              title="美食地图"
              className={view === "map" ? "nav-link active" : "nav-link"}
              onClick={() => setView("map")}
            >
              <MapIcon size={17} />
              美食地图
            </button>
          </nav>
          <div className="header-actions">
            <span className="private-badge">
              <LockKeyhole size={12} />
              {session?.local ? "本地日记" : "私人空间"}
            </span>
            {session?.passwordEnabled && (
              <button
                className="icon-button"
                aria-label="退出登录"
                onClick={logout}
              >
                <LogOut size={17} />
              </button>
            )}
            <button
              className="button primary header-add"
              onClick={() => newEntry()}
            >
              <Plus size={17} />
              <span>记一笔</span>
            </button>
          </div>
        </div>
      </header>
      <main className="page-wrap">
        <section className="journal-hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="tiny-line" /> TASTE. REMEMBER. REPEAT.
            </div>
            <h1>
              好好吃饭，
              <br />
              <span>慢慢记录。</span>
              <span className="hero-period">✳</span>
            </h1>
            <p>
              把路过的城市、喜欢的小店，和每一口心动，
              <br className="desktop-break" />
              都收藏进自己的美食地图。
            </p>
            <div className="hero-bottom">
              <span className="hero-signature">一餐一记，一味一忆。</span>
              <button
                className="text-button"
                aria-label={demo ? "结束示例漫游" : "浏览示例日记"}
                onClick={() => {
                  setDemo(!demo);
                  setCategory("全部");
                  setFavorites(false);
                  setQuery("");
                }}
              >
                {demo ? "回到我的日记" : "随便逛逛 · 示例日记"}
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-label">
              THE LITTLE THINGS
              <br />
              THAT TASTE LIKE LIFE.
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
              <span>おいしい</span>
              <strong>日常</strong>
              <span>GOOD FOOD, GOOD MOOD</span>
            </div>
            <span className="art-spark spark-one">✳</span>
            <span className="art-spark spark-two">+</span>
            <span className="art-note">made of little happy moments ↗</span>
          </div>
        </section>
        <section className="stats-row" aria-label="我的美食统计">
          <div className="stat">
            <span className="stat-icon">
              <Utensils size={20} />
            </span>
            <div>
              <strong>{source.length.toString().padStart(2, "0")}</strong>
              <span>篇美味日记</span>
            </div>
          </div>
          <div className="stat">
            <span className="stat-icon">
              <MapPin size={20} />
            </span>
            <div>
              <strong>{cities.toString().padStart(2, "0")}</strong>
              <span>座城市足迹</span>
            </div>
          </div>
          <div className="stat">
            <span className="stat-icon">
              <Heart size={20} />
            </span>
            <div>
              <strong>
                {source
                  .filter((e) => e.favorite)
                  .length.toString()
                  .padStart(2, "0")}
              </strong>
              <span>家心头好</span>
            </div>
          </div>
          <div className="stat">
            <span className="stat-icon">
              <Star size={20} />
            </span>
            <div>
              <strong>{average}</strong>
              <span>分平均满意度</span>
            </div>
          </div>
          <span className="stats-note">
            美味有迹可循 <Sparkles size={15} />
          </span>
        </section>
        <section className="journal-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">MY TASTY COLLECTION</span>
              <h2>
                {view === "journal" ? "美味手帖" : "我的美食足迹"}
                <span>{source.length}</span>
              </h2>
            </div>
            <div className="section-actions">
              <button
                className="icon-button export-button"
                onClick={exportDiary}
                disabled={!source.length}
                title="导出日记文字与坐标"
                aria-label="导出日记"
              >
                <Download size={17} />
              </button>
              <div className="view-switch" aria-label="浏览方式">
                <button
                  onClick={() => setView("journal")}
                  className={view === "journal" ? "selected" : ""}
                  aria-label="卡片视图"
                  aria-pressed={view === "journal"}
                >
                  <LayoutGrid size={16} />
                  <span>手帖</span>
                </button>
                <button
                  onClick={() => setView("map")}
                  className={view === "map" ? "selected" : ""}
                  aria-label="地图视图"
                  aria-pressed={view === "map"}
                >
                  <MapIcon size={16} />
                  <span>地图</span>
                </button>
              </div>
            </div>
          </div>
          {demo && (
            <div className="demo-banner">
              <Sparkles size={16} />
              <span>你正在浏览示例日记，内容不会保存到你的账户。</span>
              <button onClick={() => setDemo(false)}>
                回到我的日记 <X size={14} />
              </button>
            </div>
          )}
          <div className="collection-toolbar">
            <div className="search-box">
              <Search size={17} />
              <input
                aria-label="搜索日记"
                placeholder="找一家店，或一种味道…"
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
            <label className="sort-select">
              <ArrowDownUp size={14} />
              <select
                aria-label="日记排序"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="date">最近到店</option>
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
          {dataLoading && !demo ? (
            <div className="loading-state">
              <LoaderCircle className="spin" />
              <p>正在翻开你的日记…</p>
            </div>
          ) : view === "map" ? (
            <div className="map-layout">
              <div className="map-sidebar">
                <div className="map-list-heading">
                  <strong>地图上的美味</strong>
                  <span>{filtered.length} 家店</span>
                </div>
                {filtered.length ? (
                  filtered.map((e) => (
                    <button
                      className={`map-list-item ${selected?.id === e.id ? "selected" : ""}`}
                      key={e.id}
                      onClick={() => {
                        setMapFocus({ lat: e.lat, lng: e.lng });
                        setSelected(e);
                      }}
                    >
                      <FoodCover entry={e} small />
                      <div>
                        <strong>{e.name}</strong>
                        <span>
                          {e.city || "已标记位置"} · {e.cuisine}
                        </span>
                        <Stars rating={e.rating} />
                      </div>
                      <ChevronRight size={16} />
                    </button>
                  ))
                ) : (
                  <div className="map-empty">
                    <MapPin size={26} />
                    <p>这里还没有记录</p>
                    <span>点击地图，开始你的美食足迹。</span>
                  </div>
                )}
                <div className="map-list-tip">
                  <MapPin size={14} />
                  点击地图空白处，可以记录一家新店。
                </div>
              </div>
              <div className="main-map">
                <MapView
                  entries={filtered}
                  selectedId={selected?.id}
                  focus={mapFocus}
                  provider={provider}
                  onProviderChange={changeProvider}
                  onSelect={(id) =>
                    setSelected(filtered.find((e) => e.id === id) || null)
                  }
                  pickMode
                  onPick={(p) => newEntry(p)}
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
                <strong>下一站，吃什么？</strong>
                <p>把新的美味，也记在这里。</p>
                <span className="add-card-action">
                  写一篇日记 <ArrowRight size={14} />
                </span>
              </button>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-illustration">
                <BookOpen size={43} strokeWidth={1.2} />
                <span>✳</span>
                <Coffee size={21} />
              </div>
              <span className="eyebrow">A BLANK PAGE, A NEW TASTE</span>
              <h3>
                {source.length
                  ? "还没找到这份美味"
                  : "第一口心动，从这里开始。"}
              </h3>
              <p>
                {source.length
                  ? "换个关键词或分类，再找找看。"
                  : "记下喜欢的店、拍下好吃的菜，\n让美好的味道，有迹可循。"}
              </p>
              {source.length ? (
                <button
                  className="button secondary"
                  onClick={() => {
                    setQuery("");
                    setCategory("全部");
                    setFavorites(false);
                  }}
                >
                  清除筛选
                </button>
              ) : (
                <div className="empty-actions">
                  <button className="button primary" onClick={() => newEntry()}>
                    <Plus size={17} />
                    写下第一篇日记
                  </button>
                  <button className="text-button" onClick={() => setDemo(true)}>
                    先看看示例
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="collection-bottom">
            <span>
              {filtered.length > 0
                ? `已经翻完 ${filtered.length} 份美味记忆`
                : "等一顿好饭，也等一个好故事"}
            </span>
            <span>生活的滋味，要慢慢尝。</span>
          </div>
        </section>
        <section className="bottom-note">
          <span>“</span>
          <p>
            不必每一餐都盛大，
            <br />
            <strong>但每一餐，都可以被好好记住。</strong>
          </p>
          <div>
            WITH LOVE & A GOOD APPETITE
            <Utensils size={19} />
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <span>
          <b>tabeLog</b> · 美食日记
        </span>
        <span>把日子过成喜欢的味道。</span>
        <span>
          <LockKeyhole size={12} />
          {session?.local
            ? "本地存储 · 仅当前开发环境"
            : "私人日记 · Cloudflare 安全存储"}
        </span>
      </footer>
      {formOpen && (
        <EntryForm
          entry={editing}
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
