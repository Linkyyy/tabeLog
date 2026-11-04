import { test } from "node:test";
import assert from "node:assert/strict";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";
import { EventEmitter } from "node:events";
import { gzipSync } from "node:zlib";
import { requestArticle } from "../lib/article-fetch";
test("article transport uses bounded verified HTTPS, no ambient credentials, and bounded decompression", async (t) => {
  let response = {
    statusCode: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-encoding": "gzip",
    },
    body: gzipSync(Buffer.from("<article>食材与做法</article>")),
  };
  t.mock.method(
    https,
    "request",
    (
      _url: URL,
      options: https.RequestOptions,
      callback: (res: EventEmitter) => void,
    ) => {
      assert.notEqual(options.rejectUnauthorized, false);
      assert.equal(options.method, "GET");
      const headers = options.headers as Record<string, string>;
      assert.equal(headers.Cookie, undefined);
      assert.equal(headers.Authorization, undefined);
      assert.equal(headers["Accept-Encoding"], "identity");
      if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY)
        assert.ok(options.agent);
      const req = Object.assign(new EventEmitter(), {
        end: () => {
          const res = Object.assign(new EventEmitter(), response, {
            destroy: () => {},
            resume: () => {},
          });
          callback(res);
          queueMicrotask(() => {
            res.emit("data", response.body);
            res.emit("end");
          });
        },
      });
      return req;
    },
  );
  syncBuiltinESMExports();
  try {
    const get = () =>
      requestArticle(
        new URL("https://www.xiachufang.com/recipe/1/"),
        { address: "93.184.216.34", family: 4 },
        AbortSignal.timeout(5000),
      );
    assert.match((await get()).html, /食材与做法/);
    response = {
      ...response,
      body: gzipSync(Buffer.alloc(2 * 1024 * 1024 + 1, 65)),
    };
    await assert.rejects(get(), /复制菜谱正文/);
    response = {
      ...response,
      headers: {
        ...response.headers,
        "content-type": "application/octet-stream",
      },
      body: Buffer.from("not HTML"),
    };
    await assert.rejects(get(), /复制菜谱正文/);
    response = { ...response, statusCode: 403 };
    await assert.rejects(get(), /复制菜谱正文/);
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
});
