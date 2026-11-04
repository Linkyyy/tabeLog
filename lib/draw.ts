// Partial Fisher-Yates: each dish can appear at most once in a draw.
export function drawDishes<T>(
  items: readonly T[],
  count: number,
  random: () => number = Math.random,
): T[] {
  const pool = [...items];
  const size = Math.min(pool.length, Math.max(0, Math.floor(count)));
  for (let i = 0; i < size; i++) {
    const j = i + Math.floor(random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, size);
}
