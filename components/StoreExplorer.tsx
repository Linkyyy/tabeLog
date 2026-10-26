"use client";
import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowRight, LocateFixed, MapPin, Plus, Star } from "lucide-react";
import type { Entry, Location, MapProvider } from "@/lib/types";
import { CURRENCIES } from "@/lib/types";
import { FoodCover, Stars } from "./EntryPresentation";
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="map-placeholder">正在展开美食地图…</div>,
});
type Props = {
  items: Entry[];
  provider: MapProvider;
  onProviderChange: (v: MapProvider) => void;
  onOpen: (e: Entry) => void;
  onNew: (point?: Location) => void;
  children: React.ReactNode;
  empty: React.ReactNode;
  loading: boolean;
};
export default function StoreExplorer(props: Props) {
  const [activeId, setActiveId] = useState<string>(),
    [focus, setFocus] = useState<Location | null>(null),
    [picking, setPicking] = useState(false);
  const rows = useRef<Record<string, HTMLElement | null>>({});
  const active = props.items.find((e) => e.id === activeId);
  function select(entry: Entry, fromMap = false) {
    setActiveId(entry.id);
    setFocus({ lat: entry.lat, lng: entry.lng });
    if (fromMap)
      rows.current[entry.id]?.scrollIntoView({
        block: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  }
  return (
    <div className="store-explorer">
      <section className="discovery-map" aria-label="店铺地图">
        <MapView
          entries={props.items}
          selectedId={active?.id}
          focus={focus}
          provider={props.provider}
          onProviderChange={props.onProviderChange}
          onSelect={(id) => {
            const entry = props.items.find((e) => e.id === id);
            if (entry) select(entry, true);
          }}
          pickMode={picking}
          onPick={(point) => {
            setPicking(false);
            props.onNew(point);
          }}
        />
        {!picking && (
          <button className="map-add-place" onClick={() => setPicking(true)}>
            <Plus size={14} />
            在地图记一笔
          </button>
        )}
        {picking && (
          <button className="map-cancel-pick" onClick={() => setPicking(false)}>
            取消选点
          </button>
        )}
        {active ? (
          <div className="map-active-store" aria-live="polite">
            <span className="map-active-dot" />
            <div>
              <small>正在看这家</small>
              <strong>{active.name}</strong>
            </div>
            <span className="active-store-rating">
              <Star size={12} fill="currentColor" />
              {active.rating.toFixed(1)}
            </span>
            <button
              onClick={() => props.onOpen(active)}
              aria-label={`查看选中店铺 ${active.name}`}
            >
              查看日记
              <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          <span className="map-interaction-note">
            <MapPin size={13} />
            点地图上的标记，找找下面的小店。
          </span>
        )}
      </section>
      <div className="store-catalog">
        {props.children}
        {props.loading ? (
          <div className="loading-state">正在寻找美味足迹…</div>
        ) : props.items.length ? (
          <div className="store-list" aria-label="店铺列表">
            {props.items.map((e) => (
              <article
                key={e.id}
                ref={(el) => {
                  rows.current[e.id] = el;
                }}
                className={`store-row ${activeId === e.id ? "active" : ""}`}
                aria-label={`店铺 ${e.name}`}
                data-selected={activeId === e.id}
              >
                <button
                  className="store-photo"
                  onClick={() => props.onOpen(e)}
                  aria-label={`查看 ${e.name}`}
                >
                  <FoodCover entry={e} />
                </button>
                <div className="store-info">
                  <div className="dish-title-line">
                    <button
                      className="dish-name"
                      onClick={() => props.onOpen(e)}
                    >
                      {e.name}
                    </button>
                    <span className="store-cuisine">{e.cuisine}</span>
                  </div>
                  <div className="store-rating-line">
                    <Stars rating={e.rating} />
                    {e.price !== null && (
                      <span>
                        {CURRENCIES[e.currency]}
                        {e.price} / 人
                      </span>
                    )}
                  </div>
                  <p className="store-address">
                    <MapPin size={12} />
                    <span>{e.address || e.city || "已标记位置"}</span>
                  </p>
                  <p className="dish-description">
                    {e.review || "有些美味，值得慢慢记下来。"}
                  </p>
                  <div className="store-bottom">
                    <span>
                      {e.authorName} <i>·</i> {e.visitedAt.replaceAll("-", ".")}{" "}
                      <span className={`visibility-badge ${e.visibility}`}>
                        {e.visibility === "public" ? "公开" : "私人"}
                      </span>
                    </span>
                    <button
                      className={`store-locate ${activeId === e.id ? "selected" : ""}`}
                      aria-label={`地图定位 ${e.name}`}
                      aria-pressed={activeId === e.id}
                      onClick={() => select(e)}
                    >
                      <LocateFixed size={13} />
                      {activeId === e.id ? "已定位" : "地图定位"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          props.empty
        )}
      </div>
    </div>
  );
}
