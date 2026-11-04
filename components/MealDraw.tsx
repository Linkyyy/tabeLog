"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Dices,
  LoaderCircle,
  Plus,
  RotateCcw,
  Utensils,
  Heart,
  MapPin,
} from "lucide-react";
import type { Entry } from "@/lib/types";
import { drawDishes } from "@/lib/draw";
import { FoodCover } from "./EntryPresentation";
import Modal from "./Modal";
export default function MealDraw({
  items,
  demo,
  onClose,
  onAdd,
  onOpen,
  onNew,
  kind = "recipe",
  onLocate,
}: {
  items: Entry[];
  demo: boolean;
  onClose: () => void;
  onAdd: (entries: Entry[]) => void;
  onOpen: (entry: Entry) => void;
  onNew: () => void;
  kind?: Entry["kind"];
  onLocate?: (entry: Entry) => void;
}) {
  const [count, setCount] = useState(1),
    [drawing, setDrawing] = useState(false),
    [results, setResults] = useState<Entry[]>([]);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const visiting = kind === "visit";
  const pool = favoriteOnly ? items.filter((e) => e.favorite) : items;
  const drawCount = visiting ? 1 : Math.min(count, pool.length || 1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function draw() {
    if (drawing || !pool.length) return;
    setDrawing(true);
    timer.current = setTimeout(() => {
      setResults(drawDishes(pool, drawCount));
      setDrawing(false);
    }, 850);
  }
  return (
    <Modal title={visiting ? "今天去哪吃" : "今天吃什么"} onClose={onClose}>
      <div
        className={`meal-draw feature-panel ${results.length ? "has-results" : ""}`}
      >
        <div
          className={`draw-hero ${drawing ? "is-drawing" : ""}`}
          aria-hidden="true"
        >
          <span>✦</span>
          <Dices size={46} strokeWidth={1.4} />
          <span>✧</span>
        </div>
        <div className="draw-intro">
          <h3>把选择，交给一点小惊喜。</h3>
          <p>
            {pool.length
              ? `从当前筛选的 ${pool.length} ${visiting ? "家" : "道"}${demo ? "示例" : ""}${visiting ? "店铺" : "菜谱"}${favoriteOnly ? "心头好" : ""}中抽取${visiting ? "。" : "，每次不会重复。"}`
              : favoriteOnly
                ? `当前没有收藏的${visiting ? "店铺" : "菜谱"}，先标记心头好，或选择随机吃。`
                : `当前没有可抽取的${visiting ? "店铺" : "菜谱"}，先添加记录或调整筛选吧。`}
          </p>
        </div>
        <div className="draw-sources" role="group" aria-label="抽签范围">
          <button
            type="button"
            aria-label="随机吃"
            aria-pressed={!favoriteOnly}
            disabled={drawing}
            onClick={() => {
              setFavoriteOnly(false);
              setResults([]);
            }}
          >
            <Dices size={15} />
            随机吃<small>{items.length}</small>
          </button>
          <button
            type="button"
            aria-label="收藏里吃"
            aria-pressed={favoriteOnly}
            disabled={drawing}
            onClick={() => {
              setFavoriteOnly(true);
              setResults([]);
            }}
          >
            <Heart size={15} />
            收藏里吃<small>{items.filter((e) => e.favorite).length}</small>
          </button>
        </div>
        {pool.length > 0 ? (
          <>
            {!visiting && (
              <fieldset className="draw-count" disabled={drawing}>
                <legend>这一餐，抽几道？</legend>
                {[1, 2, 3].map((n) => (
                  <label key={n} className={drawCount === n ? "active" : ""}>
                    <input
                      type="radio"
                      name="draw-count"
                      aria-label={`抽 ${n} 道菜`}
                      checked={drawCount === n}
                      disabled={n > pool.length}
                      onChange={() => {
                        setCount(n);
                        setResults([]);
                      }}
                    />
                    {n} 道菜
                  </label>
                ))}
              </fieldset>
            )}
            <div className="draw-live" role="status" aria-live="polite">
              {drawing
                ? "正在抽签，看看今天的好味道…"
                : results.length
                  ? visiting
                    ? "抽签完成，今天就去这家。"
                    : `抽签完成，今天就吃这 ${results.length} 道。`
                  : "准备好了吗？"}
            </div>
            {!drawing && results.length > 0 && (
              <ul className="draw-results" aria-label="抽签结果">
                {results.map((entry) => (
                  <li key={entry.id}>
                    <FoodCover entry={entry} />
                    <div>
                      <h3>{entry.name}</h3>
                      <p>
                        {entry.cuisine} ·{" "}
                        {visiting
                          ? entry.city || entry.address || "地图已记录位置"
                          : entry.recipe?.minutes
                            ? `${entry.recipe.minutes} 分钟`
                            : "慢慢做"}
                      </p>
                      <button
                        className="text-button"
                        onClick={() => onOpen(entry)}
                      >
                        {visiting ? "查看日记" : "查看做法"}
                        <ArrowRight size={13} />
                      </button>
                    </div>
                    <Check size={17} />
                  </li>
                ))}
              </ul>
            )}
            <div
              className={`draw-actions ${results.length ? "has-results" : ""}`}
            >
              <button
                className={`button ${results.length ? "secondary" : "primary"} draw-start`}
                disabled={drawing}
                onClick={draw}
              >
                {drawing ? (
                  <LoaderCircle className="spin" size={18} />
                ) : results.length ? (
                  <RotateCcw size={17} />
                ) : (
                  <Dices size={18} />
                )}{" "}
                {drawing ? "抽签中…" : results.length ? "再抽一次" : "开始抽签"}
              </button>
              {!drawing && results.length > 0 && (
                <button
                  className="button primary draw-add"
                  onClick={() =>
                    visiting ? onLocate?.(results[0]) : onAdd(results)
                  }
                >
                  {visiting ? <MapPin size={17} /> : <Plus size={17} />}
                  {visiting ? "去这家店" : "加入今日菜单"}
                </button>
              )}
            </div>
            <p className="feature-note">
              {visiting
                ? "按当前店铺列表筛选，收藏里吃只抽标记心头好的店铺；抽到后可以直接定位。"
                : "按当前菜谱列表筛选，收藏里吃只抽标记心头好的菜谱。抽签不会修改保存的内容。"}
            </p>
          </>
        ) : (
          <button
            className="button primary draw-start"
            onClick={favoriteOnly ? onClose : onNew}
          >
            <Utensils size={16} />
            {favoriteOnly
              ? "返回列表挑选"
              : visiting
                ? "去记录一家店"
                : "去添加菜谱"}
          </button>
        )}
      </div>
    </Modal>
  );
}
