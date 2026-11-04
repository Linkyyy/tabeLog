import type { Entry, MealRecord, MealStats } from "./types";
export function firstMeal(entry: Entry): MealRecord {
  return {
    id: "initial",
    entryId: entry.id,
    initial: true,
    visitedAt: entry.visitedAt,
    rating: entry.rating,
    review: entry.review,
    price: entry.price,
    currency: entry.currency,
    ...(entry.customUnit ? { customUnit: entry.customUnit } : {}),
    photos: entry.photos,
    createdAt: entry.createdAt,
  };
}
export function mealStats(
  entry: Entry,
  extra: { count: number; ratingTotal: number; lastEatenAt: string | null },
): MealStats {
  return {
    count: extra.count + 1,
    ratingTotal: entry.rating + extra.ratingTotal,
    averageRating:
      Math.round(
        ((entry.rating + extra.ratingTotal) / (extra.count + 1)) * 10,
      ) / 10,
    lastEatenAt:
      extra.lastEatenAt && extra.lastEatenAt > entry.visitedAt
        ? extra.lastEatenAt
        : entry.visitedAt,
  };
}
