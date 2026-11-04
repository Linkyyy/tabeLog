"use client";
import { useEffect, useRef } from "react";
import {
  ChevronDown,
  Utensils,
  Dices,
  Sparkles,
  QrCode,
  ClipboardList,
  ChartNoAxesColumnIncreasing,
  Settings,
  Download,
  FilterX,
  X,
} from "lucide-react";
export default function DiaryTools({
  recipe,
  demo,
  onOpen,
  onDraw,
  onAI,
  onShare,
  onOrders,
  onStatistics,
  onToggleDemo,
  onSettings,
  onReset,
  onExport,
  exportDisabled = false,
  exporting = false,
}: {
  recipe: boolean;
  demo: boolean;
  onOpen: () => void;
  onDraw: () => void;
  onAI: () => void;
  onShare: () => void;
  onOrders: () => void;
  onStatistics: () => void;
  onToggleDemo: () => void;
  onSettings: () => void;
  onReset: () => void;
  onExport?: () => void;
  exportDisabled?: boolean;
  exporting?: boolean;
}) {
  const root = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !root.current?.contains(event.target) &&
        root.current
      )
        root.current.open = false;
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  function action(callback: () => void) {
    if (root.current) root.current.open = false;
    callback();
  }
  return (
    <details
      className="diary-tools"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          event.currentTarget.open = false;
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
    >
      <summary
        role="button"
        aria-label="菜单工具"
        title={recipe ? "菜单工具" : "店铺工具"}
        onClick={() => {
          if (!root.current?.open) onOpen();
        }}
      >
        <Utensils size={15} />
        <span>工具</span>
        <ChevronDown size={10} />
        {demo && <i className="tools-demo-dot" aria-label="示例模式" />}
      </summary>
      <div
        className="diary-tools-popover"
        role="group"
        aria-label={recipe ? "我的菜单工具" : "美食地图工具"}
      >
        <button
          type="button"
          aria-label="今天吃什么"
          onClick={() => action(onDraw)}
        >
          <Dices size={15} />
          {recipe ? "今天吃什么" : "今天去哪吃"}
        </button>
        <>
          <button
            type="button"
            aria-label="AI 生成 / 导入"
            onClick={() => action(onAI)}
          >
            <Sparkles size={15} />
            AI 菜谱 / 导入
          </button>
          <button type="button" onClick={() => action(onShare)}>
            <QrCode size={15} />
            点餐二维码
          </button>
          <button type="button" onClick={() => action(onOrders)}>
            <ClipboardList size={15} />
            收到的点餐
          </button>
        </>
        <button type="button" onClick={() => action(onStatistics)}>
          <ChartNoAxesColumnIncreasing size={15} />
          吃过的统计
        </button>
        <button type="button" onClick={() => action(onSettings)}>
          <Settings size={15} />
          设置
        </button>
        {!demo && (
          <button
            type="button"
            aria-label="浏览示例日记"
            onClick={() => action(onToggleDemo)}
          >
            <Sparkles size={15} />
            查看示例
          </button>
        )}
        {onExport && (
          <button
            type="button"
            aria-label="导出日记"
            disabled={exportDisabled || exporting}
            onClick={() => action(onExport)}
          >
            <Download size={15} />
            {exporting ? "正在导出…" : "导出我的记录"}
          </button>
        )}
        <button type="button" onClick={() => action(onReset)}>
          <FilterX size={15} />
          清除筛选
        </button>
        {demo && (
          <div className="tools-demo-note">
            <span>当前为示例{recipe ? "菜谱" : "日记"}</span>
            <button
              type="button"
              aria-label="回到真实记录"
              onClick={() => action(onToggleDemo)}
            >
              <X size={13} />
              结束示例
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
