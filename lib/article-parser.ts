import { load } from "cheerio/slim";
import { recipeLink } from "./recipe-links";
import { parseRecipes } from "./recipe-import";
import type { EntryInput, RecipeSource } from "./types";
type ObjectValue = Record<string, unknown>;
const object = (v: unknown): ObjectValue | undefined =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as ObjectValue)
    : undefined;
const clean = (value: unknown) =>
  typeof value === "string"
    ? load(value)
        .text()
        .replace(/\r/g, "")
        .replace(/[\t ]+/g, " ")
        .replace(/\n\s*\n+/g, "\n")
        .trim()
    : "";
export type RecipeArticle = {
  text: string;
  source: RecipeSource;
  draft?: EntryInput;
};
function duration(value: unknown) {
  if (typeof value !== "string") return 0;
  const m = value.match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i,
  );
  return m
    ? Number(m[1] || 0) * 1440 +
        Number(m[2] || 0) * 60 +
        Number(m[3] || 0) +
        Math.ceil(Number(m[4] || 0) / 60)
    : 0;
}
function instructions(value: unknown): string[] {
  if (typeof value === "string") return clean(value) ? [clean(value)] : [];
  if (Array.isArray(value)) return value.flatMap(instructions);
  const v = object(value);
  return v ? instructions(v.itemListElement ?? v.text ?? v.description) : [];
}
function structuredRecipe(value: unknown): EntryInput | undefined {
  const queue: unknown[] = [value];
  let visited = 0;
  while (queue.length && visited++ < 10000) {
    const raw = queue.shift();
    if (Array.isArray(raw)) {
      queue.push(...raw);
      continue;
    }
    const v = object(raw);
    if (!v) continue;
    const types = Array.isArray(v["@type"]) ? v["@type"] : [v["@type"]];
    if (
      types.some((t) => typeof t === "string" && /(?:^|[\/#])Recipe$/.test(t))
    ) {
      const ingredients = Array.isArray(v.recipeIngredient)
        ? v.recipeIngredient.map(clean).filter(Boolean)
        : [];
      const steps = instructions(v.recipeInstructions);
      const name = clean(v.name);
      if (name && ingredients.length && steps.length) {
        const total =
          duration(v.totalTime) || duration(v.prepTime) + duration(v.cookTime);
        const yieldText = Array.isArray(v.recipeYield)
          ? v.recipeYield.join(" ")
          : String(v.recipeYield || "");
        const servings = Number(yieldText.match(/\d+/)?.[0] || 2);
        const category = String(v.recipeCuisine || v.recipeCategory || "");
        const cuisine = /chinese|中餐|中式|川菜|粤菜|家常/i.test(category)
          ? "中餐"
          : /japan|日料|日本/i.test(category)
            ? "日料"
            : /dessert|甜点|烘焙/i.test(category)
              ? "甜点"
              : /western|italian|french|西餐/i.test(category)
                ? "西餐"
                : "其他";
        try {
          return parseRecipes([
            {
              name: name.slice(0, 100),
              cuisine,
              description: clean(v.description).slice(0, 10000),
              ingredients: ingredients.join("\n"),
              steps: steps
                .map((s, i) => (/^\d+[.、．]/.test(s) ? s : `${i + 1}. ${s}`))
                .join("\n"),
              minutes: total > 0 && total <= 1440 ? total : null,
              servings: servings >= 1 && servings <= 100 ? servings : 2,
              difficulty: "简单",
            },
          ])[0];
        } catch {
          /* Try readable article text if the structured data is incomplete. */
        }
      }
    }
    for (const child of Object.values(v))
      if (child && typeof child === "object") queue.push(child);
  }
}
// Decode JSON embedded in public HTML; never execute a site's JavaScript.
export function readInitialState(script: string): unknown {
  const match = /\b__INITIAL_STATE__\s*=\s*/.exec(script);
  if (!match) return null;
  const start = script.indexOf("{", match.index + match[0].length);
  if (start < 0) return null;
  let depth = 0,
    quoted = false,
    escaped = false,
    normalized = "";
  for (let i = start; i < script.length; i++) {
    const c = script[i];
    if (quoted) {
      normalized += c;
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quoted = false;
      continue;
    }
    if (c === '"') {
      quoted = true;
      normalized += c;
      continue;
    }
    if (
      script.startsWith("undefined", i) &&
      !/[\w$]/.test(script[i + 9] || "")
    ) {
      normalized += "null";
      i += 8;
      continue;
    }
    if (c === "{") depth++;
    if (c === "}") depth--;
    normalized += c;
    if (depth === 0) {
      try {
        return JSON.parse(normalized);
      } catch {
        return null;
      }
    }
  }
  return null;
}
export function parseRecipeArticle(html: string, url: string): RecipeArticle {
  const link = recipeLink(url);
  if (!link) throw new Error("Unsupported recipe source");
  const $ = load(html);
  let title = clean(
    $('meta[property="og:title"]').attr("content") ||
      $("h1").first().text() ||
      $("title").text(),
  ).slice(0, 200);
  let draft: EntryInput | undefined;
  $('script[type="application/ld+json"]').each((_, script) => {
    if (draft) return;
    try {
      draft = structuredRecipe(JSON.parse($(script).text()));
    } catch {
      /* Other JSON-LD blocks need not describe recipes. */
    }
  });
  let noteText = "";
  if (link.platform.id === "xiaohongshu") {
    $("script").each((_, script) => {
      if (noteText) return;
      const state = object(readInitialState($(script).text()));
      const notes = object(object(state?.note)?.noteDetailMap);
      if (!notes) return;
      const id = link.url.pathname.match(
        /\/(?:explore|item)\/([a-zA-Z0-9]+)/,
      )?.[1];
      const candidates =
        id && notes[id] ? [notes[id]] : id ? [] : Object.values(notes);
      for (const value of candidates) {
        const note = object(object(value)?.note);
        if (typeof note?.desc === "string" && note.desc.trim().length > 20) {
          noteText = note.desc.trim();
          if (typeof note.title === "string" && note.title.trim())
            title = note.title.trim().slice(0, 200);
          break;
        }
      }
    });
  }
  $(
    "script,style,noscript,template,svg,nav,header,footer,aside,form,button",
  ).remove();
  $("br").replaceWith("\n");
  $("p,li,h1,h2,h3,h4,section").append("\n");
  const candidates = [
    "#js_content",
    "article",
    ".note-content",
    "#detail-desc",
    ".entry-content",
    ".recipe-content",
    ".content",
  ]
    .map((selector) =>
      $(selector)
        .map((_, el) => $(el).text())
        .get()
        .join("\n"),
    )
    .map((t) => clean(t))
    .filter((t) => t.length >= 60);
  const body = clean($("body").text() || $.root().text());
  const description = clean(
    $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content"),
  );
  let text =
    noteText || candidates.sort((a, b) => score(b) - score(a))[0] || body;
  if (text.length < 60 && description.length > text.length) text = description;
  if (draft)
    text = `${draft.name}\n${draft.recipe!.ingredients}\n${draft.recipe!.steps}`;
  return {
    text: text.slice(0, 16000),
    source: {
      url: link.url.href,
      platform: link.platform.name,
      title: title || draft?.name || link.platform.name,
    },
    ...(draft ? { draft } : {}),
  };
}
function score(text: string) {
  return (
    (text.match(/食材|用料|做法|步骤|克|毫升|勺/g)?.length || 0) * 20 +
    Math.min(text.length, 8000) / 100
  );
}
