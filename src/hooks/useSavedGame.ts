"use client";

import { useEffect, useRef, useState } from "react";
import { decodeGame, GAME_STORAGE_KEY, GAME_STORAGE_LOCK, saveGame } from "@/lib/game-storage";
import { initialGameState } from "@/lib/score-data";
import type { GameState } from "@/lib/types";

export function useSavedGame() {
  const [game, setGame] = useState(initialGameState);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const raw = useRef<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(GAME_STORAGE_KEY);
      const restored = decodeGame(stored);
      raw.current = stored;
      setGame(restored);
      setSaved(stored !== null);
      if (!navigator.locks) throw new Error("このブラウザでは安全に保存できません。対応ブラウザで開いてください。");
      setReady(true);
    } catch (cause) {
      setError(cause instanceof Error && cause.message.startsWith("保存済み") ? cause.message : "保存機能を利用できません。ブラウザの設定を確認して再読み込みしてください。");
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key !== GAME_STORAGE_KEY && event.key !== null) return;
      setReady(false);
      setError("別の画面で記録が更新されました。再読み込みしてから続けてください。");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const commit = async (next: GameState) => {
    if (!ready || busy.current) return false;
    busy.current = true;
    setPending(true);
    try {
      await navigator.locks.request(GAME_STORAGE_LOCK, () => {
        raw.current = saveGame(window.localStorage, raw.current, next);
      });
      setGame(next);
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

  return { game, commit, ready, pending, error, saved };
}
