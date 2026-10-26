"use client";
import { useState } from "react";
import { ArrowRight, LoaderCircle, LockKeyhole } from "lucide-react";
import type { User } from "@/lib/types";
export default function AuthForm({
  onSuccess,
  registrationOpen = true,
}: {
  onSuccess: (user: User) => void;
  registrationOpen?: boolean;
}) {
  const [register, setRegister] = useState(false),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: register ? "register" : "login",
          name,
          email,
          password,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setPassword("");
      onSuccess(data.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "暂时无法登录，请稍后重试");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="auth-form" onSubmit={submit}>
      <span className="login-icon">
        <LockKeyhole size={25} />
      </span>
      <span className="eyebrow">YOUR OWN TASTE OF LIFE</span>
      <h2>{register ? "从今天，开始好好记录。" : "欢迎回到你的美味日常。"}</h2>
      <p>探店的小惊喜，和自己下厨的烟火气，都放在这里。</p>
      {register && (
        <label>
          昵称
          <input
            name="name"
            autoComplete="nickname"
            required
            minLength={2}
            maxLength={30}
            placeholder="大家怎么称呼你？"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      )}
      <label>
        邮箱
        <input
          name="email"
          autoComplete="email"
          type="email"
          required
          maxLength={254}
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label>
        密码
        <input
          name="password"
          autoComplete={register ? "new-password" : "current-password"}
          type="password"
          required
          minLength={12}
          maxLength={128}
          placeholder="至少 12 个字符"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary" disabled={busy}>
        {busy ? (
          <LoaderCircle className="spin" size={17} />
        ) : (
          <>
            {register ? "注册并开始记录" : "登录"}
            <ArrowRight size={16} />
          </>
        )}
      </button>
      {registrationOpen && (
        <button
          type="button"
          className="text-button auth-switch"
          disabled={busy}
          onClick={() => {
            setRegister(!register);
            setError("");
          }}
        >
          {register ? "已有账户？去登录" : "还没有账户？注册"}
        </button>
      )}
      <small>
        <LockKeyhole size={12} />
        新记录默认私人，公开分享由你决定。
      </small>
    </form>
  );
}
