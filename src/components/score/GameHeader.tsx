import { CircleDot, Cloud, CloudOff } from "lucide-react";
import { useMatch } from "./MatchContext";
import type { GameStatus } from "@/lib/types";

type GameHeaderProps = {
  status: GameStatus;
  hasSupabaseConfig: boolean;
};

/**
 * 薄型の試合ヘッダー。
 * モバイルのファーストビューを入力に使いたいので、高さを詰めて対戦カードと記録状態だけを載せる。
 */
export function GameHeader({ status, hasSupabaseConfig }: GameHeaderProps) {
  const { teams } = useMatch();
  const isConfirmed = status === "confirmed";

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="min-w-0">
          {/* 375px では短縮名にして対戦カードが省略されないようにする */}
          <h1 className="truncate text-[15px] font-bold text-ink sm:text-lg">
            <span className="sm:hidden">{teams.away.short}</span>
            <span className="hidden sm:inline">{teams.away.name}</span>
            <span className="mx-1.5 font-normal text-muted">vs</span>
            <span className="sm:hidden">{teams.home.short}</span>
            <span className="hidden sm:inline">{teams.home.name}</span>
          </h1>
          {/* 画面名と開発状態。スコアや記録状態より目立たせない */}
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <span>スコア入力</span>
            <span aria-hidden="true">/</span>
            <span className="inline-flex items-center gap-1">
              {hasSupabaseConfig ? (
                <Cloud size={12} aria-hidden="true" />
              ) : (
                <CloudOff size={12} aria-hidden="true" />
              )}
              {hasSupabaseConfig ? "Supabase接続あり" : "ローカル試作"}
            </span>
          </p>
        </div>

        {/* 記録の状態。色だけに頼らず「記録:」という語で何の状態かを示す */}
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-control px-2.5 py-1.5 text-xs font-bold ${
            isConfirmed ? "bg-primary-soft text-primary-dark" : "border border-line bg-sunken text-muted"
          }`}
        >
          <CircleDot size={13} aria-hidden="true" />
          記録: {isConfirmed ? "確定" : "暫定"}
        </span>
      </div>
    </header>
  );
}
