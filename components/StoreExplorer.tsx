"use client";
import { useRef, useEffect } from "react";
import { LocateFixed, MapPin } from "lucide-react";
import type { Entry } from "@/lib/types";
import { CURRENCIES } from "@/lib/types";
import { FoodCover, Stars } from "./EntryPresentation";
type Props = {
  items: Entry[];
  activeId?: string;
  onLocate: (entry: Entry) => void;
  onOpen: (entry: Entry) => void;
  empty: React.ReactNode;
  loading: boolean;
};
export default function StoreExplorer(props: Props) {
  const rows = useRef<Record<string, HTMLElement | null>>({});
  useEffect(() => {
    if (props.activeId)
      rows.current[props.activeId]?.scrollIntoView({
        block: "nearest",
        behavior: "instant",
      });
  }, [props.activeId]);
  return (
    <div className="store-catalog">
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
              className={`store-row ${props.activeId === e.id ? "active" : ""}`}
              aria-label={`店铺 ${e.name}`}
              data-selected={props.activeId === e.id}
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
                  <button className="dish-name" onClick={() => props.onOpen(e)}>
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
                    className={`store-locate ${props.activeId === e.id ? "selected" : ""}`}
                    aria-label={`地图定位 ${e.name}`}
                    aria-pressed={props.activeId === e.id}
                    onClick={() => props.onLocate(e)}
                  >
                    <LocateFixed size={13} />
                    {props.activeId === e.id ? "已定位" : "地图定位"}
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
  );
}
