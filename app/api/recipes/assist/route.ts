import { checkOrigin, requireAuth } from "@/lib/auth";
import { generateRecipes } from "@/lib/ai-service";
import { fetchRecipeArticle, ARTICLE_FALLBACK } from "@/lib/article-fetch";
import { parseRecipeArticle } from "@/lib/article-parser";
import { hasRecipeBody, recipeLink } from "@/lib/recipe-links";
import { AppError } from "@/lib/validation";
import { apiError } from "@/lib/http";
import { limitRequests } from "@/lib/rate-limit";
import { NO_STORE, readJSON } from "@/lib/request-utils";
import type { RecipeSuggestion } from "@/lib/recipe-suggestion";
export const runtime = "nodejs";
export const maxDuration = 90;
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireAuth();
    const value = (await readJSON(request, 85000)) as {
      mode?: unknown;
      content?: unknown;
    };
    if (
      !value ||
      !["name", "article"].includes(String(value.mode)) ||
      typeof value.content !== "string" ||
      !value.content.trim() ||
      value.content.length > 18000
    )
      throw new AppError("请填写菜名、文章链接或 18,000 字以内的菜谱正文");
    await limitRequests(`ai:${user.id}`, 15);
    if (value.mode === "name") {
      if (value.content.trim().length > 100)
        throw new AppError("菜名最多 100 字");
      const recipes = await generateRecipes(user.id, {
        mode: "generate",
        count: 1,
        prompt: `请为这道菜生成一份完整、可在家操作的菜谱。菜名：${value.content.trim()}。用户会在保存前核对和修改，不要生成其他菜品。`,
      });
      return Response.json(
        { draft: recipes[0], method: "name" } satisfies RecipeSuggestion,
        { headers: NO_STORE },
      );
    }
    const content = value.content.trim(),
      link = recipeLink(content);
    let source: RecipeSuggestion["source"],
      text = content,
      method: RecipeSuggestion["method"] = "text";
    const withoutLinks = content.replace(/https?:\/\/\S+/g, "");
    if (link && !hasRecipeBody(withoutLinks)) {
      const fetched = await fetchRecipeArticle(content);
      const article = parseRecipeArticle(fetched.html, fetched.url);
      source = article.source;
      text = article.text;
      method = "article";
      if (article.draft)
        return Response.json(
          {
            draft: { ...article.draft, source },
            source,
            method: "structured",
          } satisfies RecipeSuggestion,
          { headers: NO_STORE },
        );
      if (
        text.length < 60 ||
        (/安全验证|访问验证|验证码|扫码登录|登录后查看|captcha|access denied/i.test(
          source.title,
        ) &&
          !hasRecipeBody(text))
      )
        throw new AppError(ARTICLE_FALLBACK, 422);
    } else if (link) {
      source = {
        url: link.url.href,
        platform: link.platform.name,
        title: content.split(/\r?\n/)[0].slice(0, 200),
      };
      text = withoutLinks.trim();
    } else if (/https?:\/\//i.test(content) && !hasRecipeBody(withoutLinks))
      throw new AppError("暂不支持读取这个链接，请复制文章中的菜谱正文后导入");
    const recipes = await generateRecipes(user.id, {
      mode: "import",
      count: 1,
      prompt: `仅整理下面这篇文章或用户复制的菜谱正文，保留用量与关键做法。不要根据链接或标题猜测未提供的内容。${source ? `\n文章标题：${source.title}` : ""}\n原文：\n${text}`,
    });
    return Response.json(
      {
        draft: { ...recipes[0], ...(source ? { source } : {}) },
        ...(source ? { source } : {}),
        method,
      } satisfies RecipeSuggestion,
      { headers: NO_STORE },
    );
  } catch (e) {
    return apiError(e);
  }
}
