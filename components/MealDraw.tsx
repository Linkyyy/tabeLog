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
}: {
  items: Entry[];
  demo: boolean;
  onClose: () => void;
  onAdd: (entries: Entry[]) => void;
  onOpen: (entry: Entry) => void;
  onNew: () => void;
}) {
  const [count, setCount] = useState(1),
    [drawing, setDrawing] = useState(false),
    [results, setResults] = useState<Entry[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function draw() {
    if (drawing || !items.length) return;
    setDrawing(true);
    timer.current = setTimeout(() => {
      setResults(drawDishes(items, Math.min(count, items.length)));
      setDrawing(false);
    }, 850);
  }
  return (
    <Modal title="今天吃什么" onClose={onClose}>
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
            {items.length
              ? `从当前筛选的 ${items.length} 道${demo ? "示例" : ""}菜谱中抽取，每次不会重复。`
              : "当前没有可抽取的菜谱，先添加菜谱或调整筛选吧。"}
          </p>
        </div>
        {items.length > 0 ? (
          <>
            <fieldset className="draw-count" disabled={drawing}>
              <legend>这一餐，抽几道？</legend>
              {[1, 2, 3].map((n) => (
                <label key={n} className={count === n ? "active" : ""}>
                  <input
                    type="radio"
                    name="draw-count"
                    aria-label={`抽 ${n} 道菜`}
                    checked={count === n}
                    disabled={n > items.length}
                    onChange={() => {
                      setCount(n);
                      setResults([]);
                    }}
                  />
                  {n} 道菜
                </label>
              ))}
            </fieldset>
            <div className="draw-live" role="status" aria-live="polite">
              {drawing
                ? "正在抽签，看看今天的好味道…"
                : results.length
                  ? `抽签完成，今天就吃这 ${results.length} 道。`
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
                        {entry.recipe?.minutes
                          ? `${entry.recipe.minutes} 分钟`
                          : "慢慢做"}
                      </p>
                      <button
                        className="text-button"
                        onClick={() => onOpen(entry)}
                      >
                        查看做法
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
                  onClick={() => onAdd(results)}
                >
                  <Plus size={17} />
                  加入今日菜单
                </button>
              )}
            </div>
            <p className="feature-note">
              可先在菜单中按分类、食材或心头好筛选，再来抽签。抽签只帮你选菜，保存的菜谱保持原样。
            </p>
          </>
        ) : (
          <button className="button primary draw-start" onClick={onNew}>
            <Utensils size={16} />
            去添加菜谱
          </button>
        )}
      </div>
    </Modal>
  );
}
