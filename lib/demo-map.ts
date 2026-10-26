import type * as Leaflet from "leaflet";
import type { Feature, FeatureCollection } from "geojson";

const labels = [
  { name: "黄浦江", lat: 31.2345, lng: 121.4939, water: true, angle: -32 },
  { name: "苏州河", lat: 31.2438, lng: 121.4777, water: true, angle: -22 },
  { name: "外滩", lat: 31.239, lng: 121.4904 },
  { name: "陆家嘴", lat: 31.2348, lng: 121.5051 },
  { name: "东方明珠", lat: 31.2397, lng: 121.4998 },
  { name: "南京东路", lat: 31.2382, lng: 121.4832 },
  { name: "四川中路", lat: 31.2415, lng: 121.4879, angle: -68 },
  { name: "福州路", lat: 31.2351, lng: 121.4854 },
  { name: "滨江公园", lat: 31.2392, lng: 121.4967 },
  { name: "上海中心", lat: 31.2326, lng: 121.5056 },
];

// A local, attributed OSM snapshot for DEMO records only. All real records keep
// using their selected online provider. Geometry remains WGS-84 and interactive.
export async function addDemoMap(
  L: typeof Leaflet,
  map: Leaflet.Map,
  signal: AbortSignal,
) {
  const response = await fetch("/maps/shanghai.geojson", { signal });
  if (!response.ok) throw new Error("示例地图加载失败，请重试");
  const data = (await response.json()) as FeatureCollection;
  if (signal.aborted) return () => {};
  const style = (feature?: Feature): Leaflet.PathOptions => {
    const kind = feature?.properties?.kind;
    if (kind === "road") {
      const width = Number(feature?.properties?.width) || 8;
      const metersPerPixel =
        (156543.03392 * Math.cos((31.2385 * Math.PI) / 180)) /
        2 ** map.getZoom();
      return {
        className: `basemap-road ${width >= 20 ? "arterial" : ""}`,
        color: width >= 20 ? "var(--map-arterial)" : "var(--map-road)",
        weight: Math.max(1.1, (width / metersPerPixel) * 0.7),
        opacity: 1,
        lineCap: "round",
        lineJoin: "round",
        interactive: false,
      };
    }
    return {
      className: `basemap-${kind}`,
      fillColor: `var(--map-${kind})`,
      fillOpacity: 1,
      stroke: false,
      interactive: false,
    };
  };
  const vectors = L.geoJSON(data, { style, interactive: false }).addTo(map);
  const names = L.layerGroup(
    labels.map((label) => {
      const text = document.createElement("span");
      text.textContent = label.name;
      text.className = `basemap-label ${label.water ? "water-label" : ""}`;
      if (label.angle) text.style.transform = `rotate(${label.angle}deg)`;
      return L.marker([label.lat, label.lng], {
        icon: L.divIcon({
          html: text,
          className: "basemap-label-host",
          iconSize: [80, 18],
          iconAnchor: [40, 9],
        }),
        interactive: false,
        keyboard: false,
      });
    }),
  ).addTo(map);
  const redraw = () => vectors.setStyle(style);
  map.on("zoomend", redraw);
  const attribution =
    '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> · 上海示例底图';
  map.attributionControl.addAttribution(attribution);
  return () => {
    map.off("zoomend", redraw);
    map.removeLayer(vectors);
    map.removeLayer(names);
    map.attributionControl.removeAttribution(attribution);
  };
}
