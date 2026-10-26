"use client";
import { useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  nearestSheetSnap,
  sheetStops,
  SHEET_SNAPS,
  type SheetSnap,
} from "@/lib/sheet";
type Props = {
  snap: SheetSnap;
  onSnap: (snap: SheetSnap) => void;
  viewport: number;
  label: string;
  summary: string;
  toolbar: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  menu?: boolean;
};
export default function BottomSheet(props: Props) {
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const drag = useRef<{
    y: number;
    height: number;
    last: number;
    moved: boolean;
  } | null>(null);
  const stops = sheetStops(props.viewport, props.menu),
    height = dragHeight ?? stops[props.snap];
  function move(direction: number) {
    const index = SHEET_SNAPS.indexOf(props.snap);
    props.onSnap(SHEET_SNAPS[Math.max(0, Math.min(2, index + direction))]);
  }
  function finish(cancel = false) {
    const d = drag.current;
    if (!d) return;
    if (!cancel)
      props.onSnap(
        d.moved
          ? nearestSheetSnap(d.last, props.viewport, props.menu)
          : props.snap === "half"
            ? "expanded"
            : props.snap === "collapsed"
              ? "half"
              : "half",
      );
    drag.current = null;
    setDragHeight(null);
  }
  return (
    <section
      className={`map-bottom-sheet ${dragHeight !== null ? "is-dragging" : ""}`}
      role="region"
      aria-label={props.label}
      data-snap={props.snap}
      style={{ height }}
    >
      <div
        className="sheet-grabber"
        role="slider"
        tabIndex={0}
        aria-label="清单抽屉高度"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={2}
        aria-valuenow={SHEET_SNAPS.indexOf(props.snap)}
        aria-valuetext={
          { collapsed: "已收起", half: "半展开", expanded: "已展开" }[
            props.snap
          ]
        }
        aria-controls="sheet-scroll-content"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { y: e.clientY, height, last: height, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const delta = d.y - e.clientY;
          d.moved ||= Math.abs(delta) > 5;
          d.last = Math.max(
            stops.collapsed,
            Math.min(stops.expanded, d.height + delta),
          );
          if (d.moved) setDragHeight(d.last);
        }}
        onPointerUp={(e) => {
          finish();
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => finish(true)}
        onKeyDown={(e) => {
          if (
            ["ArrowUp", "ArrowDown", "Home", "End", "Enter", " "].includes(
              e.key,
            )
          ) {
            e.preventDefault();
            if (e.key === "Home") props.onSnap("collapsed");
            else if (e.key === "End") props.onSnap("expanded");
            else if (e.key === "ArrowUp") move(1);
            else if (e.key === "ArrowDown") move(-1);
            else move(props.snap === "expanded" ? -1 : 1);
          }
        }}
      >
        <span />
        <span className="sr-only">
          上拉展开清单，下拉收起；也可使用上下方向键。
        </span>
      </div>
      <div className="sheet-toolbar">
        <span className="sheet-summary">{props.summary}</span>
        {props.toolbar}
        <div className="sheet-snap-buttons">
          <button
            type="button"
            aria-label="展开清单"
            disabled={props.snap === "expanded"}
            onClick={() => move(1)}
          >
            <ChevronUp size={17} />
          </button>
          <button
            type="button"
            aria-label="收起清单"
            disabled={props.snap === "collapsed"}
            onClick={() => move(-1)}
          >
            <ChevronDown size={17} />
          </button>
        </div>
      </div>
      <div
        id="sheet-scroll-content"
        className="sheet-scroll"
        inert={props.snap === "collapsed"}
      >
        {props.children}
      </div>
      {props.snap !== "collapsed" && props.footer}
    </section>
  );
}
