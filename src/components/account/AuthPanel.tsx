"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export function AuthPanel() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy || !supabase) return;

        setBusy(true);
        setError("");
        try {
          const { error: signInError } = await supabase.auth.signInWithOtp({
            email: email.trim(),
            options: {
              shouldCreateUser: true,
              emailRedirectTo: window.location.href,
            },
          });
          if (signInError) throw signInError;
          setSent(true);
        } catch {
          setError(
            "ログインメールを送れませんでした。アドレスを確認し、少し待ってからお試しください。",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h1 className="text-2xl font-bold">チームのスコアを共有</h1>
      <p className="text-sm text-muted">
        メールに届くリンクから登録・ログインできます。パスワードは不要です。
      </p>
      <label className="block">
        メールアドレス
        <input
          type="email"
          required
          autoComplete="email"
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 min-h-11 w-full rounded-control border border-line px-3"
        />
      </label>
      <button
        disabled={busy}
        className="min-h-11 rounded-control bg-primary px-4 font-bold text-white disabled:opacity-50"
      >
        {busy ? "送信中…" : sent ? "ログインメールを再送" : "ログインメールを送る"}
      </button>
      {sent ? (
        <p role="status" className="text-sm">
          メールを送りました。届いたメールの「Log In」を押すと、この画面へ戻ってログインします。
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-action">
          {error}
        </p>
      ) : null}
    </form>
  );
}
