import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRecipes } from "../lib/recipe-import";
import { parseEntry, parseMealRecord } from "../lib/validation";
import {
  applyRecipeSuggestion,
  undoRecipeSuggestion,
  type RecipeSuggestion,
} from "../lib/recipe-suggestion";
import { recipeLink } from "../lib/recipe-links";
import { parseRecipeArticle, readInitialState } from "../lib/article-parser";
import { fetchRecipeArticle, publicAddress } from "../lib/article-fetch";
import { formatPrice } from "../lib/pricing";
import { firstMeal, mealStats } from "../lib/meal-records";
import type { Entry } from "../lib/types";
const draft = parseRecipes([
  {
    name: "番茄炒蛋",
    ingredients: "番茄 2 个\n鸡蛋 3 个",
    steps: "1. 炒熟鸡蛋。\n2. 番茄炒软后拌匀。",
    minutes: 15,
    servings: 3,
  },
])[0];
const source = {
  url: "https://www.xiachufang.com/recipe/123/",
  platform: "下厨房",
  title: "番茄炒蛋",
};
test("AI fills recipe fields only, preserves manual edits, and undo preserves later changes", () => {
  const initial = {
    ...draft,
    review: "自己写的心得",
    price: 2,
    currency: "HUG" as const,
    recipe: {
      ...draft.recipe!,
      ingredients: "",
      steps: "",
      minutes: null,
      servings: 2,
    },
    keepPhotoIds: ["existing-photo"],
  };
  const suggestion: RecipeSuggestion = {
    draft: {
      ...draft,
      visibility: "public",
      rating: 1,
      favorite: true,
      visitedAt: "2000-01-01",
      price: 9000,
    },
    source,
    method: "name",
  };
  const snapshot = structuredClone(initial),
    current = {
      ...initial,
      recipe: { ...initial.recipe, steps: "等待时自己写下的做法" },
    };
  const result = applyRecipeSuggestion(current, snapshot, suggestion, false);
  assert.equal(result.form.recipe?.ingredients, draft.recipe?.ingredients);
  assert.equal(result.form.recipe?.steps, current.recipe.steps);
  assert.equal(result.form.recipe?.servings, 3);
  for (const key of [
    "visibility",
    "rating",
    "favorite",
    "visitedAt",
    "keepPhotoIds",
    "price",
    "currency",
    "review",
  ] as const)
    assert.deepEqual(result.form[key], initial[key]);
  const later = {
    ...result.form,
    recipe: { ...result.form.recipe!, ingredients: "填入后又手动修改" },
  };
  const undone = undoRecipeSuggestion(later, current, result.form);
  assert.equal(undone.recipe?.ingredients, "填入后又手动修改");
  assert.equal(undone.recipe?.steps, current.recipe.steps);
  assert.equal(undone.recipe?.servings, 2);
  assert.equal(undone.source, undefined);
  const touched = applyRecipeSuggestion(
    initial,
    snapshot,
    suggestion,
    false,
    new Set(["servings"]),
  );
  assert.equal(touched.form.recipe?.servings, 2);
  const replaced = applyRecipeSuggestion(current, snapshot, suggestion, true);
  assert.equal(replaced.form.review, draft.review);
  assert.equal(replaced.form.recipe?.steps, current.recipe.steps);
});
test("recipe links accept platform share text and reject URL tricks and unsupported targets", () => {
  const link = recipeLink("分享给你 http://xhslink.com/a/abc。 复制正文");
  assert.equal(link?.url.href, "https://xhslink.com/a/abc");
  for (const input of [
    "https://127.0.0.1/a",
    "https://www.xiaohongshu.com.attacker.test/",
    "https://user:pass@www.xiaohongshu.com/explore/x",
    "https://www.xiaohongshu.com:444/x",
    "https://mp.weixin.qq.com.evil.test/a",
    "https://example.com",
    "file:///etc/passwd",
  ])
    assert.equal(recipeLink(input), null, input);
  assert.equal(
    recipeLink("https://www.douguo.com/cookbook/123.html#steps")?.url.hash,
    "",
  );
});
test("public article parsers decode nested Recipe JSON-LD, sections, durations and source", () => {
  const recipe = {
    "@type": "Recipe",
    name: "番茄炒蛋",
    recipeIngredient: ["番茄 2 个", "鸡蛋 3 个"],
    recipeInstructions: [
      {
        "@type": "HowToSection",
        itemListElement: [
          { "@type": "HowToStep", text: "<b>炒熟</b>鸡蛋。" },
          { "@type": "HowToStep", text: "番茄炒软，混合。" },
        ],
      },
    ],
    prepTime: "PT5M",
    cookTime: "PT10M",
    recipeYield: "3 人份",
    recipeCuisine: "Chinese",
  };
  const article = parseRecipeArticle(
    `<html><head><title>我的菜谱</title><script type="application/ld+json">${JSON.stringify({ "@graph": [{ "@type": "WebPage" }, recipe] })}</script></head><body></body></html>`,
    source.url,
  );
  assert.equal(article.draft?.name, "番茄炒蛋");
  assert.equal(article.draft?.recipe?.minutes, 15);
  assert.equal(article.draft?.recipe?.servings, 3);
  assert.equal(article.draft?.cuisine, "中餐");
  assert.match(article.draft?.recipe?.steps || "", /炒熟鸡蛋/);
  assert.equal(article.source.platform, "下厨房");
});
test("Xiaohongshu public state is decoded without executing scripts and selects the requested note", () => {
  const text =
    "食材：鸡蛋 3 个，番茄 2 个。做法：鸡蛋炒熟，番茄切块炒出汁，再加入鸡蛋翻拌均匀。";
  const state = {
    note: {
      noteDetailMap: {
        abc: { note: { title: '一份带 "引号}" 的菜谱', desc: text } },
        other: {
          note: { title: "推荐内容", desc: "错误的相关笔记内容不要导入" },
        },
      },
    },
  };
  const article = parseRecipeArticle(
    `<script>window.__INITIAL_STATE__=${JSON.stringify(state).replace('"other":', '"unused":undefined,"other":')};globalThis.__executed=true;</script>`,
    "https://www.xiaohongshu.com/explore/abc",
  );
  assert.equal(article.text, text);
  assert.match(article.source.title, /引号/);
  assert.equal((globalThis as Record<string, unknown>).__executed, undefined);
  assert.equal(
    readInitialState(
      'window.__INITIAL_STATE__={"x":undefined,"quoted":"undefined}"};evil()',
    ) &&
      JSON.stringify(
        readInitialState(
          'window.__INITIAL_STATE__={"x":undefined,"quoted":"undefined}"}',
        ),
      ),
    JSON.stringify({ x: null, quoted: "undefined}" }),
  );
  assert.equal(readInitialState("window.__INITIAL_STATE__={x:alert(1)}"), null);
  const wrong = parseRecipeArticle(
    `<script>window.__INITIAL_STATE__=${JSON.stringify(state)}</script>`,
    "https://www.xiaohongshu.com/explore/missing",
  );
  assert.doesNotMatch(wrong.text, /错误的相关/);
});
test("article text removes navigation and scripts while preserving readable WeChat recipe text", () => {
  const article = parseRecipeArticle(
    '<html><head><title>家常菜</title></head><body><nav>推荐广告</nav><div id="js_content"><p>食材：番茄 2 个 &amp; 鸡蛋 3 个。</p><p>做法步骤：鸡蛋炒熟，番茄炒出汁，混合均匀。盐少许，装盘即可。特别适合忙碌的工作日晚餐。</p></div><script>secretScript()</script></body></html>',
    "https://mp.weixin.qq.com/s/test",
  );
  assert.match(article.text, /& 鸡蛋/);
  assert.doesNotMatch(article.text, /secretScript|推荐广告/);
});
test("article fetch checks every redirect and DNS address, stops loops and never fetches private hosts", async () => {
  let calls = 0;
  const resolve = async () => [{ address: "93.184.216.34", family: 4 }];
  const result = await fetchRecipeArticle("https://xhslink.com/a/abc", {
    resolve,
    request: async (url) => {
      calls++;
      return url.hostname === "xhslink.com"
        ? {
            status: 302,
            location: "https://www.xiaohongshu.com/explore/abc",
            type: "",
            html: "",
          }
        : { status: 200, type: "text/html", html: "recipe" };
    },
  });
  assert.equal(calls, 2);
  assert.equal(result.html, "recipe");
  for (const addresses of [
    [{ address: "127.0.0.1", family: 4 }],
    [
      { address: "93.184.216.34", family: 4 },
      { address: "169.254.169.254", family: 4 },
    ],
  ])
    await assert.rejects(
      fetchRecipeArticle(source.url, {
        resolve: async () => addresses,
        request: async () => {
          throw new Error("must not request");
        },
      }),
      /安全/,
    );
  await assert.rejects(
    fetchRecipeArticle(source.url, {
      resolve,
      request: async () => ({
        status: 302,
        location: "https://127.0.0.1/admin",
        type: "",
        html: "",
      }),
    }),
    /其他网站/,
  );
  await assert.rejects(
    fetchRecipeArticle(source.url, {
      resolve,
      request: async () => ({
        status: 302,
        location: source.url,
        type: "",
        html: "",
      }),
    }),
    /跳转次数/,
  );
  for (const address of [
    "127.0.0.1",
    "10.1.2.3",
    "192.168.0.1",
    "169.254.169.254",
    "::1",
    "::ffff:127.0.0.1",
    "fe80::1",
    "2001:db8::1",
    "224.0.0.1",
  ])
    assert.equal(publicAddress(address), false, address);
  assert.equal(publicAddress("93.184.216.34"), true);
  assert.equal(publicAddress("2606:4700:4700::1111"), true);
});
test("optional prices, fun units, provenance and individual meal reviews are validated", () => {
  assert.equal(
    parseEntry({ ...draft, price: 2, currency: "WASH", source }).price,
    2,
  );
  assert.equal(formatPrice({ price: 2, currency: "WASH" }), "2 次洗碗");
  assert.equal(
    formatPrice({ price: 1, currency: "CUSTOM", customUnit: "次遛狗" }),
    "1 次遛狗",
  );
  assert.equal(formatPrice({ price: 0, currency: "CNY" }), "¥0");
  assert.equal(formatPrice({ price: null, currency: "CNY" }), "");
  for (const patch of [
    { currency: "CUSTOM", customUnit: "" },
    { currency: "CUSTOM", customUnit: "x".repeat(13) },
    { price: Infinity },
    { price: -1 },
    { currency: "BAD" },
    { source: { ...source, url: "javascript:alert(1)" } },
    { source: { ...source, url: "https://u:p@www.xiachufang.com/" } },
  ])
    assert.throws(() => parseEntry({ ...draft, ...patch }));
  const review = parseMealRecord({
    ...draft,
    review: "这次少放盐更好吃",
    price: 1.5,
    currency: "TEA",
    ownerId: "forged",
    entryId: "forged",
    photos: [{ id: "forged" }],
  });
  assert.equal(review.review, "这次少放盐更好吃");
  assert.ok(!("ownerId" in review));
  assert.ok(!("photos" in review));
  assert.throws(() => parseMealRecord({ ...review, visitedAt: "2025-02-30" }));
  assert.throws(() => parseMealRecord({ ...review, rating: 5.5 }));
  const entry: Entry = {
    ...draft,
    id: "one",
    ownerId: "test",
    authorName: "测试",
    photos: [],
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    visitedAt: "2025-01-01",
    rating: 5,
  };
  assert.equal(firstMeal(entry).initial, true);
  assert.deepEqual(
    mealStats(entry, { count: 2, ratingTotal: 7, lastEatenAt: "2025-02-01" }),
    { count: 3, averageRating: 4, ratingTotal: 12, lastEatenAt: "2025-02-01" },
  );
});
