"use client";

import { useMemo, useState } from "react";
import { ClipboardList, FileText, ListChecks, Share2 } from "lucide-react";
import { BatterCard } from "@/components/score/BatterCard";
import { GameHeader } from "@/components/score/GameHeader";
import { LineScore, buildLineScoreRows } from "@/components/score/LineScore";
import { Panel } from "@/components/score/Panel";
import { PaperScorePreview } from "@/components/score/PaperScorePreview";
import { RecentPlays } from "@/components/score/RecentPlays";
import { RecordBar } from "@/components/score/RecordBar";
import { ResultPicker } from "@/components/score/ResultPicker";
import { Scoreboard } from "@/components/score/Scoreboard";
import { advanceRunners, buildScoreByInning, nextHalfInning } from "@/lib/game-engine";
import { buildInningLabels, getPlayer, initialGameState, lineup, resultLabels, teams } from "@/lib/score-data";
import { hasSupabaseConfig } from "@/lib/supabase";
import type { GameState, PlateAppearanceResult, PlayEvent } from "@/lib/types";

export default function Home() {
  const [game, setGame] = useState<GameState>(initialGameState);
  const [selectedResult, setSelectedResult] = useState<PlateAppearanceResult>("single");
  const currentLineup = lineup[game.battingOrderIndex % lineup.length];
  const currentBatter = getPlayer(currentLineup.playerId);

  // 延長したら表示する回を伸ばす。伸ばさないと7回以降の得点が「計」にだけ乗ってしまう
  const innings = useMemo(() => buildInningLabels(game.inning), [game.inning]);
  const scoreByInning = useMemo(() => buildScoreByInning(game.events, innings), [game.events, innings]);

  const recordPlay = () => {
    const transition = advanceRunners(game, currentBatter.id, selectedResult);
    const outsAfterPlay = game.outs + transition.outsAdded;
    const halfTransition = nextHalfInning({ ...game, bases: transition.basesAfter }, outsAfterPlay);
    const event: PlayEvent = {
      id: crypto.randomUUID(),
      inning: game.inning,
      half: game.half,
      batterId: currentBatter.id,
      result: selectedResult,
      notation: resultLabels[selectedResult].notation,
      rbi: transition.rbi,
      outsAdded: transition.outsAdded,
      runsScored: transition.runsScored,
      basesAfter: transition.basesAfter,
      scoringStatus: "provisional"
    };

    setGame((current) => ({
      ...current,
      inning: halfTransition.inning,
      half: halfTransition.half,
      outs: halfTransition.outs,
      bases: halfTransition.bases,
      battingOrderIndex: current.battingOrderIndex + 1,
      awayScore: current.awayScore + (current.half === "top" ? transition.runsScored.length : 0),
      homeScore: current.homeScore + (current.half === "bottom" ? transition.runsScored.length : 0),
      events: [...current.events, event],
      status: "provisional"
    }));
  };

  const undoPlay = () => {
    if (game.events.length === 0) return;

    setGame((current) => {
      const events = current.events.slice(0, -1);

      return events.reduce<GameState>((rebuilt, event) => {
        const transition = nextHalfInning({ ...rebuilt, bases: event.basesAfter }, rebuilt.outs + event.outsAdded);

        return {
          ...rebuilt,
          inning: transition.inning,
          half: transition.half,
          outs: transition.outs,
          bases: transition.bases,
          battingOrderIndex: rebuilt.battingOrderIndex + 1,
          awayScore: rebuilt.awayScore + (event.half === "top" ? event.runsScored.length : 0),
          homeScore: rebuilt.homeScore + (event.half === "bottom" ? event.runsScored.length : 0),
          events: [...rebuilt.events, event]
        };
      }, initialGameState);
    });
  };

  return (
    <div className="min-h-dvh">
      <GameHeader status={game.status} hasSupabaseConfig={hasSupabaseConfig} />

      {/* 記録・取消のたびに現在の試合状況を読み上げる */}
      <p aria-live="polite" className="sr-only">
        {game.inning}回{game.half === "top" ? "表" : "裏"}、{game.outs}アウト、{teams.away.name} {game.awayScore} 対{" "}
        {teams.home.name} {game.homeScore}、打席は{currentLineup.order}番 {currentBatter.name}。
      </p>

      <main className="mx-auto max-w-[1280px] px-4 pb-[168px] pt-4 sm:px-6 lg:grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start lg:gap-6 lg:px-8 lg:pb-10">
        {/* 試合中いちばん見る領域。モバイルではここが最初の画面に収まるようにする */}
        <div className="space-y-4">
          <Scoreboard
            inning={game.inning}
            half={game.half}
            outs={game.outs}
            homeScore={game.homeScore}
            awayScore={game.awayScore}
            bases={game.bases}
          />

          <Panel title="打席入力" icon={<ListChecks size={18} aria-hidden="true" />}>
            <BatterCard order={currentLineup.order} player={currentBatter} />

            <fieldset className="mt-3">
              <legend className="mb-1.5 text-sm font-bold text-ink">打席結果</legend>
              <ResultPicker value={selectedResult} onChange={setSelectedResult} />
            </fieldset>

            {/*
              主操作はモバイルでは画面下に固定し、スクロール中でも押せるようにする。
              main 側に同じ高さの下余白を確保しているので、下のセクションを隠さない。
              lg 以上ではカード内に戻す。
            */}
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] shadow-raised sm:px-6 lg:static lg:mt-3 lg:border-0 lg:px-0 lg:pb-0 lg:pt-0 lg:shadow-none">
              <div className="mx-auto max-w-[1280px] lg:max-w-none">
                <RecordBar
                  batterName={currentBatter.name}
                  resultLabel={resultLabels[selectedResult].label}
                  canUndo={game.events.length > 0}
                  onRecord={recordPlay}
                  onUndo={undoPlay}
                />
              </div>
            </div>
          </Panel>
        </div>

        {/* 試合中の入力を邪魔しない下位セクション */}
        <div className="mt-4 space-y-4 lg:mt-0">
          <Panel
            title="ライブ共有"
            icon={<Share2 size={18} aria-hidden="true" />}
            description="チーム関係者に見せるイニング別得点です。"
          >
            <LineScore
              currentInning={game.inning}
              innings={innings}
              rows={buildLineScoreRows(scoreByInning, game.awayScore, game.homeScore)}
            />
          </Panel>

          <Panel title="直近プレー" icon={<ClipboardList size={18} aria-hidden="true" />}>
            <RecentPlays events={game.events} />
          </Panel>

          <Panel
            title="紙スコア風プレビュー"
            icon={<FileText size={18} aria-hidden="true" />}
            description="入力済みの記録から作る出力プレビューです。ここでは編集できません。"
          >
            <PaperScorePreview events={game.events} innings={innings} />
          </Panel>
        </div>
      </main>
    </div>
  );
}
