import { test } from "node:test";
import assert from "node:assert/strict";
import { wgsToGcj, gcjToWgs } from "../lib/coordinates";
import { parseEntry } from "../lib/validation";
const valid = {
  name: "测试食堂",
  address: "徐汇区",
  city: "上海",
  cuisine: "日料",
  lat: 31.2,
  lng: 121.4,
  rating: 5,
  price: 80,
  currency: "CNY",
  visitedAt: "2025-06-01",
  review: "很棒",
  favorite: true,
};
test("mainland coordinates use the correct datum and round trip accurately", () => {
  const [lat, lng] = wgsToGcj(31.2304, 121.4737);
  assert.ok(Math.abs(lat - 31.22846) < 0.0001);
  assert.ok(Math.abs(lng - 121.47822) < 0.0001);
  const original = gcjToWgs(lat, lng);
  assert.ok(Math.abs(original[0] - 31.2304) < 1e-7);
  assert.ok(Math.abs(original[1] - 121.4737) < 1e-7);
});
test("coordinates outside mainland are unchanged", () => {
  assert.deepEqual(wgsToGcj(35.6762, 139.6503), [35.6762, 139.6503]);
  assert.deepEqual(gcjToWgs(40.7, -74), [40.7, -74]);
});
test("entry validation accepts real entries and rejects malformed dates and numbers", () => {
  assert.equal(parseEntry({ ...valid, name: "  测试食堂  " }).name, "测试食堂");
  for (const patch of [
    { lat: NaN },
    { lng: 181 },
    { rating: 3.5 },
    { price: -10 },
    { currency: "EUR" },
    { name: " " },
    { visitedAt: "2025-02-30" },
    { visitedAt: "2025-99-99" },
    { visitedAt: "2099-01-01" },
    { favorite: "true" },
    { keepPhotoIds: ["../../etc/passwd"] },
  ])
    assert.throws(() => parseEntry({ ...valid, ...patch }));
});
