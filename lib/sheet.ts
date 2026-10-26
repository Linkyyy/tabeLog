export type SheetSnap = "collapsed" | "half" | "expanded";
export const SHEET_SNAPS: SheetSnap[] = ["collapsed", "half", "expanded"];
export function sheetStops(viewport: number): Record<SheetSnap, number> {
  const available = Math.max(132, viewport - 86);
  return {
    collapsed: Math.min(106, available),
    half: Math.min(available, Math.max(210, Math.round(viewport * 0.48))),
    expanded: available,
  };
}
export function nearestSheetSnap(height: number, viewport: number): SheetSnap {
  const stops = sheetStops(viewport);
  return SHEET_SNAPS.reduce(
    (best, snap) =>
      Math.abs(stops[snap] - height) < Math.abs(stops[best] - height)
        ? snap
        : best,
    "collapsed",
  );
}
