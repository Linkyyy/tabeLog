import type { ComponentProps } from "react";
import type BottomSheet from "./BottomSheet";
export default function MenuSurface({
  summary,
  toolbar,
  children,
}: ComponentProps<typeof BottomSheet>) {
  return (
    <main className="menu-surface" aria-label="我的菜单">
      <div className="sheet-toolbar menu-toolbar unified-toolbar">
        <span className="sheet-summary">{summary}</span>
        {toolbar}
      </div>
      <div className="sheet-scroll menu-scroll" id="menu-scroll-content">
        {children}
      </div>
    </main>
  );
}
