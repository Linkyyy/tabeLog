export type MapProvider = "osm" | "google" | "amap";
export type Photo = { id: string; url: string };
export type EntryKind = "visit" | "recipe";
export type Visibility = "private" | "public";
export type User = { id: string; name: string; email: string };
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
  id: string;
  name: string;
  address: string;
  city: string;
  cuisine: string;
  lat: number;
  lng: number;
  rating: number;
  price: number | null;
  currency: "CNY" | "JPY" | "USD";
  visitedAt: string;
  review: string;
  favorite: boolean;
  photos: Photo[];
  createdAt: string;
  updatedAt: string;
};
export type EntryInput = Omit<
  Entry,
  "id" | "photos" | "createdAt" | "updatedAt" | "ownerId" | "authorName"
> & { keepPhotoIds?: string[] };
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
export const CURRENCIES = { CNY: "¥", JPY: "JP¥", USD: "$" };
