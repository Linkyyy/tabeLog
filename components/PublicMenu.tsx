"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChefHat,
  Clock3,
  LoaderCircle,
  Minus,
  Plus,
  ShoppingBag,
  Utensils,
} from "lucide-react";
import type { SharedMenu } from "@/lib/menu-types";
import { clientAPI } from "@/lib/client-api";
import Modal from "./Modal";
export default function PublicMenu({
  initialMenu,
  token,
}: {
  initialMenu: SharedMenu;
  token: string;
}) {
  const [menu, setMenu] = useState(initialMenu),
    [category, setCategory] = useState("全部"),
    [quantities, setQuantities] = useState<Record<string, number>>({}),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [closed, setClosed] = useState(false),
    [receipt, setReceipt] = useState<{ id: string } | null>(null);
  const [guestName, setGuestName] = useState(""),
    [table, setTable] = useState(""),
    [note, setNote] = useState("");
  const pending = useRef<{ signature: string; id: string } | null>(null);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  async function refreshMenu() {
    try {
      const { menu: next } = await clientAPI<{ menu: SharedMenu }>(
        `/api/menus/${token}`,
      );
      setMenu(next);
      setCategory((current) =>
        current === "全部" || next.dishes.some((d) => d.cuisine === current)
          ? current
          : "全部",
      );
      setClosed(false);
      setQuantities((old) =>
        Object.fromEntries(
          Object.entries(old).filter(([id]) =>
            next.dishes.some((d) => d.id === id),
          ),
        ),
      );
    } catch {
      setClosed(true);
    }
  }
  useEffect(() => {
    const timer = setInterval(refreshMenu, 30000);
    return () => clearInterval(timer);
  }, [token]);
  function change(id: string, delta: number) {
    if (busy) return;
    setReceipt(null);
    setQuantities((old) => {
      const next = { ...old };
      const count = Math.max(0, Math.min(20, (old[id] || 0) + delta));
      if (count) next[id] = count;
      else delete next[id];
      return next;
    });
  }
  const selected = menu.dishes.filter((d) => quantities[d.id]),
    count = selected.reduce((n, d) => n + quantities[d.id], 0);
  const categories = ["全部", ...new Set(menu.dishes.map((d) => d.cuisine))];
  const items = menu.dishes.filter(
    (d) => category === "全部" || d.cuisine === category,
  );
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = {
        guestName,
        table,
        note,
        items: selected.map((d) => ({
          entryId: d.id,
          quantity: quantities[d.id],
        })),
      };
      const signature = JSON.stringify(data);
      if (!pending.current || pending.current.signature !== signature)
        pending.current = { signature, id: crypto.randomUUID() };
      const result = await clientAPI<{ order: { id: string } }>(
        `/api/menus/${token}/orders`,
        "POST",
        { ...data, requestId: pending.current.id },
      );
      setReceipt(result.order);
      setQuantities({});
      setOpen(false);
      setNote("");
      pending.current = null;
    } catch (e) {
      setError((e as Error).message);
      await refreshMenu();
    } finally {
      setBusy(false);
    }
  }
  const quantity = (id: string, name: string) => (
    <div className="public-quantity" aria-label={`${name}的份数`}>
      {quantities[id] > 0 && (
        <>
          <button
            type="button"
            disabled={busy}
            aria-label={`减少一份 ${name}`}
            onClick={() => change(id, -1)}
          >
            <Minus size={16} />
          </button>
          <output>{quantities[id]}</output>
        </>
      )}
      <button
        className="public-plus"
        type="button"
        disabled={busy || (quantities[id] || 0) >= 20}
        aria-label={`加一份 ${name}`}
        onClick={() => change(id, 1)}
      >
        <Plus size={17} />
      </button>
    </div>
  );
  if (closed)
    return (
      <main className="menu-unavailable">
        <Utensils size={50} />
        <h1>菜单暂时无法打开</h1>
        <p>可能已关闭点餐，请联系主人确认。</p>
        <button className="button secondary" onClick={refreshMenu}>
          重新加载菜单
        </button>
      </main>
    );
  return (
    <main className="public-menu-app">
      <header className="public-menu-header">
        <span className="public-kitchen-icon">
          <ChefHat size={26} />
        </span>
        <div>
          <h1>{menu.title}</h1>
          <p>
            {menu.author}的小厨房 · {menu.dishes.length} 道拿手菜
          </p>
        </div>
        <a href="/" aria-label="tabeLog 首页">
          tabeLog
        </a>
      </header>
      {receipt && (
        <div className="order-receipt" role="status">
          <Check size={22} />
          <div>
            <strong>点餐已送达，等主人开饭啦</strong>
            <span>订单 #{receipt.id.slice(0, 8)}</span>
          </div>
          <button className="text-button" onClick={() => setReceipt(null)}>
            继续选菜
          </button>
        </div>
      )}
      <div className="public-menu-workspace">
        <nav className="public-categories" aria-label="点餐分类">
          {categories.map((c) => (
            <button
              key={c}
              className={category === c ? "active" : ""}
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
            >
              <span>
                {c === "全部"
                  ? "🍽️"
                  : c === "中餐"
                    ? "🍜"
                    : c === "甜点"
                      ? "🍰"
                      : "🥘"}
              </span>
              {c}
            </button>
          ))}
        </nav>
        <section className="public-dish-list" aria-label="点餐菜品">
          <div className="public-list-heading">
            <strong>{category === "全部" ? "今日可点" : category}</strong>
            <small>选好后提交给主人</small>
          </div>
          {items.length ? (
            items.map((d) => (
              <article className="public-dish" key={d.id}>
                {d.photo ? (
                  <img src={d.photo} alt={d.name} />
                ) : (
                  <div className="public-dish-cover">
                    <Utensils size={36} strokeWidth={1} />
                  </div>
                )}
                <div className="public-dish-copy">
                  <h2>{d.name}</h2>
                  <p>{d.description || "家常的味道，认真做给你。"}</p>
                  <span className="public-dish-facts">
                    <Clock3 size={12} />
                    {d.minutes ? `${d.minutes} 分钟` : "慢慢做"} · {d.servings}{" "}
                    人份 / 份
                  </span>
                  <div className="public-dish-bottom">
                    <small>{d.cuisine}</small>
                    {quantity(d.id, d.name)}
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="orders-empty">
              <Utensils size={38} />
              <h2>主人正在准备菜单</h2>
              <p>暂时没有可点菜品，请稍后再来。</p>
            </div>
          )}
          <p className="public-menu-note">
            家人朋友的小厨房 · 点餐后由主人确认准备
          </p>
        </section>
        <aside className="public-desktop-cart">
          <ShoppingBag size={24} />
          <h2>这一餐，吃这些</h2>
          {selected.length ? (
            <>
              {selected.map((d) => (
                <div className="public-cart-row" key={d.id}>
                  <span>{d.name}</span>
                  {quantity(d.id, d.name)}
                </div>
              ))}
              <button
                className="button primary"
                onClick={() => {
                  setError("");
                  setOpen(true);
                }}
              >
                选好了 · {count} 份<ArrowRight size={16} />
              </button>
            </>
          ) : (
            <p>点一下 +，把想吃的菜放进来。</p>
          )}
        </aside>
      </div>
      <footer className="public-cart-bar">
        <span className="public-cart-icon">
          <ShoppingBag size={25} />
          {count > 0 && <b>{count}</b>}
        </span>
        <div>
          <strong>
            {count
              ? `已选 ${selected.length} 道，共 ${count} 份`
              : "今天，想吃点什么？"}
          </strong>
          <small>
            {count ? "选好后，告诉主人你的称呼。" : "点击 +，选择喜欢的菜。"}
          </small>
        </div>
        <button
          disabled={!count}
          onClick={() => {
            setError("");
            setOpen(true);
          }}
        >
          选好了
          <ArrowRight size={16} />
        </button>
      </footer>
      {open && (
        <Modal
          title="确认你的点餐"
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <form
            className="feature-panel feature-stack order-checkout"
            onSubmit={submit}
          >
            <div className="checkout-items">
              {selected.map((d) => (
                <div key={d.id}>
                  <strong>{d.name}</strong>
                  {quantity(d.id, d.name)}
                </div>
              ))}
            </div>
            <p className="feature-note">
              共 {selected.length} 道菜，{count} 份；每份按菜谱标注的人份准备。
            </p>
            <label>
              怎么称呼你
              <input
                required
                maxLength={60}
                value={guestName}
                disabled={busy}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="例如：小林"
                autoComplete="nickname"
              />
            </label>
            <label>
              桌号 / 用餐位置（选填）
              <input
                maxLength={30}
                value={table}
                disabled={busy}
                onChange={(e) => setTable(e.target.value)}
                placeholder="例如：餐桌 1"
              />
            </label>
            <label>
              口味与忌口（选填）
              <textarea
                maxLength={1000}
                rows={3}
                value={note}
                disabled={busy}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例如：少辣、不放香菜；过敏请另外告知主人。"
              />
            </label>
            {error && (
              <p className="feature-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button primary"
              disabled={busy || !count || !guestName.trim()}
              type="submit"
            >
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Check size={16} />
              )}{" "}
              {busy ? "正在提交…" : "提交点餐"}
            </button>
            <p className="feature-note">
              无需登录。称呼、位置和备注仅菜单主人可见。
            </p>
          </form>
        </Modal>
      )}
    </main>
  );
}
