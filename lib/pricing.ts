import type { Entry, MealRecordInput } from "./types";
export const PRICE_UNITS = [
  { id: "CNY", label: "人民币 ¥" },
  { id: "JPY", label: "日元 JP¥" },
  { id: "USD", label: "美元 $" },
  { id: "WASH", label: "🫧 次洗碗" },
  { id: "TEA", label: "🧋 杯奶茶" },
  { id: "HUG", label: "🤗 个拥抱" },
  { id: "HEART", label: "💗 颗小心心" },
  { id: "CUSTOM", label: "✦ 自定义单位" },
] as const;
export function formatPrice(
  value: Pick<MealRecordInput, "price" | "currency" | "customUnit">,
) {
  if (value.price === null) return "";
  const amount = value.price.toLocaleString("zh-CN", {
    maximumFractionDigits: 2,
  });
  switch (value.currency) {
    case "CNY":
      return `¥${amount}`;
    case "JPY":
      return `JP¥${amount}`;
    case "USD":
      return `$${amount}`;
    case "WASH":
      return `${amount} 次洗碗`;
    case "TEA":
      return `${amount} 杯奶茶`;
    case "HUG":
      return `${amount} 个拥抱`;
    case "HEART":
      return `${amount} 颗小心心`;
    case "CUSTOM":
      return `${amount} ${value.customUnit || "份心意"}`;
    default:
      return amount;
  }
}
export function priceSuffix(entry: Pick<Entry, "kind" | "currency">) {
  return ["CNY", "JPY", "USD"].includes(entry.currency)
    ? entry.kind === "recipe"
      ? " / 份"
      : " / 人"
    : "";
}
