import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AI_PROVIDERS,
  parseAIConfig,
  aiRequest,
  aiText,
} from "../lib/ai-providers";
import { parseRecipes, parseRecipeText } from "../lib/recipe-import";
import { parseOrder } from "../lib/order-validation";
const dish = {
  name: "番茄炒蛋",
  ingredients: ["番茄 2 个", "鸡蛋 3 个"],
  steps: ["炒熟鸡蛋。", "番茄炒软，拌匀。"],
  minutes: 15,
  servings: 2,
};
test("imports normalize recipe exports, force privacy and drop foreign ownership, photos and IDs", () => {
  const [recipe] = parseRecipes({
    entries: [
      {
        ...dish,
        id: "foreign",
        ownerId: "someone",
        visibility: "public",
        photos: [{ url: "https://example.com/track.png" }],
      },
    ],
  });
  assert.equal(recipe.visibility, "private");
  assert.equal(recipe.kind, "recipe");
  assert.equal(recipe.recipe?.ingredients, "番茄 2 个\n鸡蛋 3 个");
  assert.equal(recipe.recipe?.difficulty, "简单");
  assert.equal(recipe.lat, 0);
  assert.ok(!("ownerId" in recipe));
  assert.ok(!("photos" in recipe));
  assert.ok(!("id" in recipe));
  assert.equal(
    parseRecipeText(
      "```json\n" + JSON.stringify({ recipes: [dish] }) + "\n```",
    )[0].name,
    dish.name,
  );
});
test("imports reject malformed or incomplete batches rather than silently dropping dishes", () => {
  for (const value of [
    null,
    [],
    [dish, { ...dish, steps: "" }],
    Array.from({ length: 21 }, () => dish),
    [{ ...dish, kind: "visit" }],
    [{ ...dish, servings: 0 }],
    [{ ...dish, ingredients: [{ name: "番茄" }] }],
  ])
    assert.throws(() => parseRecipes(value));
  assert.throws(() => parseRecipeText("今晚吃番茄炒蛋"));
});
test("AI presets use official HTTPS addresses, isolate keys and construct all three protocols", () => {
  for (const preset of AI_PROVIDERS.filter((p) => p.id !== "custom")) {
    const config = parseAIConfig({ ...preset, provider: preset.id }),
      req = aiRequest(config, "synthetic-key-for-tests", "test recipe");
    assert.equal(new URL(req.url).hostname, new URL(preset.baseUrl).hostname);
    assert.ok(!req.url.includes("synthetic-key"));
    if (preset.protocol === "openai") {
      assert.ok(req.url.endsWith("/chat/completions"));
      assert.equal(req.headers.Authorization, "Bearer synthetic-key-for-tests");
    }
    if (preset.protocol === "anthropic") {
      assert.ok(req.url.endsWith("/messages"));
      assert.equal(req.headers["x-api-key"], "synthetic-key-for-tests");
    }
    if (preset.protocol === "gemini") {
      assert.ok(req.url.endsWith(":generateContent"));
      assert.equal(req.headers["x-goog-api-key"], "synthetic-key-for-tests");
    }
  }
  assert.equal(
    parseAIConfig({
      ...AI_PROVIDERS[0],
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com/v1/",
    }).baseUrl,
    "https://api.deepseek.com/v1",
  );
});
test("AI settings reject endpoint substitution, private URLs, query credentials and unapproved custom hosts", () => {
  const base = { ...AI_PROVIDERS[0], provider: "deepseek" };
  for (const patch of [
    { baseUrl: "http://api.deepseek.com" },
    { baseUrl: "https://api.deepseek.com.attacker.test" },
    { baseUrl: "https://api.deepseek.com/?key=secret" },
    { baseUrl: "https://user:password@api.deepseek.com" },
    { model: "model\nheader" },
  ])
    assert.throws(() => parseAIConfig({ ...base, ...patch }));
  for (const url of [
    "https://localhost/v1",
    "https://127.0.0.1/v1",
    "https://169.254.169.254/v1",
    "https://[::1]/v1",
    "https://unapproved.test/v1",
  ])
    assert.throws(() =>
      parseAIConfig({ provider: "custom", baseUrl: url, model: "model" }),
    );
  assert.equal(
    parseAIConfig(
      {
        provider: "custom",
        baseUrl: "https://gateway.example.com/v1",
        model: "model",
      },
      "gateway.example.com",
    ).baseUrl,
    "https://gateway.example.com/v1",
  );
});
test("AI response adapters return validated recipes and reject truncation or missing content", () => {
  const text = JSON.stringify({ recipes: [dish] });
  const config = (i: number) => ({
    ...AI_PROVIDERS[i],
    provider: AI_PROVIDERS[i].id,
  });
  const deepseek = config(0);
  assert.equal(
    parseRecipeText(
      aiText(deepseek, {
        choices: [{ message: { content: text }, finish_reason: "stop" }],
      }),
    )[0].name,
    dish.name,
  );
  assert.equal(
    aiText(config(5), {
      content: [
        { type: "thinking", text: "ignore" },
        { type: "text", text },
      ],
    }),
    text,
  );
  assert.equal(
    aiText(config(6), {
      candidates: [
        {
          content: { parts: [{ text: "hidden", thought: true }, { text }] },
          finishReason: "STOP",
        },
      ],
    }),
    text,
  );
  assert.throws(() =>
    aiText(deepseek, {
      choices: [{ message: { content: text }, finish_reason: "length" }],
    }),
  );
  assert.throws(() => aiText(config(5), { stop_reason: "max_tokens" }));
  assert.throws(() =>
    aiText(config(6), { candidates: [{ finishReason: "MAX_TOKENS" }] }),
  );
  assert.throws(() =>
    aiText(deepseek, { choices: [{ message: { content: null } }] }),
  );
  assert.throws(() => aiText(config(5), { content: "invalid" }));
  assert.throws(() =>
    aiText(config(6), { candidates: [{ content: { parts: [null] } }] }),
  );
});
test("orders validate guest identity, unique dishes, bounded quantities and stable retry IDs", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const input = {
    requestId: id,
    guestName: " 小林 ",
    items: [{ entryId: id, quantity: 2 }],
  };
  assert.equal(parseOrder(input).guestName, "小林");
  for (const patch of [
    { guestName: " " },
    { items: [] },
    { items: [{ entryId: id, quantity: 0 }] },
    { items: [{ entryId: id, quantity: 21 }] },
    { items: [...input.items, ...input.items] },
    { requestId: "bad" },
    { note: "x".repeat(1001) },
  ])
    assert.throws(() => parseOrder({ ...input, ...patch }));
});
