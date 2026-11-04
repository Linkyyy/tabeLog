import { test } from "node:test";
import assert from "node:assert/strict";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";
import { EventEmitter } from "node:events";
import { postAI } from "../lib/ai-http";
test("AI transport parses upstream JSON, sends the selected credential and preserves the configured proxy", async (t) => {
  let payload = "";
  t.mock.method(
    https,
    "request",
    (
      url: string,
      options: https.RequestOptions,
      callback: (res: EventEmitter) => void,
    ) => {
      assert.equal(url, "https://api.deepseek.com/chat/completions");
      assert.equal(options.method, "POST");
      assert.equal(
        (options.headers as Record<string, string>).Authorization,
        "Bearer synthetic-test-key",
      );
      if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY)
        assert.ok(options.agent);
      const req = new EventEmitter() as EventEmitter & {
        end: (data: string) => void;
      };
      req.end = (data) => {
        payload = data;
        const res = Object.assign(new EventEmitter(), { statusCode: 200 });
        callback(res);
        queueMicrotask(() => {
          res.emit(
            "data",
            Buffer.from('{"choices":[{"message":{"content":"ok"}}]}'),
          );
          res.emit("end");
        });
      };
      return req;
    },
  );
  syncBuiltinESMExports();
  try {
    assert.deepEqual(
      await postAI(
        "https://api.deepseek.com/chat/completions",
        { Authorization: "Bearer synthetic-test-key" },
        { model: "deepseek-chat" },
      ),
      { choices: [{ message: { content: "ok" } }] },
    );
    assert.equal(JSON.parse(payload).model, "deepseek-chat");
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
});
test("AI transport refuses redirects and hides upstream error bodies and credentials", async (t) => {
  t.mock.method(
    https,
    "request",
    (
      _url: string,
      _options: https.RequestOptions,
      callback: (res: EventEmitter) => void,
    ) => {
      const req = new EventEmitter() as EventEmitter & { end: () => void };
      req.end = () =>
        callback(
          Object.assign(new EventEmitter(), { statusCode: 302, resume() {} }),
        );
      return req;
    },
  );
  syncBuiltinESMExports();
  try {
    await assert.rejects(
      postAI(
        "https://api.deepseek.com/chat/completions",
        { Authorization: "Bearer synthetic-test-key" },
        {},
      ),
      (e) =>
        e instanceof Error &&
        e.message.includes("302") &&
        !e.message.includes("synthetic-test-key"),
    );
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
});
