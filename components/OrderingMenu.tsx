"use client";
import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  ChefHat,
  ClipboardList,
  Download,
  Heart,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  Utensils,
} from "lucide-react";
import type { Entry } from "@/lib/types";
import { CUISINES } from "@/lib/types";
import { FoodCover, Stars } from "./EntryPresentation";
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
export type Quantities = Record<string, number>;
type Props = {
  items: Entry[];
  allItems: Entry[];
  category: string;
  onCategory: (v: string) => void;
  quantities: Quantities;
  onQuantity: (id: string, change: number) => void;
  onClear: () => void;
  onOpen: (entry: Entry) => void;
  onNew: () => void;
  empty: React.ReactNode;
  loading: boolean;
};
function Quantity({
  entry,
  value,
  onChange,
}: {
  entry: Entry;
  value: number;
  onChange: (change: number) => void;
}) {
  return (
    <div
      className={`quantity-control ${value ? "has-quantity" : ""}`}
      role="group"
      aria-label={`${entry.name}的份数`}
    >
      {value > 0 && (
        <>
          <button
            type="button"
            aria-label={`减少一份 ${entry.name}`}
            onClick={() => onChange(-1)}
          >
            <Minus size={15} />
          </button>
          <output aria-label={`${entry.name}已选份数`}>{value}</output>
        </>
      )}
      <button
        type="button"
        className="quantity-plus"
        disabled={value >= 20}
        aria-label={value ? `增加一份 ${entry.name}` : `加入菜单 ${entry.name}`}
        onClick={() => onChange(1)}
      >
        <Plus size={17} />
      </button>
    </div>
  );
}
export default function OrderingMenu(props: Props) {
  const [open, setOpen] = useState(false);
  const selected = props.allItems.filter(
    (e) => (props.quantities[e.id] || 0) > 0,
  );
  const count = selected.reduce((sum, e) => sum + props.quantities[e.id], 0);
  const servings = selected.reduce(
    (sum, e) => sum + props.quantities[e.id] * (e.recipe?.servings || 1),
    0,
  );
  function openRecipe(entry: Entry) {
    setOpen(false);
    props.onOpen(entry);
  }
  function exportMenu() {
    const text = [
      "今日菜单 · tabeLog",
      `${selected.length} 道菜 / ${count} 份菜谱 / 约 ${servings} 人份`,
      "每份按原菜谱用量准备；多份请按相应倍数备料。",
      "",
      ...selected.flatMap((e) => [
        `${e.name} × ${props.quantities[e.id]} 份（原菜谱 ${e.recipe?.servings || 1} 人份 / 份）`,
        e.recipe?.ingredients || "未填写食材",
        "",
        "做法：",
        e.recipe?.steps || "",
        "",
      ]),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `tabelog-menu-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }
  const basket = (
    <>
      <div className="basket-summary">
        <span>
          <ChefHat size={17} />
          今日菜单
        </span>
        <strong>
          {selected.length} 道菜 <i>·</i> {count} 份
        </strong>
      </div>
      {selected.length ? (
        <>
          <div className="basket-items">
            {selected.map((e) => (
              <article
                key={e.id}
                className="basket-item"
                aria-label={`已选 ${e.name}`}
              >
                <button
                  className="basket-item-name"
                  onClick={() => openRecipe(e)}
                >
                  {e.name}
                  <span>{e.recipe?.servings || 1} 人份 / 份菜谱</span>
                </button>
                <Quantity
                  entry={e}
                  value={props.quantities[e.id]}
                  onChange={(change) => props.onQuantity(e.id, change)}
                />
              </article>
            ))}
          </div>
          <div className="basket-serving">
            <Utensils size={14} />
            合计约 {servings} 人份<small>每份按原菜谱用量准备</small>
          </div>
          <button className="button primary basket-export" onClick={exportMenu}>
            <Download size={16} />
            导出备菜清单
          </button>
          <div className="basket-bottom">
            <span>选好今天的菜，再一起下厨。</span>
            <button onClick={props.onClear}>
              <Trash2 size={12} />
              清空
            </button>
          </div>
        </>
      ) : (
        <div className="basket-empty">
          <ShoppingBag size={35} strokeWidth={1.2} />
          <strong>今晚吃什么，由你来点。</strong>
          <p>
            点击菜品右侧的 +<br />
            把喜欢的味道加入今日菜单。
          </p>
        </div>
      )}
    </>
  );
  return (
    <div className="ordering-menu">
      <div className="ordering-body">
        <aside className="menu-categories" aria-label="菜品分类">
          <span className="category-rail-label">MENU</span>
          {["全部", ...CUISINES].map((c) => (
            <button
              key={c}
              className={props.category === c ? "active" : ""}
              aria-pressed={props.category === c}
              onClick={() => props.onCategory(c)}
            >
              <span className="category-rail-icon">
                {c === "全部" ? <Utensils size={17} /> : icons[c]}
              </span>
              <span>{c}</span>
              <small>
                {
                  props.allItems.filter((e) => c === "全部" || e.cuisine === c)
                    .length
                }
              </small>
            </button>
          ))}
        </aside>
        <div className="menu-items-column">
          <div className="menu-list-title">
            <h2>
              {props.category === "全部" ? "今日有什么好吃的" : props.category}
              <span>{props.items.length} 道</span>
            </h2>
            <span>点菜，也点一点好心情。</span>
          </div>
          {props.loading ? (
            <div className="loading-state">正在翻开菜单…</div>
          ) : props.items.length ? (
            <div className="dish-list">
              {props.items.map((e) => (
                <article
                  className="dish-row"
                  key={e.id}
                  aria-label={`菜品 ${e.name}`}
                >
                  <button
                    className="dish-photo"
                    onClick={() => props.onOpen(e)}
                    aria-label={`查看 ${e.name}`}
                  >
                    <FoodCover entry={e} />
                    {e.favorite && (
                      <span className="dish-favorite">
                        <Heart size={12} fill="currentColor" />
                      </span>
                    )}
                  </button>
                  <div className="dish-info">
                    <div className="dish-title-line">
                      <button
                        className="dish-name"
                        onClick={() => props.onOpen(e)}
                      >
                        {e.name}
                      </button>
                      <span className={`visibility-badge ${e.visibility}`}>
                        {e.visibility === "public" ? "公开" : "私人"}
                      </span>
                    </div>
                    <Stars rating={e.rating} />
                    <p className="dish-facts">
                      {e.recipe?.difficulty} <i>·</i>{" "}
                      {e.recipe?.minutes
                        ? `${e.recipe.minutes} 分钟`
                        : "慢慢做"}{" "}
                      <i>·</i> {e.recipe?.servings || 1} 人份
                    </p>
                    <p className="dish-description">
                      {e.review || e.recipe?.ingredients}
                    </p>
                    <div className="dish-bottom">
                      <button
                        className="dish-recipe-link"
                        onClick={() => props.onOpen(e)}
                      >
                        <BookOpen size={13} />
                        查看做法<span>· {e.authorName}</span>
                      </button>
                      <Quantity
                        entry={e}
                        value={props.quantities[e.id] || 0}
                        onChange={(change) => props.onQuantity(e.id, change)}
                      />
                    </div>
                  </div>
                </article>
              ))}
              <button className="add-dish-row" onClick={props.onNew}>
                <Plus size={18} />
                <span>把新的拿手菜，也放进菜单。</span>
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            props.empty
          )}
        </div>
      </div>
      <aside className="desktop-basket" aria-label="今日已选菜单">
        {basket}
      </aside>
      <div className="menu-selection-bar" role="region" aria-label="已选菜单">
        <div className="selection-bag">
          <ShoppingBag size={24} />
          {count > 0 && <span>{count}</span>}
        </div>
        <div className="selection-bar-copy" aria-live="polite">
          <strong>
            {count
              ? `已选 ${selected.length} 道菜，共 ${count} 份`
              : "今晚吃什么，慢慢挑。"}
          </strong>
          <small>
            {count
              ? "选好菜单，就开始准备食材吧。"
              : "点击 +，组成你的今日菜单。"}
          </small>
        </div>
        <button disabled={!count} onClick={() => setOpen(true)}>
          查看菜单
          <ArrowRight size={15} />
        </button>
      </div>
      {open && (
        <Modal title="今晚，吃这些" onClose={() => setOpen(false)}>
          <div className="mobile-basket">{basket}</div>
        </Modal>
      )}
    </div>
  );
}
