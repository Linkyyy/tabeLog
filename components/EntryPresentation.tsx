"use client";
import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Heart,
  MapPin,
  Navigation,
  Star,
  Trash2,
  Utensils,
  Pencil,
  CalendarDays,
  Wallet,
} from "lucide-react";
import type { Entry } from "@/lib/types";
import { CUISINES, CURRENCIES } from "@/lib/types";
import Modal from "./Modal";
const icons: Record<string, string> = {
  日料: "🍣",
  中餐: "🍜",
  西餐: "🍝",
  咖啡: "☕",
  甜点: "🍵",
  小吃: "🥟",
  其他: "🍽️",
};
export function Logo() {
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
export function Stars({ rating }: { rating: number }) {
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
export function FoodCover({
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
export function EntryCard({
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
        <div className="entry-byline">
          <span>{entry.authorName}</span>
          <span className={`visibility-badge ${entry.visibility}`}>
            {entry.visibility === "public" ? "公开" : "私人"}
          </span>
        </div>
        <div className="card-meta">
          <span>{entry.visitedAt.replaceAll("-", ".")}</span>
          <Stars rating={entry.rating} />
        </div>
        <button className="card-title" onClick={onOpen}>
          {entry.name}
        </button>
        <div className="card-address">
          <MapPin size={13} />
          <span>
            {entry.kind === "recipe"
              ? `${entry.recipe?.difficulty} · ${entry.recipe?.servings} 人份${entry.recipe?.minutes ? ` · ${entry.recipe.minutes} 分钟` : ""}`
              : entry.address || entry.city || "已标记地图位置"}
          </span>
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
          {entry.kind === "recipe" ? (
            <button onClick={onOpen} aria-label={`查看菜谱 ${entry.name}`}>
              看看做法 <BookOpen size={12} />
            </button>
          ) : (
            <button onClick={onLocate} aria-label={`在地图查看 ${entry.name}`}>
              去地图看看 <Navigation size={12} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
export function EntryDetail({
  entry,
  demo,
  onClose,
  onEdit,
  onDelete,
  canEdit = false,
}: {
  entry: Entry;
  demo: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  canEdit?: boolean;
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
          {entry.kind !== "recipe" && (
            <p className="detail-address">
              <MapPin size={16} />
              {entry.address ||
                `${entry.lat.toFixed(5)}, ${entry.lng.toFixed(5)}`}
            </p>
          )}
          <div className="detail-author">
            {entry.authorName} ·{" "}
            <span className={`visibility-badge ${entry.visibility}`}>
              {entry.visibility === "public" ? "公开分享" : "私人收藏"}
            </span>
          </div>
          {entry.kind === "recipe" && entry.recipe && (
            <RecipeContent entry={entry} />
          )}
          <div className="detail-review">
            {entry.review || "这篇日记还没有写下文字。"}
          </div>
          {entry.kind !== "recipe" && (
            <p className="detail-coordinates">
              WGS-84 · {entry.lat.toFixed(6)}, {entry.lng.toFixed(6)}
            </p>
          )}
          {!demo && entry.visibility === "public" && (
            <a
              className="text-button share-link"
              href={`/share/${entry.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              打开公开分享页 <ArrowRight size={14} />
            </a>
          )}
          {demo ? (
            <p className="demo-detail-note">
              这是一条示例记录，不会保存到你的日记。
            </p>
          ) : canEdit ? (
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
          ) : null}
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

export function RecipeContent({ entry }: { entry: Entry }) {
  const r = entry.recipe;
  if (!r) return null;
  return (
    <section className="recipe-content">
      <div className="recipe-facts">
        <span>⏱ {r.minutes ? `${r.minutes} 分钟` : "慢慢来"}</span>
        <span>♧ {r.servings} 人份</span>
        <span>✳ {r.difficulty}</span>
      </div>
      <h3>
        食材清单 <small>INGREDIENTS</small>
      </h3>
      <ul className="ingredients-list">
        {r.ingredients
          .split("\n")
          .filter((s) => s.trim())
          .map((line, i) => (
            <li key={i}>{line}</li>
          ))}
      </ul>
      <h3>
        一起下厨 <small>LET’S COOK</small>
      </h3>
      <ol className="recipe-steps">
        {r.steps
          .split("\n")
          .filter((s) => s.trim())
          .map((line, i) => (
            <li key={i}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <p>{line.replace(/^\s*\d+[.、)\s]+/, "")}</p>
            </li>
          ))}
      </ol>
    </section>
  );
}
