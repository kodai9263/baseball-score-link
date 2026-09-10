"use client";

import { useEffect, useRef, useState } from "react";
import { GAME_STORAGE_KEY } from "@/lib/game-storage";
import { BOOK_KEY, BOOK_LOCK, createBook, decodeBook, saveBook, type Scorebook } from "@/lib/scorebook";
import type { GameState } from "@/lib/types";

export function useSavedGame() {
  const [book, setBook] = useState(() => createBook(null));
  const match = book.matches.find(item => item.id === book.activeId)!;
  const game = match.game;
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const raw = useRef<string | null>(null);
  const busy = useRef(false);
  const legacyRaw = useRef<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(BOOK_KEY);
      legacyRaw.current = window.localStorage.getItem(GAME_STORAGE_KEY);
      const restored = stored === null ? createBook(legacyRaw.current) : decodeBook(stored);
      raw.current = stored;
      setBook(restored);
      setSaved(stored !== null || legacyRaw.current !== null);
      if (!navigator.locks) throw new Error("このブラウザでは安全に保存できません。対応ブラウザで開いてください。");
      setReady(true);
    } catch (cause) {
      setError(cause instanceof Error && cause.message.startsWith("保存済み") ? cause.message : "保存機能を利用できません。ブラウザの設定を確認して再読み込みしてください。");
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key !== BOOK_KEY && event.key !== GAME_STORAGE_KEY && event.key !== null) return;
      setReady(false);
      setError("別の画面で記録が更新されました。再読み込みしてから続けてください。");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const commitBook = async (next: Scorebook) => {
    if (!ready || busy.current) return false;
    busy.current = true;
    setPending(true);
    try {
      await navigator.locks.request(BOOK_LOCK, () => {
        raw.current = saveBook(window.localStorage, raw.current, legacyRaw.current, next);
      });
      setBook(next);
      setSaved(true);
      setError("");
      return true;
    } catch (cause) {
      const conflict = cause instanceof Error && cause.message.startsWith("別の画面");
      setError(conflict ? cause.message : "保存できませんでした。今回の操作は反映していません。入力内容を残しているので、空き容量・保存設定を確認して再度お試しください。");
      if (conflict) setReady(false);
      return false;
    } finally {
      busy.current = false;
      setPending(false);
    }
  };

  const commit = (next: GameState) => commitBook({ ...book, matches: book.matches.map(item => item.id === match.id ? { ...item, game: next } : item) });
  return { book, match, game, commit, commitBook, ready, pending, error, saved };
}
