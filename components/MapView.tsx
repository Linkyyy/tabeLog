"use client";
import { useEffect, useRef, useState } from "react";
import {
  LocateFixed,
  MapPin,
  Search,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";
import { gcjToWgs, wgsToGcj } from "@/lib/coordinates";
import type { Entry, Location, MapProvider } from "@/lib/types";
import { useTheme } from "./ThemeProvider";
import type * as Leaflet from "leaflet";
type Pin = Pick<Entry, "id" | "name" | "lat" | "lng" | "rating">;
type Adapter = {
  context?: string;
  destroy: () => void;
  pins: (items: Pin[], selected?: string) => void;
  focus: (point: Location) => void;
  fit?: (items: Pin[]) => void;
  appearance?: () => void;
  search?: (term: string) => Promise<Location[]>;
};
type Props = {
  entries: Pin[];
  provider: MapProvider;
  onProviderChange: (v: MapProvider) => void;
  selectedId?: string;
  onSelect?: (id: string) => void;
  pickMode?: boolean;
  onPick?: (p: Location) => void;
  focus?: Location | null;
  topInset?: number;
  bottomInset?: number;
  demo?: boolean;
  showProvider?: boolean;
};
const keys = {
  google: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  amap: process.env.NEXT_PUBLIC_AMAP_KEY,
};
const scripts: Record<string, Promise<void> | undefined> = {};
function mapAppearance() {
  const style = getComputedStyle(document.documentElement);
  return {
    dark: document.documentElement.dataset.theme === "midnight",
    accent: style.getPropertyValue("--rust").trim(),
    surface: style.getPropertyValue("--white").trim(),
    text: style.getPropertyValue("--ink").trim(),
    onAccent: style.getPropertyValue("--on-accent").trim(),
    background: style.getPropertyValue("--map-bg").trim(),
    building: style.getPropertyValue("--map-building").trim(),
    water: style.getPropertyValue("--map-water").trim(),
    park: style.getPropertyValue("--map-park").trim(),
    road: style.getPropertyValue("--map-road").trim(),
    arterial: style.getPropertyValue("--map-arterial").trim(),
    label: style.getPropertyValue("--map-label").trim(),
  };
}
function googleStyle() {
  if (document.documentElement.dataset.theme === "classic") return null;
  const palette = mapAppearance();
  return [
    { elementType: "geometry", stylers: [{ color: palette.background }] },
    { elementType: "labels.text.fill", stylers: [{ color: palette.label }] },
    {
      elementType: "labels.text.stroke",
      stylers: [{ color: palette.background }],
    },
    {
      featureType: "landscape.man_made",
      elementType: "geometry",
      stylers: [{ color: palette.building }],
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: palette.road }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry",
      stylers: [{ color: palette.arterial }],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: palette.water }],
    },
    {
      featureType: "poi.park",
      elementType: "geometry",
      stylers: [{ color: palette.park }],
    },
  ];
}
function amapStyle() {
  const theme = document.documentElement.dataset.theme;
  const name =
    theme === "midnight"
      ? "darkblue"
      : theme === "mint"
        ? "fresh"
        : theme === "lavender"
          ? "whitesmoke"
          : "normal";
  return `amap://styles/${name}`;
}
function rasterUrl() {
  const theme = document.documentElement.dataset.theme;
  if (theme === "classic")
    return "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const style =
    theme === "midnight"
      ? "dark_all"
      : theme === "coral"
        ? "rastertiles/voyager"
        : "light_all";
  return `https://basemaps.cartocdn.com/${style}/{z}/{x}/{y}.png`;
}
function loadScript(id: string, src: string) {
  if (!scripts[id])
    scripts[id] = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.id = id;
      script.src = src;
      script.async = true;
      const timeout = setTimeout(() => {
        script.remove();
        scripts[id] = undefined;
        reject(new Error("地图服务加载超时，请检查网络或切换地图"));
      }, 15000);
      script.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      script.onerror = () => {
        clearTimeout(timeout);
        script.remove();
        scripts[id] = undefined;
        reject(new Error("地图服务加载失败，请检查网络或密钥的域名限制"));
      };
      document.head.appendChild(script);
    });
  return scripts[id]!;
}
function label(pin: Pin, selected: boolean) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = `map-pin ${selected ? "active" : ""}`;
  el.setAttribute("aria-label", `地图店铺：${pin.name}`);
  el.setAttribute("aria-pressed", String(selected));
  const star = document.createElement("span");
  star.className = "pin-star";
  star.textContent = pin.rating ? "★" : "●";
  el.append(
    star,
    document.createTextNode(pin.rating ? ` ${pin.rating.toFixed(1)}` : ""),
  );
  return el;
}
export default function MapView(props: Props) {
  const { theme } = useTheme();
  const host = useRef<HTMLDivElement>(null),
    latest = useRef(props);
  latest.current = props;
  const [adapter, setAdapter] = useState<Adapter | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [tileError, setTileError] = useState(false);
  const [term, setTerm] = useState(""),
    [results, setResults] = useState<Location[]>([]),
    [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const activeAdapter =
    adapter?.context === `${props.provider}:${!!props.demo}` ? adapter : null;
  useEffect(() => {
    const abort = new AbortController();
    let cancelled = false,
      instance: Adapter | undefined;
    setAdapter(null);
    setLoading(true);
    setError("");
    setTileError(false);
    setResults([]);
    async function init() {
      const provider = props.provider;
      if (provider !== "osm" && !keys[provider])
        throw new Error(
          `${provider === "google" ? "Google" : "高德"} 地图尚未配置密钥，请先使用 OpenStreetMap。`,
        );
      const initial =
        latest.current.focus ||
        latest.current.entries[0] ||
        (props.demo
          ? { lat: 31.2385, lng: 121.495 }
          : { lat: 31.2304, lng: 121.4737 });
      if (provider === "osm") {
        const L = await import("leaflet");
        if (cancelled || !host.current) return;
        const map = L.map(host.current, {
          zoomControl: false,
          minZoom: props.demo ? 12 : 0,
          maxZoom: 19,
        }).setView([initial.lat, initial.lng], 13);
        L.control.zoom({ position: "bottomright" }).addTo(map);
        let removeDemo: (() => void) | undefined;
        let tiles: Leaflet.TileLayer | undefined;
        let activeTileUrl = "";
        if (props.demo) {
          const { addDemoMap } = await import("@/lib/demo-map");
          if (cancelled) {
            map.remove();
            return;
          }
          try {
            removeDemo = await addDemoMap(L, map, abort.signal);
          } catch (error) {
            map.remove();
            throw error;
          }
          if (cancelled) {
            removeDemo?.();
            map.remove();
            return;
          }
          map.getContainer().classList.add("has-demo-basemap");
        } else {
          activeTileUrl = rasterUrl();
          tiles = L.tileLayer(activeTileUrl, {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>',
            maxZoom: 19,
          }).addTo(map);
        }
        let errors = 0;
        tiles?.on("tileerror", () => {
          if (!cancelled && ++errors >= 3) setTileError(true);
        });
        const layer = L.layerGroup().addTo(map);
        map.on("click", (e) => {
          if (latest.current.pickMode)
            latest.current.onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
        });
        const observer = new ResizeObserver(() => map.invalidateSize());
        observer.observe(host.current);
        instance = {
          appearance: () => {
            if (!tiles) return;
            const next = rasterUrl();
            if (next !== activeTileUrl) {
              activeTileUrl = next;
              errors = 0;
              setTileError(false);
              tiles.setUrl(next);
            }
          },
          destroy: () => {
            observer.disconnect();
            removeDemo?.();
            map.getContainer().classList.remove("has-demo-basemap");
            map.remove();
          },
          focus: (p) =>
            map.flyToBounds(
              [
                [p.lat, p.lng],
                [p.lat, p.lng],
              ],
              {
                maxZoom: 15,
                paddingTopLeft: [24, (latest.current.topInset || 0) + 24],
                paddingBottomRight: [
                  24,
                  (latest.current.bottomInset || 0) + 24,
                ],
                duration: 0.45,
              },
            ),
          fit: (items) =>
            map.fitBounds(
              L.latLngBounds(
                (items.length ? items : [{ lat: 31.2395, lng: 121.4885 }]).map(
                  (p) => [p.lat, p.lng],
                ),
              ),
              {
                maxZoom: props.demo
                  ? items.length || map.getSize().x > 900
                    ? 15
                    : 14
                  : 14,
                animate: false,
                paddingTopLeft: [24, (latest.current.topInset || 0) + 24],
                paddingBottomRight: [
                  24,
                  (latest.current.bottomInset || 0) + 24,
                ],
              },
            ),
          pins: (items, selected) => {
            layer.clearLayers();
            for (const pin of items) {
              const marker = L.marker([pin.lat, pin.lng], {
                icon: L.divIcon({
                  html: label(pin, pin.id === selected),
                  className: "pin-container",
                  iconSize: [54, 40],
                  iconAnchor: [27, 40],
                }),
                title: `地图店铺：${pin.name}`,
                keyboard: true,
              }).addTo(layer);
              marker.on("click", () => latest.current.onSelect?.(pin.id));
            }
          },
        };
      } else if (provider === "google") {
        await loadScript(
          "google-maps-sdk",
          `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(keys.google!)}&v=weekly&libraries=places&language=zh-CN`,
        );
        if (cancelled || !host.current) return;
        // External map SDKs are runtime globals loaded only for the selected provider.
        const g = (window as any).google;
        if (!g?.maps) throw new Error("Google 地图未能初始化");
        const map = new g.maps.Map(host.current, {
          center: initial,
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          styles: googleStyle(),
          backgroundColor: mapAppearance().background,
        });
        const listener = map.addListener("click", (e: any) => {
          if (latest.current.pickMode && e.latLng)
            latest.current.onPick?.({
              lat: e.latLng.lat(),
              lng: e.latLng.lng(),
            });
        });
        let markers: any[] = [];
        instance = {
          appearance: () =>
            map.setOptions({
              styles: googleStyle(),
              backgroundColor: mapAppearance().background,
            }),
          destroy: () => {
            listener.remove();
            markers.forEach((m) => m.setMap(null));
          },
          focus: (p) => {
            map.panTo(p);
            map.setZoom(15);
            map.panBy(
              0,
              ((latest.current.bottomInset || 0) -
                (latest.current.topInset || 0)) /
                2,
            );
          },
          fit: (items) => {
            const bounds = new g.maps.LatLngBounds();
            items.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
            map.fitBounds(bounds, {
              top: (latest.current.topInset || 0) + 24,
              bottom: (latest.current.bottomInset || 0) + 24,
              left: 24,
              right: 24,
            });
          },
          pins: (items, selected) => {
            const palette = mapAppearance();
            markers.forEach((m) => m.setMap(null));
            markers = items.map((pin) => {
              const m = new g.maps.Marker({
                position: { lat: pin.lat, lng: pin.lng },
                map,
                title: `地图店铺：${pin.name}`,
                label: {
                  text: `★ ${pin.rating}`,
                  color: pin.id === selected ? palette.onAccent : palette.text,
                },
                icon: {
                  path: g.maps.SymbolPath.CIRCLE,
                  scale: 24,
                  fillColor:
                    pin.id === selected ? palette.accent : palette.surface,
                  fillOpacity: 1,
                  strokeColor: palette.accent,
                  strokeWeight: 2,
                },
              });
              m.addListener("click", () => latest.current.onSelect?.(pin.id));
              return m;
            });
          },
          search: async (text) => {
            const { Place } = await g.maps.importLibrary("places");
            const response = await Place.searchByText({
              textQuery: text,
              fields: ["displayName", "formattedAddress", "location"],
              maxResultCount: 5,
              locationBias: map.getCenter(),
            });
            return (response.places || [])
              .filter((p: any) => p.location)
              .map((p: any) => ({
                lat: p.location.lat(),
                lng: p.location.lng(),
                name: p.displayName,
                address: p.formattedAddress,
              }));
          },
        };
      } else {
        (window as any)._AMapSecurityConfig = {
          securityJsCode: process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE || "",
        };
        await loadScript(
          "amap-sdk",
          `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(keys.amap!)}`,
        );
        if (cancelled || !host.current) return;
        const A = (window as any).AMap;
        if (!A) throw new Error("高德地图未能初始化");
        const [lat, lng] = wgsToGcj(initial.lat, initial.lng);
        const map = new A.Map(host.current, {
          center: [lng, lat],
          zoom: 13,
          viewMode: "2D",
          mapStyle: amapStyle(),
        });
        let markers: any[] = [];
        map.on("click", (e: any) => {
          if (latest.current.pickMode) {
            const [y, x] = gcjToWgs(e.lnglat.getLat(), e.lnglat.getLng());
            latest.current.onPick?.({ lat: y, lng: x });
          }
        });
        instance = {
          appearance: () => map.setMapStyle(amapStyle()),
          destroy: () => map.destroy(),
          focus: (p) => {
            const [y, x] = wgsToGcj(p.lat, p.lng);
            map.setZoomAndCenter(15, [x, y]);
            map.panBy(
              0,
              ((latest.current.topInset || 0) -
                (latest.current.bottomInset || 0)) /
                2,
            );
          },
          fit: () => {
            if (markers.length)
              map.setFitView(
                markers,
                false,
                [
                  (latest.current.topInset || 0) + 24,
                  24,
                  (latest.current.bottomInset || 0) + 24,
                  24,
                ],
                14,
              );
          },
          pins: (items, selected) => {
            map.remove(markers);
            markers = items.map((pin) => {
              const [y, x] = wgsToGcj(pin.lat, pin.lng);
              const m = new A.Marker({
                position: [x, y],
                content: label(pin, pin.id === selected),
                offset: new A.Pixel(-27, -40),
                title: `地图店铺：${pin.name}`,
              });
              m.on("click", () => latest.current.onSelect?.(pin.id));
              return m;
            });
            map.add(markers);
          },
          search: (text) =>
            new Promise((resolve, reject) => {
              const timer = setTimeout(
                () => reject(new Error("店铺搜索超时，请重试或直接在地图选点")),
                12000,
              );
              A.plugin("AMap.PlaceSearch", () => {
                const search = new A.PlaceSearch({ pageSize: 5, city: "全国" });
                search.search(text, (status: string, result: any) => {
                  clearTimeout(timer);
                  if (status === "no_data") {
                    resolve([]);
                    return;
                  }
                  if (status !== "complete") {
                    reject(new Error("搜索失败，请检查高德服务权限"));
                    return;
                  }
                  resolve(
                    (result.poiList?.pois || []).map((p: any) => {
                      const [y, x] = gcjToWgs(p.location.lat, p.location.lng);
                      return {
                        lat: y,
                        lng: x,
                        name: p.name,
                        address: [
                          p.pname,
                          p.cityname,
                          p.adname,
                          p.address,
                        ].join(""),
                        city: p.cityname,
                      };
                    }),
                  );
                });
              });
            }),
        };
      }
      if (cancelled) {
        instance?.destroy();
        return;
      }
      setAdapter({
        ...instance!,
        context: `${props.provider}:${!!props.demo}`,
      });
      setLoading(false);
    }
    init().catch((e) => {
      if (!cancelled) {
        setError(e.message);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
      abort.abort();
      instance?.destroy();
    };
  }, [props.provider, props.demo]);
  useEffect(() => {
    activeAdapter?.appearance?.();
    activeAdapter?.pins(props.entries, props.selectedId);
  }, [activeAdapter, props.entries, props.selectedId, theme]);
  useEffect(() => {
    if (
      !props.focus &&
      (props.entries.length || (props.demo && props.provider === "osm")) &&
      props.bottomInset !== undefined
    )
      activeAdapter?.fit?.(props.entries);
  }, [
    activeAdapter,
    props.entries,
    props.focus,
    props.topInset,
    props.bottomInset,
    props.demo,
    props.provider,
  ]);
  useEffect(() => {
    if (props.focus) activeAdapter?.focus(props.focus);
  }, [activeAdapter, props.focus, props.topInset, props.bottomInset]);
  async function search() {
    if (!activeAdapter?.search || !term.trim()) return;
    setSearching(true);
    setError("");
    try {
      setResults(await activeAdapter.search(term.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "搜索失败");
    } finally {
      setSearching(false);
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      setError("浏览器不支持定位，请手动在地图选择位置");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const point = { lat: p.coords.latitude, lng: p.coords.longitude };
        activeAdapter?.focus(point);
        if (props.pickMode) props.onPick?.(point);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setError("无法获取位置，请允许定位或手动在地图选点");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }
  return (
    <div className={`map-shell ${props.pickMode ? "picking" : ""}`}>
      <div ref={host} className="map-canvas" aria-label="美食足迹地图" />
      {props.showProvider !== false && (
        <div className="map-provider">
          <MapPin size={14} />
          <select
            aria-label="地图服务"
            value={props.provider}
            onChange={(e) =>
              props.onProviderChange(e.target.value as MapProvider)
            }
          >
            <option value="osm">OpenStreetMap</option>
            <option value="google">
              Google 地图{!keys.google ? " · 需密钥" : ""}
            </option>
            <option value="amap">
              高德地图{!keys.amap ? " · 需密钥" : ""}
            </option>
          </select>
        </div>
      )}
      {props.pickMode && activeAdapter?.search && (
        <div
          role="search"
          className="place-search"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              search();
            }
          }}
        >
          <Search size={17} />
          <input
            aria-label="搜索地图店铺"
            placeholder="搜索店名或地址，包含城市更准确"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
          <button disabled={searching} type="button" onClick={search}>
            {searching ? <LoaderCircle className="spin" size={16} /> : "搜索"}
          </button>
          {results.length > 0 && (
            <div className="place-results">
              {results.map((p, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => {
                    props.onPick?.(p);
                    activeAdapter.focus(p);
                    setResults([]);
                  }}
                >
                  <strong>{p.name}</strong>
                  <span>{p.address}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {props.pickMode && props.provider === "osm" && (
        <div className="map-hint">
          <MapPin size={14} />
          点击地图选位置，或在下方输入经纬度
        </div>
      )}
      {loading && (
        <div className="map-loading">
          <LoaderCircle className="spin" size={24} />
          <span>正在展开你的美食地图…</span>
        </div>
      )}
      {error && (
        <div className="map-error" role="status">
          <AlertCircle size={20} />
          <p>{error}</p>
          <button
            type="button"
            onClick={() => {
              if (props.provider !== "osm") props.onProviderChange("osm");
              else setError("");
            }}
          >
            {" "}
            {props.provider !== "osm" ? "使用 OpenStreetMap" : "关闭提示"}
          </button>
        </div>
      )}
      {tileError && !error && (
        <div className="tile-warning" role="status">
          底图暂时无法加载，可切换服务；记录和坐标仍可使用。
        </div>
      )}
      <button
        type="button"
        className="locate-button"
        onClick={locate}
        aria-label="定位到我"
        disabled={locating || !activeAdapter}
      >
        {locating ? (
          <LoaderCircle className="spin" size={18} />
        ) : (
          <LocateFixed size={18} />
        )}
      </button>
      <span className="map-caption">EVERY BITE, A LITTLE MEMORY.</span>
    </div>
  );
}
