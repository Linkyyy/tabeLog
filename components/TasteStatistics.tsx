"use client";
import { ArrowRight } from "lucide-react";
import type { Entry } from "@/lib/types";
import Modal from "./Modal";
export default function TasteStatistics({
  items,
  kind,
  demo,
  onClose,
  onOpen,
}: {
  items: Entry[];
  kind: Entry["kind"];
  demo: boolean;
  onClose: () => void;
  onOpen: (entry: Entry) => void;
}) {
  const sorted = [...items].sort(
      (a, b) => (b.mealStats?.count || 1) - (a.mealStats?.count || 1),
    ),
    total = items.reduce((sum, e) => sum + (e.mealStats?.count || 1), 0),
    rating = total
      ? items.reduce(
          (sum, e) => sum + (e.mealStats?.ratingTotal ?? e.rating),
          0,
        ) / total
      : 0;
  return (
    <Modal
      title={
        kind === "recipe" ? "我的菜单 · 吃过的统计" : "美食地图 · 吃过的统计"
      }
      onClose={onClose}
    >
      <div className="statistics-overview">
        <div className="statistics-totals">
          <div>
            <b>{items.length}</b>
            <span>{kind === "recipe" ? "道菜谱" : "家店铺"}</span>
          </div>
          <div>
            <b>{total}</b>
            <span>累计吃过 / 次</span>
          </div>
          <div>
            <b>{rating ? rating.toFixed(1) : "—"}</b>
            <span>平均评分</span>
          </div>
        </div>
        <p className="statistics-note">
          {demo
            ? "当前为示例统计。"
            : "按当前列表与筛选统计，同一条目下的每次用餐合并计数。"}
          点击查看每一次的评价。
        </p>
        {!items.length && (
          <p className="history-footnote">还没有记录，先留下第一份美味吧。</p>
        )}
        <ol className="statistics-list">
          {sorted.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => onOpen(e)}>
                <div>
                  <strong>{e.name}</strong>
                  <small>
                    平均 ★ {(e.mealStats?.averageRating ?? e.rating).toFixed(1)}{" "}
                    · 最近 {e.mealStats?.lastEatenAt || e.visitedAt}
                  </small>
                </div>
                <b>{e.mealStats?.count || 1} 次</b>
                <ArrowRight size={15} />
              </button>
            </li>
          ))}
        </ol>
      </div>
    </Modal>
  );
}
