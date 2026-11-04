"use client";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CalendarDays,
  Heart,
  LoaderCircle,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import type {
  Entry,
  MealRecord,
  MealRecordInput,
  MealStats,
} from "@/lib/types";
import { firstMeal } from "@/lib/meal-records";
import { formatPrice } from "@/lib/pricing";
import { clientAPI } from "@/lib/client-api";
import PriceFields from "./PriceFields";
type Cursor = { date: string; created: string; id: string };
type HistoryData = {
  records: MealRecord[];
  initial: MealRecord;
  stats: MealStats;
  next: Cursor | null;
};
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export default function MealHistory({
  entry,
  canEdit = false,
  demo = false,
  onStats,
}: {
  entry: Entry;
  canEdit?: boolean;
  demo?: boolean;
  onStats?: (stats: MealStats) => void;
}) {
  const [data, setData] = useState<HistoryData>({
      records: [],
      initial: firstMeal(entry),
      stats: entry.mealStats || {
        count: 1,
        averageRating: entry.rating,
        lastEatenAt: entry.visitedAt,
      },
      next: null,
    }),
    [loading, setLoading] = useState(!demo),
    [error, setError] = useState(""),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [removing, setRemoving] = useState(""),
    [confirm, setConfirm] = useState("");
  const [form, setForm] = useState<MealRecordInput>({
    visitedAt: today(),
    rating: 5,
    review: "",
    price: null,
    currency: entry.currency,
    ...(entry.customUnit ? { customUnit: entry.customUnit } : {}),
  });
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]),
    [processing, setProcessing] = useState(false);
  const filesRef = useRef(photos);
  filesRef.current = photos;
  const [notice, setNotice] = useState("");
  async function load(more?: Cursor) {
    setLoading(true);
    setError("");
    try {
      const next = await clientAPI<HistoryData>(
        `/api/entries/${entry.id}/meals${more ? `?before=${encodeURIComponent(JSON.stringify(more))}` : ""}`,
      );
      setData((previous) => ({
        ...next,
        records: more ? [...previous.records, ...next.records] : next.records,
      }));
      onStats?.(next.stats);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    if (!demo)
      clientAPI<HistoryData>(`/api/entries/${entry.id}/meals`)
        .then((next) => {
          if (active) setData(next);
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
  }, [entry.id, entry.updatedAt, demo]);
  useEffect(
    () => () => {
      filesRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    },
    [],
  );
  async function addPhotos(list: FileList | null) {
    if (!list) return;
    setProcessing(true);
    setError("");
    const added: { file: File; url: string }[] = [];
    try {
      if (list.length + photos.length > 6)
        throw new Error("每次最多上传 6 张照片");
      for (const original of Array.from(list)) {
        if (
          !["image/jpeg", "image/png", "image/webp"].includes(original.type) ||
          original.size > 5 * 1024 * 1024
        )
          throw new Error("请选择 5 MB 以内的 JPG、PNG 或 WebP 图片");
        const bitmap = await createImageBitmap(original),
          ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bitmap.width * ratio);
        canvas.height = Math.round(bitmap.height * ratio);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          bitmap.close();
          throw new Error("图片无法处理");
        }
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("图片无法处理"))),
            "image/webp",
            0.8,
          ),
        );
        added.push({
          file: new File([blob], "meal.webp", { type: "image/webp" }),
          url: URL.createObjectURL(blob),
        });
      }
      if (
        [...photos, ...added].reduce((sum, p) => sum + p.file.size, 0) >
        3.5 * 1024 * 1024
      )
        throw new Error("照片合计过大，请减少张数后重试");
      setPhotos((current) => [...current, ...added]);
    } catch (e) {
      added.forEach((p) => URL.revokeObjectURL(p.url));
      setError((e as Error).message);
    } finally {
      setProcessing(false);
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const body = new FormData();
      body.set("record", JSON.stringify(form));
      photos.forEach((p) => body.append("photos", p.file));
      const response = await fetch(`/api/entries/${entry.id}/meals`, {
        method: "POST",
        body,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "保存失败");
      photos.forEach((p) => URL.revokeObjectURL(p.url));
      setPhotos([]);
      setForm({
        ...form,
        visitedAt: today(),
        rating: 5,
        review: "",
        price: null,
      });
      setOpen(false);
      setNotice("这一次的好味道，已经记下了。");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(record: MealRecord) {
    setRemoving(record.id);
    setError("");
    try {
      await clientAPI(`/api/entries/${entry.id}/meals/${record.id}`, "DELETE");
      setConfirm("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRemoving("");
    }
  }
  const records = [...data.records, data.initial].sort(
    (a, b) =>
      b.visitedAt.localeCompare(a.visitedAt) ||
      b.createdAt.localeCompare(a.createdAt),
  );
  return (
    <section className="meal-history" aria-label="吃过的记录与统计">
      <div className="history-heading">
        <div>
          <span className="eyebrow">TASTE, AGAIN</span>
          <h3>{entry.kind === "recipe" ? "一菜一记" : "一店一记"}</h3>
        </div>
        {canEdit && !demo && (
          <button
            type="button"
            className="button secondary history-add"
            aria-expanded={open}
            onClick={() => {
              setOpen(!open);
              setError("");
            }}
          >
            <Plus size={15} />
            再吃一次
          </button>
        )}
      </div>
      <div className="history-stats" aria-label="用餐统计">
        <div>
          <b>
            {data.stats.count}
            <small> 次</small>
          </b>
          <span>累计吃过</span>
        </div>
        <div>
          <b>
            {data.stats.averageRating.toFixed(1)}
            <Star size={13} />
          </b>
          <span>平均评分</span>
        </div>
        <div>
          <b className="history-last-date">
            {data.stats.lastEatenAt.slice(5).replace("-", ".")}
          </b>
          <span>最近 · {data.stats.lastEatenAt.slice(0, 4)}</span>
        </div>
      </div>
      {open && (
        <form
          className="meal-record-form"
          aria-label="记录这次用餐"
          onSubmit={save}
        >
          <h4>今天的味道，和上次有什么不同？</h4>
          <p>
            每次单独记录。
            {entry.visibility === "public"
              ? "当前条目已公开，这次评价和照片也会公开。"
              : "随当前条目保持私人；将来公开条目时，用餐记录也会公开。"}
          </p>
          <div className="form-grid">
            <label>
              这次用餐日期
              <input
                aria-label="这次用餐日期"
                type="date"
                required
                max={today()}
                value={form.visitedAt}
                disabled={busy}
                onChange={(e) =>
                  setForm({ ...form, visitedAt: e.target.value })
                }
              />
            </label>
            <PriceFields
              value={form}
              disabled={busy}
              onChange={(patch) => setForm({ ...form, ...patch })}
            />
          </div>
          <div
            className="history-rating"
            role="group"
            aria-label="这次用餐评分"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                aria-label={`这次 ${n} 星`}
                aria-pressed={form.rating === n}
                disabled={busy}
                key={n}
                onClick={() => setForm({ ...form, rating: n })}
              >
                <Star
                  size={25}
                  fill={n <= form.rating ? "currentColor" : "none"}
                />
              </button>
            ))}
            <small>{form.rating} 星</small>
          </div>
          <label>
            这次的评价
            <textarea
              aria-label="这次的评价"
              rows={3}
              maxLength={10000}
              value={form.review}
              disabled={busy}
              placeholder="这次加了少许辣，意外地好吃。"
              onChange={(e) => setForm({ ...form, review: e.target.value })}
            />
          </label>
          <div className="history-upload">
            <label className="history-photo-picker">
              <Camera size={17} />
              <span>{processing ? "处理照片中…" : "添加这次的照片"}</span>
              <input
                type="file"
                aria-label="这次用餐照片"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={busy || processing}
                onChange={(e) => {
                  addPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            <small>选填 · 最多 6 张</small>
          </div>
          {photos.length > 0 && (
            <div className="history-photo-previews">
              {photos.map((p, i) => (
                <div key={p.url}>
                  <img src={p.url} alt={`这次用餐新照片 ${i + 1}`} />
                  <button
                    type="button"
                    aria-label={`移除这次照片 ${i + 1}`}
                    disabled={busy}
                    onClick={() => {
                      URL.revokeObjectURL(p.url);
                      setPhotos((current) =>
                        current.filter((x) => x.url !== p.url),
                      );
                    }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="history-form-actions">
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              收起草稿
            </button>
            <button className="button primary" disabled={busy || processing}>
              {busy ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <Heart size={15} />
              )}
              保存这次用餐
            </button>
          </div>
        </form>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
          {!open && (
            <button
              type="button"
              className="text-button"
              onClick={() => load()}
            >
              重新读取
            </button>
          )}
        </div>
      )}
      {notice && (
        <p className="assistant-message" role="status">
          {notice}
        </p>
      )}
      {loading && (
        <p className="history-loading" role="status">
          正在读取用餐记录…
        </p>
      )}
      <ol className="history-timeline" aria-label="每次用餐评价">
        {records.map((record) => (
          <li key={record.id}>
            <div className="history-record-top">
              <span>
                <CalendarDays size={13} />
                {record.visitedAt}
              </span>
              <b>
                <Star size={12} fill="currentColor" />
                {record.rating.toFixed(1)}
              </b>
              {record.initial && <small>首次记录</small>}
              {canEdit && !record.initial && (
                <button
                  type="button"
                  className="history-delete"
                  aria-label={`删除 ${record.visitedAt} 的用餐记录`}
                  disabled={!!removing}
                  onClick={() =>
                    setConfirm(confirm === record.id ? "" : record.id)
                  }
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
            <p>{record.review || "这次没有留下文字，味道已经记在心里。"}</p>
            {record.price !== null && (
              <span className="history-price">{formatPrice(record)}</span>
            )}
            {record.photos.length > 0 && (
              <div className="history-record-photos">
                {record.photos.map((p, i) => (
                  <a
                    href={p.url}
                    key={p.id}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      loading="lazy"
                      src={p.url}
                      alt={`${record.visitedAt} 用餐照片 ${i + 1}`}
                    />
                  </a>
                ))}
              </div>
            )}
            {confirm === record.id && (
              <div className="history-delete-confirm" role="alert">
                <span>删除这次的评价和照片？</span>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setConfirm("")}
                  disabled={!!removing}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="text-button danger"
                  disabled={!!removing}
                  onClick={() => remove(record)}
                >
                  {removing === record.id ? "删除中…" : "确认删除这次"}
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>
      {data.next && (
        <button
          type="button"
          className="text-button"
          disabled={loading}
          onClick={() => load(data.next!)}
        >
          查看更早的用餐记录
        </button>
      )}
      <p className="history-footnote">
        {demo
          ? "示例只用于展示。"
          : "首次记录来自这篇日记，可在「编辑日记」中修改；后续每一次都有独立评价。"}
      </p>
    </section>
  );
}
