// Persist WGS-84. AMap displays GCJ-02 coordinates within mainland China.
const a = 6378245.0,
  ee = 0.00669342162296594323;
function outside(lat: number, lng: number) {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}
function offset(lat: number, lng: number): [number, number] {
  const x = lng - 105,
    y = lat - 35;
  let dlat =
    -100 +
    2 * x +
    3 * y +
    0.2 * y * y +
    0.1 * x * y +
    0.2 * Math.sqrt(Math.abs(x));
  let dlng =
    300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  dlat +=
    ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3;
  dlat +=
    ((20 * Math.sin(y * Math.PI) + 40 * Math.sin((y / 3) * Math.PI)) * 2) / 3;
  dlat +=
    ((160 * Math.sin((y / 12) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30)) *
      2) /
    3;
  dlng +=
    ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3;
  dlng +=
    ((20 * Math.sin(x * Math.PI) + 40 * Math.sin((x / 3) * Math.PI)) * 2) / 3;
  dlng +=
    ((150 * Math.sin((x / 12) * Math.PI) + 300 * Math.sin((x / 30) * Math.PI)) *
      2) /
    3;
  const rad = (lat / 180) * Math.PI,
    magic = 1 - ee * Math.sin(rad) ** 2,
    sqrt = Math.sqrt(magic);
  return [
    (dlat * 180) / (((a * (1 - ee)) / (magic * sqrt)) * Math.PI),
    (dlng * 180) / ((a / sqrt) * Math.cos(rad) * Math.PI),
  ];
}
export function wgsToGcj(lat: number, lng: number): [number, number] {
  if (outside(lat, lng)) return [lat, lng];
  const [dy, dx] = offset(lat, lng);
  return [lat + dy, lng + dx];
}
export function gcjToWgs(lat: number, lng: number): [number, number] {
  if (outside(lat, lng)) return [lat, lng];
  let y = lat,
    x = lng;
  for (let i = 0; i < 5; i++) {
    const [gy, gx] = wgsToGcj(y, x);
    y -= gy - lat;
    x -= gx - lng;
  }
  return [y, x];
}
