"use client";
import { Globe2, LockKeyhole } from "lucide-react";
import type { Visibility } from "@/lib/types";
export default function VisibilityPicker({
  value,
  onChange,
}: {
  value: Visibility;
  onChange: (value: Visibility) => void;
}) {
  return (
    <fieldset className="visibility-picker">
      <legend>谁可以看到这份记录？</legend>
      <div role="group" aria-label="可见范围">
        <button
          type="button"
          aria-pressed={value === "private"}
          className={value === "private" ? "selected" : ""}
          onClick={() => onChange("private")}
        >
          <LockKeyhole size={18} />
          <span>
            <strong>私人收藏</strong>
            <small>仅自己可见</small>
          </span>
        </button>
        <button
          type="button"
          aria-pressed={value === "public"}
          className={value === "public" ? "selected" : ""}
          onClick={() => onChange("public")}
        >
          <Globe2 size={18} />
          <span>
            <strong>公开分享</strong>
            <small>所有人可见</small>
          </span>
        </button>
      </div>
      <p>
        {value === "private"
          ? "这份文字与照片只属于你，之后也可以改为公开。"
          : "保存后，文字和照片会出现在美味广场，也可以通过链接分享。"}
      </p>
    </fieldset>
  );
}
