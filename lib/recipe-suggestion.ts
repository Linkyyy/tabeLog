import type { EntryInput, Recipe, RecipeSource } from "./types";
export type RecipeSuggestion = {
  draft: EntryInput;
  method: "name" | "text" | "article" | "structured";
  source?: RecipeSource;
};
type Key = "name" | "cuisine" | "review" | keyof Recipe;
const keys: Key[] = [
  "name",
  "cuisine",
  "review",
  "ingredients",
  "steps",
  "minutes",
  "servings",
  "difficulty",
];
export function recipeValue(form: EntryInput, key: Key) {
  return key in (form.recipe || {})
    ? form.recipe?.[key as keyof Recipe]
    : form[key as "name" | "cuisine" | "review"];
}
function assign(form: EntryInput, key: Key, value: unknown) {
  if (["name", "cuisine", "review"].includes(key))
    Object.assign(form, { [key]: value });
  else if (form.recipe) Object.assign(form.recipe, { [key]: value });
}
// Only recipe content is considered. Ownership, visibility, photos, date and
// rating never come from the model. Edits made while a request runs also win.
export function applyRecipeSuggestion(
  current: EntryInput,
  snapshot: EntryInput,
  suggestion: RecipeSuggestion,
  replace: boolean,
  touched: ReadonlySet<string> = new Set(),
) {
  const next = {
    ...current,
    recipe: current.recipe ? { ...current.recipe } : undefined,
  };
  let changed = 0;
  for (const key of keys) {
    const value = recipeValue(current, key),
      before = recipeValue(snapshot, key),
      proposed = recipeValue(suggestion.draft, key);
    const defaultMetadata =
      ["cuisine", "servings", "difficulty"].includes(key) && !touched.has(key);
    const blank = value === "" || value === null || value === undefined;
    if (
      value === before &&
      (replace || blank || defaultMetadata) &&
      proposed !== undefined &&
      value !== proposed
    ) {
      assign(next, key, proposed);
      changed++;
    }
  }
  if (
    changed &&
    suggestion.source &&
    JSON.stringify(current.source) === JSON.stringify(snapshot.source)
  )
    next.source = suggestion.source;
  return { form: next, changed };
}
export function undoRecipeSuggestion(
  current: EntryInput,
  before: EntryInput,
  applied: EntryInput,
) {
  const next = {
    ...current,
    recipe: current.recipe ? { ...current.recipe } : undefined,
  };
  for (const key of keys)
    if (recipeValue(current, key) === recipeValue(applied, key))
      assign(next, key, recipeValue(before, key));
  if (JSON.stringify(current.source) === JSON.stringify(applied.source))
    next.source = before.source;
  return next;
}
