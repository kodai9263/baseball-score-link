"use client";

import { useMemo, useState } from "react";
import { Check, ClipboardList, FileText, RotateCcw, Save, Share2 } from "lucide-react";
import { getPlayer, initialGameState, lineup, resultLabels } from "@/lib/score-data";
import { hasSupabaseConfig } from "@/lib/supabase";
import type { GameState, PlateAppearanceResult, PlayEvent, RunnerState } from "@/lib/types";

const resultOptions = Object.entries(resultLabels) as Array<
  [PlateAppearanceResult, (typeof resultLabels)[PlateAppearanceResult]]
>;

const inningLabels = ["1", "2", "3", "4", "5", "6"];

function advanceRunners(
  state: GameState,
  batterId: string,
  result: PlateAppearanceResult
): Pick<PlayEvent, "basesAfter" | "runsScored" | "rbi" | "outsAdded"> {
  const bases = state.bases;
  const runsScored: string[] = [];
  let nextBases: RunnerState = { first: null, second: null, third: null };
  let outsAdded = 0;

  if (result === "strikeout" || result === "groundout" || result === "flyout" || result === "sacrifice") {
    outsAdded = 1;
    nextBases = bases;
  }

  if (result === "single" || result === "walk" || result === "hit_by_pitch" || result === "error") {
    if (bases.third) runsScored.push(bases.third);
    nextBases = { first: batterId, second: bases.first, third: bases.second };
  }

  if (result === "double") {
    if (bases.third) runsScored.push(bases.third);
    if (bases.second) runsScored.push(bases.second);
    nextBases = { first: null, second: batterId, third: bases.first };
  }

  if (result === "triple") {
    if (bases.third) runsScored.push(bases.third);
    if (bases.second) runsScored.push(bases.second);
    if (bases.first) runsScored.push(bases.first);
    nextBases = { first: null, second: null, third: batterId };
  }

  if (result === "home_run") {
    if (bases.third) runsScored.push(bases.third);
    if (bases.second) runsScored.push(bases.second);
    if (bases.first) runsScored.push(bases.first);
    runsScored.push(batterId);
    nextBases = { first: null, second: null, third: null };
  }

  return {
    basesAfter: nextBases,
    runsScored,
    rbi: runsScored.length,
    outsAdded
  };
}

function nextHalfInning(state: GameState, outsAfterPlay: number): Pick<GameState, "inning" | "half" | "outs" | "bases"> {
  if (outsAfterPlay < 3) {
    return { inning: state.inning, half: state.half, outs: outsAfterPlay, bases: state.bases };
  }

  return {
    inning: state.half === "top" ? state.inning : state.inning + 1,
    half: state.half === "top" ? "bottom" : "top",
    outs: 0,
    bases: { first: null, second: null, third: null }
  };
}

export default function Home() {
  const [game, setGame] = useState<GameState>(initialGameState);
  const [selectedResult, setSelectedResult] = useState<PlateAppearanceResult>("single");
  const currentLineup = lineup[game.battingOrderIndex % lineup.length];
  const currentBatter = getPlayer(currentLineup.playerId);

  const scoreByInning = useMemo(() => {
    return inningLabels.map((inningLabel) => {
      const inning = Number(inningLabel);
      const topRuns = game.events
        .filter((event) => event.inning === inning && event.half === "top")
        .reduce((total, event) => total + event.runsScored.length, 0);
      const bottomRuns = game.events
        .filter((event) => event.inning === inning && event.half === "bottom")
        .reduce((total, event) => total + event.runsScored.length, 0);

      return { inning: inningLabel, topRuns, bottomRuns };
    });
  }, [game.events]);

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
    <main className="min-h-dvh">
      <header className="border-b border-line bg-white/92">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-sm font-semibold text-field-700">少年野球スコア管理</p>
            <h1 className="mt-1 text-2xl font-bold text-ink sm:text-3xl">スコア連携アプリ MVP</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge active={hasSupabaseConfig} label={hasSupabaseConfig ? "Supabase接続あり" : "ローカル試作"} />
            <StatusBadge active={game.status === "confirmed"} label={game.status === "confirmed" ? "確定" : "暫定"} />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[380px_1fr] lg:px-8">
        <section className="space-y-5">
          <Panel title="試合状況" icon={<ClipboardList aria-hidden="true" size={20} />}>
            <div className="grid grid-cols-3 gap-3">
              <Metric label="回" value={`${game.inning}回${game.half === "top" ? "表" : "裏"}`} />
              <Metric label="アウト" value={`${game.outs}`} />
              <Metric label="打者" value={`${currentLineup.order}番`} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <ScoreBox label="ビジター" score={game.awayScore} />
              <ScoreBox label="ホーム" score={game.homeScore} />
            </div>
            <Bases bases={game.bases} />
          </Panel>

          <Panel title="打席入力" icon={<Save aria-hidden="true" size={20} />}>
            <div className="rounded-md border border-line bg-slate-50 p-3">
              <p className="text-sm text-slate-600">現在の打者</p>
              <p className="mt-1 text-xl font-bold text-ink">
                {currentBatter.name}
                <span className="ml-2 text-sm font-semibold text-slate-500">#{currentBatter.number} {currentBatter.position}</span>
              </p>
            </div>
            <fieldset className="mt-4">
              <legend className="mb-2 text-sm font-semibold text-slate-700">打席結果</legend>
              <div className="grid grid-cols-2 gap-2">
                {resultOptions.map(([value, option]) => (
                  <button
                    key={value}
                    className={`min-h-11 rounded-md border px-3 py-2 text-left text-sm font-semibold transition ${
                      selectedResult === value
                        ? "border-blue-700 bg-blue-700 text-white"
                        : "border-line bg-white text-slate-700 hover:border-blue-500 hover:bg-blue-50"
                    }`}
                    type="button"
                    onClick={() => setSelectedResult(value)}
                  >
                    {option.label}
                    <span className="ml-2 font-mono text-xs opacity-80">{option.notation}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="mt-4 flex gap-2">
              <button
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 font-bold text-white transition hover:bg-orange-700 active:scale-[0.99]"
                type="button"
                onClick={recordPlay}
              >
                <Check aria-hidden="true" size={18} />
                確定
              </button>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 py-2 font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                onClick={undoPlay}
                disabled={game.events.length === 0}
                aria-label="直前プレーを取り消す"
              >
                <RotateCcw aria-hidden="true" size={18} />
                取消
              </button>
            </div>
          </Panel>
        </section>

        <section className="space-y-5">
          <Panel title="ライブ共有" icon={<Share2 aria-hidden="true" size={20} />}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-slate-600">
                    <th className="px-3 py-2">チーム</th>
                    {inningLabels.map((inning) => (
                      <th key={inning} className="px-3 py-2 text-center font-mono">{inning}</th>
                    ))}
                    <th className="px-3 py-2 text-center">計</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  <ScoreRow label="ビジター" values={scoreByInning.map((item) => item.topRuns)} total={game.awayScore} />
                  <ScoreRow label="ホーム" values={scoreByInning.map((item) => item.bottomRuns)} total={game.homeScore} />
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="紙スコア風プレビュー" icon={<FileText aria-hidden="true" size={20} />}>
            <div className="overflow-x-auto">
              <div className="grid min-w-[760px] grid-cols-[120px_repeat(6,1fr)] border border-line bg-white text-sm">
                <div className="border-b border-r border-line bg-slate-100 p-2 font-bold">打順</div>
                {inningLabels.map((inning) => (
                  <div key={inning} className="border-b border-r border-line bg-slate-100 p-2 text-center font-bold">
                    {inning}回
                  </div>
                ))}
                {lineup.map((slot) => {
                  const player = getPlayer(slot.playerId);
                  const playerEvents = game.events.filter((event) => event.batterId === player.id);

                  return (
                    <div key={player.id} className="contents">
                      <div className="border-r border-t border-line p-2">
                        <p className="font-bold">{slot.order}. {player.name}</p>
                        <p className="text-xs text-slate-500">#{player.number} {slot.position}</p>
                      </div>
                      {inningLabels.map((inning) => {
                        const event = playerEvents.find((item) => item.inning === Number(inning));

                        return (
                          <ScoreCell key={`${player.id}-${inning}`} notation={event?.notation} scored={Boolean(event?.runsScored.includes(player.id))} />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </Panel>

          <Panel title="直近プレー" icon={<ClipboardList aria-hidden="true" size={20} />}>
            <div className="space-y-2">
              {game.events.length === 0 ? (
                <p className="rounded-md border border-dashed border-line p-4 text-sm text-slate-600">まだプレーは記録されていません。</p>
              ) : (
                game.events.slice(-6).reverse().map((event) => {
                  const batter = getPlayer(event.batterId);

                  return (
                    <div key={event.id} className="flex items-center justify-between gap-3 rounded-md border border-line bg-white p-3">
                      <div>
                        <p className="font-semibold text-ink">{event.inning}回{event.half === "top" ? "表" : "裏"} {batter.name}</p>
                        <p className="text-sm text-slate-600">
                          {resultLabels[event.result].label} / 打点 {event.rbi} / 追加アウト {event.outsAdded}
                        </p>
                      </div>
                      <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-sm font-bold text-slate-700">{event.notation}</span>
                    </div>
                  );
                })
              )}
            </div>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white p-4">
      <div className="mb-4 flex items-center gap-2 text-ink">
        {icon}
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-white p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-xl font-bold text-ink">{value}</p>
    </div>
  );
}

function ScoreBox({ label, score }: { label: string; score: number }) {
  return (
    <div className="rounded-md bg-field-900 p-3 text-white">
      <p className="text-sm text-field-100">{label}</p>
      <p className="font-mono text-4xl font-bold">{score}</p>
    </div>
  );
}

function Bases({ bases }: { bases: RunnerState }) {
  const baseItems = [
    { label: "二塁", active: bases.second },
    { label: "三塁", active: bases.third },
    { label: "一塁", active: bases.first }
  ];

  return (
    <div className="mt-4 grid grid-cols-3 gap-2" aria-label="走者状況">
      {baseItems.map((base) => (
        <div
          key={base.label}
          className={`min-h-16 rounded-md border p-2 text-center ${base.active ? "border-field-700 bg-field-100" : "border-line bg-slate-50"}`}
        >
          <p className="text-xs font-semibold text-slate-500">{base.label}</p>
          <p className="mt-1 text-sm font-bold text-ink">{base.active ? getPlayer(base.active).name : "空"}</p>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`rounded-md px-3 py-2 text-sm font-bold ${active ? "bg-field-100 text-field-900" : "bg-orange-100 text-orange-900"}`}>
      {label}
    </span>
  );
}

function ScoreRow({ label, values, total }: { label: string; values: number[]; total: number }) {
  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-3 py-3 font-sans font-bold text-ink">{label}</td>
      {values.map((value, index) => (
        <td key={`${label}-${index}`} className="px-3 py-3 text-center">{value}</td>
      ))}
      <td className="bg-slate-100 px-3 py-3 text-center font-bold">{total}</td>
    </tr>
  );
}

function ScoreCell({ notation, scored }: { notation?: string; scored: boolean }) {
  return (
    <div className="relative min-h-24 border-r border-t border-line p-2">
      <div className="absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-slate-300" aria-hidden="true" />
      {notation ? (
        <div className="relative z-10 flex h-full min-h-20 flex-col items-center justify-center gap-1">
          <span className="rounded-md bg-white px-2 py-1 font-mono text-sm font-bold text-ink">{notation}</span>
          {scored ? <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">得点</span> : null}
        </div>
      ) : null}
    </div>
  );
}
