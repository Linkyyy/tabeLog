export type MapProvider = "osm" | "google" | "amap";
export type Photo = { id: string; url: string };
export type EntryKind = "visit" | "recipe";
export type Visibility = "private" | "public";
export type User = { id: string; name: string; email: string };
export type RecipeSource = { url: string; platform: string; title: string };
export type Recipe = {
  ingredients: string;
  steps: string;
  minutes: number | null;
  servings: number;
  difficulty: "简单" | "进阶" | "挑战";
};
export type Entry = {
  kind: EntryKind;
  visibility: Visibility;
  ownerId: string;
  authorName: string;
  recipe?: Recipe;
  source?: RecipeSource;
  id: string;
  name: string;
  address: string;
  city: string;
  cuisine: string;
  lat: number;
  lng: number;
  rating: number;
  price: number | null;
  currency: "CNY" | "JPY" | "USD" | "WASH" | "TEA" | "HUG" | "HEART" | "CUSTOM";
  customUnit?: string;
  mealStats?: MealStats;
  visitedAt: string;
  review: string;
  favorite: boolean;
  photos: Photo[];
  createdAt: string;
  updatedAt: string;
};
export type EntryInput = Omit<
  Entry,
  | "id"
  | "photos"
  | "createdAt"
  | "updatedAt"
  | "ownerId"
  | "authorName"
  | "mealStats"
> & { keepPhotoIds?: string[] };
export type MealStats = {
  count: number;
  averageRating: number;
  lastEatenAt: string;
  ratingTotal?: number;
};
export type MealRecordInput = Pick<
  EntryInput,
  "visitedAt" | "rating" | "review" | "price" | "currency" | "customUnit"
>;
export type MealRecord = MealRecordInput & {
  id: string;
  entryId: string;
  photos: Photo[];
  createdAt: string;
  initial?: boolean;
};
export type Location = {
  lat: number;
  lng: number;
  name?: string;
  address?: string;
  city?: string;
};
export const CUISINES = [
  "日料",
  "中餐",
  "西餐",
  "咖啡",
  "甜点",
  "小吃",
  "其他",
];
export const CURRENCIES = {
  CNY: "¥",
  JPY: "JP¥",
  USD: "$",
  WASH: "次洗碗",
  TEA: "杯奶茶",
  HUG: "个拥抱",
  HEART: "颗小心心",
  CUSTOM: "自定义",
};
