"use client";
import { useCallback, useEffect, useState } from "react";
import {
  ClipboardList,
  Copy,
  Download,
  ExternalLink,
  LoaderCircle,
  QrCode,
  RefreshCw,
} from "lucide-react";
import { clientAPI } from "@/lib/client-api";
import {
  ORDER_STATUS,
  type MenuOrder,
  type MenuShare,
  type OrderStatus,
} from "@/lib/menu-types";
import type { Entry, User } from "@/lib/types";
import Modal from "./Modal";
export default function MenuSharing({
  user,
  onClose,
  initialTab = "share",
}: {
  user: User;
  onClose: () => void;
  initialTab?: "share" | "orders";
}) {
  const [tab, setTab] = useState(initialTab),
    [entries, setEntries] = useState<Entry[]>([]),
    [share, setShare] = useState<MenuShare | null>(null),
    [ids, setIds] = useState<string[]>([]),
    [title, setTitle] = useState(`${user.name}的菜单`);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [orders, setOrders] = useState<MenuOrder[]>([]),
    [qr, setQr] = useState(""),
    [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([
      clientAPI<{ entries: Entry[] }>("/api/entries?scope=mine"),
      clientAPI<{ share: MenuShare | null }>("/api/menu-share"),
    ])
      .then(([e, s]) => {
        if (!active) return;
        const recipes = e.entries.filter((e) => e.kind === "recipe");
        setEntries(recipes);
        setShare(s.share);
        if (s.share) {
          setTitle(s.share.title);
          setIds(
            s.share.entryIds.filter((id) =>
              recipes.some((e) => e.id === id && e.visibility === "public"),
            ),
          );
        } else
          setIds(
            recipes.filter((e) => e.visibility === "public").map((e) => e.id),
          );
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
  useEffect(() => {
    let active = true;
    setQr("");
    setUrl("");
    if (share?.enabled) {
      const link = new URL(`/menu/${share.token}`, window.location.origin).href;
      setUrl(link);
      import("qrcode")
        .then((q) =>
          q.toDataURL(link, {
            width: 1024,
            margin: 4,
            errorCorrectionLevel: "M",
            color: { dark: "#17252b", light: "#ffffff" },
          }),
        )
        .then((image) => {
          if (active) setQr(image);
        })
        .catch(() => {
          if (active)
            setError("二维码生成失败，请重新打开；仍可复制点餐链接。");
        });
    }
    return () => {
      active = false;
    };
  }, [share?.enabled, share?.token]);
  const loadOrders = useCallback(async () => {
    try {
      const data = await clientAPI<{ orders: MenuOrder[] }>("/api/menu-orders");
      setOrders(data.orders);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    if (tab !== "orders") return;
    loadOrders();
    const id = setInterval(loadOrders, 15000);
    return () => clearInterval(id);
  }, [tab, loadOrders]);
  async function save(rotate = false) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await clientAPI<{ share: MenuShare }>(
        "/api/menu-share",
        "PUT",
        { title, entryIds: ids, rotate },
      );
      setShare(data.share);
      setMessage(
        rotate
          ? "已更换二维码，旧链接立即失效。"
          : "点餐菜单已更新，可以分享二维码了。",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function disable() {
    setBusy(true);
    setError("");
    try {
      await clientAPI("/api/menu-share", "DELETE");
      setShare((old) => (old ? { ...old, enabled: false } : old));
      setMessage("已关闭扫码点餐，旧链接无法查看或下单。");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function changeStatus(id: string, status: OrderStatus) {
    setBusy(true);
    setError("");
    try {
      await clientAPI(`/api/menu-orders/${id}`, "PATCH", { status });
      await loadOrders();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="我的点餐台" wide onClose={onClose}>
      <div className="feature-panel menu-sharing">
        <nav className="feature-tabs" aria-label="点餐管理">
          <button
            className={tab === "share" ? "active" : ""}
            aria-pressed={tab === "share"}
            onClick={() => {
              setTab("share");
              setError("");
            }}
          >
            <QrCode size={16} />
            分享菜单
          </button>
          <button
            className={tab === "orders" ? "active" : ""}
            aria-pressed={tab === "orders"}
            onClick={() => {
              setTab("orders");
              setError("");
            }}
          >
            <ClipboardList size={16} />
            点餐订单
          </button>
        </nav>
        {error && (
          <p className="feature-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="feature-message" role="status">
            {message}
          </p>
        )}
        {tab === "share" ? (
          loading ? (
            <p className="feature-loading">
              <LoaderCircle className="spin" size={18} />
              正在准备菜单…
            </p>
          ) : (
            <div className="share-layout">
              <div className="feature-stack">
                <div className="feature-intro">
                  <h3>让朋友来点菜</h3>
                  <p>选好公开菜品，导出二维码，扫码即可选菜并提交给你。</p>
                </div>
                <label>
                  点餐菜单名称
                  <input
                    maxLength={60}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <div className="share-dish-heading">
                  <strong>选择分享的菜品</strong>
                  <span>已选 {ids.length} 道</span>
                </div>
                <div className="share-dish-list">
                  {entries.length ? (
                    entries.map((e) => (
                      <label
                        key={e.id}
                        className={`share-dish ${e.visibility === "private" ? "is-private" : ""}`}
                      >
                        <input
                          type="checkbox"
                          aria-label={`分享 ${e.name}`}
                          disabled={busy || e.visibility !== "public"}
                          checked={ids.includes(e.id)}
                          onChange={(event) =>
                            setIds((old) =>
                              event.target.checked
                                ? [...old, e.id]
                                : old.filter((id) => id !== e.id),
                            )
                          }
                        />
                        {e.photos[0] ? (
                          <img src={e.photos[0].url} alt="" />
                        ) : (
                          <span className="share-dish-placeholder">🍽️</span>
                        )}
                        <span>
                          <strong>{e.name}</strong>
                          <small>
                            {e.cuisine} ·{" "}
                            {e.visibility === "public"
                              ? "公开菜品"
                              : "私人菜品，请先在菜谱中改为公开"}
                          </small>
                        </span>
                      </label>
                    ))
                  ) : (
                    <p className="feature-note">
                      还没有菜谱，先手动记录或使用 AI 生成几道菜吧。
                    </p>
                  )}
                </div>
                <button
                  className="button primary"
                  disabled={busy || !ids.length || !title.trim()}
                  onClick={() => save()}
                >
                  {busy ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <QrCode size={16} />
                  )}{" "}
                  {share?.enabled ? "更新点餐菜单" : "开启扫码点餐"}
                </button>
                <p className="feature-note">
                  仅展示选中的公开菜品。菜谱改为私人或删除后，会自动从点餐菜单移除。
                </p>
              </div>
              <aside className="qr-preview">
                {share?.enabled ? (
                  <>
                    <span className="qr-status">扫码点餐已开启</span>
                    <h3>{share.title}</h3>
                    {qr ? (
                      <img className="menu-qr" src={qr} alt="菜单点餐二维码" />
                    ) : (
                      <div className="qr-placeholder">
                        <LoaderCircle className="spin" />
                      </div>
                    )}
                    <p>扫码选菜 · 无需注册</p>
                    <a
                      className={`button primary ${qr ? "" : "disabled"}`}
                      href={qr || undefined}
                      download="tabelog-menu-qr.png"
                    >
                      <Download size={16} />
                      下载二维码 PNG
                    </a>
                    <div className="qr-links">
                      <button
                        className="text-button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(url);
                            setMessage("点餐链接已复制。");
                          } catch {
                            setError("复制失败，请长按下方链接复制。");
                          }
                        }}
                      >
                        <Copy size={14} />
                        复制链接
                      </button>
                      <a
                        className="text-button"
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink size={14} />
                        打开菜单
                      </a>
                    </div>
                    <input
                      aria-label="点餐链接"
                      className="share-url"
                      value={url}
                      readOnly
                      onFocus={(e) => e.target.select()}
                    />
                    <div className="qr-management">
                      <button
                        className="text-button"
                        disabled={busy || !ids.length}
                        onClick={() => save(true)}
                      >
                        更换二维码
                      </button>
                      <button
                        className="text-button danger"
                        disabled={busy}
                        onClick={disable}
                      >
                        关闭扫码点餐
                      </button>
                    </div>
                    <small>
                      更新菜品沿用当前二维码；更换二维码会使旧链接失效。
                    </small>
                  </>
                ) : (
                  <div className="qr-empty">
                    <QrCode size={84} strokeWidth={1} />
                    <h3>你的专属点餐二维码</h3>
                    <p>选好菜品并开启点餐后，就可以下载分享。</p>
                  </div>
                )}
              </aside>
            </div>
          )
        ) : (
          <section className="orders-panel">
            <div className="preview-heading">
              <div>
                <h3>收到的点餐</h3>
                <p>每 15 秒自动刷新 · 显示最近 100 单</p>
              </div>
              <button
                className="button secondary"
                disabled={busy}
                onClick={loadOrders}
              >
                <RefreshCw size={15} />
                刷新订单
              </button>
            </div>
            {orders.length ? (
              orders.map((order) => (
                <article className="received-order" key={order.id}>
                  <div className="order-heading">
                    <div>
                      <strong>{order.guestName}</strong>
                      {order.table && <span> · {order.table}</span>}
                      <small>
                        {new Date(order.createdAt).toLocaleString("zh-CN")} · #
                        {order.id.slice(0, 8)}
                      </small>
                    </div>
                    <span className={`order-status ${order.status}`}>
                      {ORDER_STATUS[order.status]}
                    </span>
                  </div>
                  <ul>
                    {order.items.map((item) => (
                      <li key={item.entryId}>
                        <span>{item.name}</span>
                        <strong>× {item.quantity}</strong>
                      </li>
                    ))}
                  </ul>
                  {order.note && (
                    <p className="order-note">备注：{order.note}</p>
                  )}
                  <div className="order-actions">
                    {order.status === "pending" && (
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() => changeStatus(order.id, "accepted")}
                      >
                        接单，开始准备
                      </button>
                    )}
                    {order.status === "accepted" && (
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() => changeStatus(order.id, "completed")}
                      >
                        标记已完成
                      </button>
                    )}
                    {["pending", "accepted"].includes(order.status) && (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => changeStatus(order.id, "cancelled")}
                      >
                        取消订单
                      </button>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <div className="orders-empty">
                <ClipboardList size={42} strokeWidth={1.2} />
                <h3>等待第一份点餐</h3>
                <p>分享二维码后，朋友提交的菜品会出现在这里。</p>
              </div>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
}
