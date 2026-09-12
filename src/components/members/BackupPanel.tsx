"use client";
import { useRef, useState } from "react";
import { decodeBook, encodeBook, localDate, type Scorebook } from "@/lib/scorebook";

export function BackupPanel({ book, disabled, restore, readOnly = false }: { book: Scorebook; disabled: boolean; readOnly?: boolean; restore: (book: Scorebook) => Promise<boolean> }) {
  const [preview, setPreview] = useState<Scorebook | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [backedUp, setBackedUp] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const readVersion = useRef(0);
  const current = encodeBook(book);
  const download = () => {
    const url = URL.createObjectURL(new Blob([current], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `scorebook-${localDate()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setBackedUp(current);
    setMessage("バックアップを書き出しました。ダウンロード先のファイルを確認してください。");
  };
  return <details className="rounded-card border border-line bg-surface p-4">
    <summary className="cursor-pointer text-sm font-bold">データのバックアップ・復元</summary>
    <p className="my-3 text-sm text-muted">すべてのメンバー・試合をファイルに保存できます。別の端末や公開先へ移すときにも使えます。ファイルにはメンバー名が含まれます。</p>
    <button type="button" disabled={disabled} onClick={download} className="min-h-11 rounded-control border border-primary px-4 text-sm font-bold text-primary disabled:opacity-50">バックアップを書き出す</button>
    <label className="mt-4 block text-sm font-bold">バックアップから復元する
      <input ref={fileRef} type="file" accept=".json,application/json" disabled={disabled || readOnly} className="mt-2 block w-full min-w-0 text-sm" onChange={async event => {
        const file = event.target.files?.[0];
        const version = ++readVersion.current;
        setPreview(null); setError(""); setMessage("");
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) { setError("10MB以下のバックアップを選んでください。"); return; }
        try {
          const parsed = decodeBook(await file.text());
          if (version === readVersion.current) setPreview(parsed);
        } catch { if (version === readVersion.current) setError("このファイルは復元できません。スコアアプリから書き出したバックアップを選んでください。現在の記録は変更していません。"); }
      }} />
    </label>
    {preview ? <div className="mt-3 space-y-3 rounded-control bg-sunken p-3 text-sm">
      <p>復元する内容：メンバー{preview.members.length}人・{preview.matches.length}試合・{preview.matches.reduce((sum, match) => sum + match.game.events.length, 0)}プレー</p>
      <p>現在のメンバー{book.members.length}人・{book.matches.length}試合を、この内容に置き換えます。先に現在のバックアップを書き出して保管してください。</p>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={disabled || readOnly || backedUp !== current} className="min-h-11 rounded-control bg-primary px-4 font-bold text-white disabled:opacity-50" onClick={async () => {
        if (readOnly || backedUp !== current) return;
        if (await restore(preview)) { setPreview(null); setMessage("バックアップから復元しました。"); if (fileRef.current) fileRef.current.value = ""; }
      }}>この内容に復元する</button><button type="button" className="min-h-11 px-3 underline" onClick={() => { ++readVersion.current; setPreview(null); if (fileRef.current) fileRef.current.value = ""; }}>キャンセル</button></div>
    </div> : null}
    {message ? <p role="status" className="mt-3 text-sm text-primary">{message}</p> : null}
    {error ? <p role="alert" className="mt-3 text-sm text-action">{error}</p> : null}
  </details>;
}
