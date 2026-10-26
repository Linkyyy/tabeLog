"use client";
import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Camera,
  X,
  Star,
  Heart,
  LoaderCircle,
  MapPin,
  ArrowRight,
} from "lucide-react";
import Modal from "./Modal";
import {
  CUISINES,
  type Entry,
  type EntryInput,
  type Location,
  type MapProvider,
} from "@/lib/types";
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="map-placeholder">地图加载中…</div>,
});
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export default function EntryForm({
  entry,
  initialLocation,
  onClose,
  onSaved,
  provider,
  onProviderChange,
}: {
  entry?: Entry;
  initialLocation?: Location;
  onClose: () => void;
  onSaved: (entry: Entry) => void;
  provider: MapProvider;
  onProviderChange: (v: MapProvider) => void;
}) {
  const [form, setForm] = useState<EntryInput>(
    entry
      ? { ...entry, keepPhotoIds: entry.photos.map((p) => p.id) }
      : {
          name: initialLocation?.name || "",
          address: initialLocation?.address || "",
          city: initialLocation?.city || "",
          cuisine: "日料",
          lat: initialLocation?.lat ?? 31.2304,
          lng: initialLocation?.lng ?? 121.4737,
          rating: 5,
          price: null,
          currency: "CNY",
          visitedAt: today(),
          review: "",
          favorite: false,
          keepPhotoIds: [],
        },
  );
  const [located, setLocated] = useState(!!entry || !!initialLocation),
    [focus, setFocus] = useState<Location | null>(
      entry || initialLocation || null,
    ),
    [files, setFiles] = useState<{ file: File; url: string }[]>([]),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [processing, setProcessing] = useState(false);
  const filesRef = useRef(files);
  filesRef.current = files;
  const set = <K extends keyof EntryInput>(key: K, value: EntryInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  function pick(p: Location) {
    setForm((f) => ({
      ...f,
      lat: p.lat,
      lng: p.lng,
      name: p.name || f.name,
      address: p.address || f.address,
      city: p.city || f.city,
    }));
    setLocated(true);
  }
  async function addFiles(list: FileList | null) {
    if (!list) return;
    setError("");
    setProcessing(true);
    const added: { file: File; url: string }[] = [];
    try {
      if (files.length + list.length + (form.keepPhotoIds?.length || 0) > 6)
        throw new Error("每篇日记最多 6 张照片");
      for (const original of Array.from(list)) {
        if (
          !["image/jpeg", "image/png", "image/webp"].includes(original.type) ||
          original.size > 5 * 1024 * 1024
        )
          throw new Error("请选择 5 MB 以内的 JPG、PNG 或 WebP 图片");
        const bitmap = await createImageBitmap(original);
        const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bitmap.width * ratio);
        canvas.height = Math.round(bitmap.height * ratio);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("浏览器无法处理图片");
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("图片压缩失败"))),
            "image/webp",
            0.8,
          ),
        );
        const file = new File([blob], "photo.webp", { type: "image/webp" });
        added.push({ file, url: URL.createObjectURL(file) });
      }
      if (
        [...files, ...added].reduce((s, p) => s + p.file.size, 0) >
        3.5 * 1024 * 1024
      )
        throw new Error("照片合计过大，请减少张数后重试");
      setFiles((current) => [...current, ...added]);
    } catch (e) {
      added.forEach((p) => URL.revokeObjectURL(p.url));
      setError(e instanceof Error ? e.message : "图片处理失败");
    } finally {
      setProcessing(false);
    }
  }
  function close() {
    filesRef.current.forEach((f) => URL.revokeObjectURL(f.url));
    onClose();
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!located) {
      setError("请先点击地图，或输入经纬度，确认店铺位置");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = new FormData();
      body.set("entry", JSON.stringify(form));
      if (entry) body.set("updatedAt", entry.updatedAt);
      files.forEach((p) => body.append("photos", p.file));
      const r = await fetch(
        entry ? `/api/entries/${entry.id}` : "/api/entries",
        { method: entry ? "PUT" : "POST", body },
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "保存失败");
      files.forEach((p) => URL.revokeObjectURL(p.url));
      onSaved(data.entry);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败，请检查网络");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      title={entry ? "编辑这份美味" : "记下这一口"}
      wide
      onClose={() => {
        if (!saving) close();
      }}
    >
      <form onSubmit={submit} className="entry-form">
        <div className="form-map">
          <MapView
            entries={
              located
                ? [
                    {
                      id: "draft",
                      name: form.name || "店铺位置",
                      lat: form.lat,
                      lng: form.lng,
                      rating: form.rating,
                    },
                  ]
                : []
            }
            selectedId="draft"
            focus={focus}
            provider={provider}
            onProviderChange={onProviderChange}
            pickMode
            onPick={pick}
          />
        </div>
        <div className="form-content">
          <div className="form-section-title">
            <span>01</span>
            <h3>在哪里吃到了美味？</h3>
            <small>{located ? "位置已选择" : "请先在地图选点"}</small>
          </div>
          <div className="form-grid">
            <label className="span-2">
              店铺名称 <b>*</b>
              <input
                autoComplete="off"
                name="name"
                required
                maxLength={100}
                placeholder="每一家小店，都值得被记住"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </label>
            <label className="span-2">
              详细地址
              <input
                name="address"
                maxLength={300}
                placeholder="街道、门牌号，或让地图搜索帮你填写"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
              />
            </label>
            <label>
              城市
              <input
                name="city"
                maxLength={80}
                placeholder="例如：上海"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </label>
            <label>
              料理分类
              <select
                value={form.cuisine}
                onChange={(e) => set("cuisine", e.target.value)}
              >
                {CUISINES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
          <details className="coordinate-details">
            <summary>
              <MapPin size={13} />
              精确位置 · WGS-84{" "}
              {located
                ? `${form.lat.toFixed(5)}, ${form.lng.toFixed(5)}`
                : "未选择"}
            </summary>
            <div className="form-grid">
              <label>
                纬度
                <input
                  aria-label="纬度"
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  value={form.lat}
                  onChange={(e) => {
                    set("lat", Number(e.target.value));
                    setLocated(true);
                  }}
                />
              </label>
              <label>
                经度
                <input
                  aria-label="经度"
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  value={form.lng}
                  onChange={(e) => {
                    set("lng", Number(e.target.value));
                    setLocated(true);
                  }}
                />
              </label>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => setFocus({ lat: form.lat, lng: form.lng })}
            >
              在地图中查看 <ArrowRight size={13} />
            </button>
          </details>
          <div className="form-section-title">
            <span>02</span>
            <h3>这一餐，感觉如何？</h3>
          </div>
          <div className="rating-picker">
            <div>
              <span className="field-label">
                我的评分 <b>*</b>
              </span>
              <div role="group" aria-label="我的评分">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    type="button"
                    key={n}
                    aria-label={`${n} 星`}
                    aria-pressed={form.rating === n}
                    onClick={() => set("rating", n)}
                  >
                    <Star
                      size={28}
                      fill={n <= form.rating ? "currentColor" : "none"}
                    />
                  </button>
                ))}
                <span>
                  {
                    [
                      "",
                      "不太合口味",
                      "有待提升",
                      "还不错",
                      "值得再来",
                      "念念不忘",
                    ][form.rating]
                  }
                </span>
              </div>
            </div>
            <button
              type="button"
              className={`favorite-toggle ${form.favorite ? "selected" : ""}`}
              aria-pressed={form.favorite}
              onClick={() => set("favorite", !form.favorite)}
            >
              <Heart size={17} fill={form.favorite ? "currentColor" : "none"} />
              心头好
            </button>
          </div>
          <div className="form-grid">
            <label>
              到店日期 <b>*</b>
              <input
                type="date"
                name="visitedAt"
                value={form.visitedAt}
                max={today()}
                required
                onChange={(e) => set("visitedAt", e.target.value)}
              />
            </label>
            <label>
              人均消费
              <div className="price-field">
                <select
                  aria-label="消费币种"
                  value={form.currency}
                  onChange={(e) =>
                    set("currency", e.target.value as EntryInput["currency"])
                  }
                >
                  <option value="CNY">CNY ¥</option>
                  <option value="JPY">JPY ¥</option>
                  <option value="USD">USD $</option>
                </select>
                <input
                  aria-label="人均消费"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1000000"
                  placeholder="选填"
                  value={form.price ?? ""}
                  onChange={(e) =>
                    set(
                      "price",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                />
              </div>
            </label>
            <label className="span-2">
              写给这顿饭的几句话
              <textarea
                name="review"
                maxLength={10000}
                rows={4}
                placeholder="是让人惊喜的味道，还是想再次回来的小店？记下菜品、心情，和一起吃饭的人。"
                value={form.review}
                onChange={(e) => set("review", e.target.value)}
              />
              <span className="character-count">
                {form.review.length} / 10000
              </span>
            </label>
          </div>
          <div className="photo-heading">
            <span className="field-label">用照片留住美味</span>
            <small>最多 6 张 · JPG / PNG / WebP · 单张 5 MB</small>
          </div>
          <div className="photo-upload-grid">
            {entry?.photos
              .filter((p) => form.keepPhotoIds?.includes(p.id))
              .map((p) => (
                <div className="photo-thumb" key={p.id}>
                  <img src={p.url} alt="已保存的美食照片" />
                  <button
                    type="button"
                    aria-label="移除已保存照片"
                    onClick={() =>
                      set(
                        "keepPhotoIds",
                        form.keepPhotoIds?.filter((id) => id !== p.id),
                      )
                    }
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            {files.map((p, i) => (
              <div className="photo-thumb" key={p.url}>
                <img src={p.url} alt={`新照片 ${i + 1}`} />
                <button
                  type="button"
                  aria-label={`移除新照片 ${i + 1}`}
                  onClick={() => {
                    URL.revokeObjectURL(p.url);
                    setFiles((v) => v.filter((_, j) => j !== i));
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {files.length + (form.keepPhotoIds?.length || 0) < 6 && (
              <label
                className={`upload-button ${processing ? "disabled" : ""}`}
              >
                {processing ? (
                  <LoaderCircle className="spin" size={24} />
                ) : (
                  <Camera size={24} />
                )}
                <span>{processing ? "正在压缩…" : "添加照片"}</span>
                <input
                  aria-label="添加照片"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  disabled={processing || saving}
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="form-footer">
            <p>把平常的一餐，变成值得收藏的日常。</p>
            <button
              type="button"
              className="button secondary"
              disabled={saving}
              onClick={close}
            >
              取消
            </button>
            <button
              className="button primary"
              disabled={saving || processing}
              type="submit"
            >
              {saving ? (
                <LoaderCircle size={17} className="spin" />
              ) : (
                <>
                  <span>保存这份美味</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
