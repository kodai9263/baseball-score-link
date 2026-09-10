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
import { RunnerMovementEditor } from "@/components/score/RunnerMovementEditor";
import { isRunnerResult, resolveMovements, suggestedMovements } from "@/lib/play-resolution";
import { PlayDetailPicker } from "@/components/score/PlayDetailPicker";
import { buildPlayNotation, describePlay, normalizePlayDetails } from "@/lib/play-details";
import { Scoreboard } from "@/components/score/Scoreboard";
import { applyPlayEvent, buildScoreByInning, undoLastPlay } from "@/lib/game-engine";
import { buildInningLabels, getCurrentLineupSlot, initialGameState } from "@/lib/score-data";
import { hasSupabaseConfig } from "@/lib/supabase";
import { MatchContext } from "@/components/score/MatchContext";
import { MemberPanel } from "@/components/members/MemberPanel";
import { MatchManager } from "@/components/members/MatchManager";
import { useSavedGame } from "@/hooks/useSavedGame";
import type { PlateAppearanceResult, PlayDetails, PlayEvent, RunnerMovement, ThirdOutKind } from "@/lib/types";

export default function Home() {
  const { book, match, game, commit, commitBook, ready, pending, error: storageError, saved } = useSavedGame();
  const [view, setView] = useState<"score" | "members">("score");
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const teams = match.teams;
  const getPlayer = (id: string) => match.players.find(player => player.id === id)!;
  const openMember = (id: string) => { setSelectedMember(id); setView("members"); window.scrollTo({ top: 0 }); };
  const openMatch = async (id: string) => {
    if (await commitBook({ ...book, activeId: id })) { clearDraft(); setView("score"); window.scrollTo({ top: 0 }); }
  };
  const [selectedResult, setSelectedResult] = useState<PlateAppearanceResult>("single");
  const [playDetails, setPlayDetails] = useState<PlayDetails>({});
  const [editedMovements, setEditedMovements] = useState<RunnerMovement[] | null>(null);
  const [thirdOutKind, setThirdOutKind] = useState<ThirdOutKind | "">("");
  const [rbiOverride, setRbiOverride] = useState("");
  const currentLineup = getCurrentLineupSlot(game, match.lineups);
  const currentBatter = getPlayer(currentLineup.playerId);

  const movements = editedMovements ?? suggestedMovements(game, currentBatter.id, selectedResult);
  const resolution = resolveMovements(game, currentBatter.id, selectedResult, movements, thirdOutKind, playDetails, rbiOverride === "" ? undefined : Number(rbiOverride));
  const clearDraft = () => { setPlayDetails({}); setEditedMovements(null); setThirdOutKind(""); setRbiOverride(""); };

  // 延長したら表示する回を伸ばす。伸ばさないと7回以降の得点が「計」にだけ乗ってしまう
  const innings = useMemo(() => buildInningLabels(game.inning), [game.inning]);
  const scoreByInning = useMemo(() => buildScoreByInning(game.events, innings), [game.events, innings]);

  const recordPlay = async () => {
    if (!ready || pending || resolution.error !== null) return;
    const event: PlayEvent = {
      id: crypto.randomUUID(),
      inning: game.inning,
      half: game.half,
      batterId: currentBatter.id,
      result: selectedResult,
      notation: buildPlayNotation(selectedResult, playDetails),
      ...normalizePlayDetails(selectedResult, playDetails),
      ...resolution.transition,
      kind: isRunnerResult(selectedResult) ? "runner" : "plate",
      movements: resolution.movements,
      thirdOutKind: resolution.thirdOutKind,
      scoringStatus: "provisional"
    };
    if (await commit(applyPlayEvent(game, event))) clearDraft();
  };

  const undoPlay = async () => {
    if (!ready || pending || !game.events.length) return;
    if (await commit(undoLastPlay(game, initialGameState))) clearDraft();
  };

  return (
    <MatchContext.Provider value={{ getPlayer, teams, lineups: match.lineups, openMember }}>
    <div className="min-h-dvh">
      <GameHeader status={game.status} hasSupabaseConfig={hasSupabaseConfig} />

      <nav aria-label="メインメニュー" className="mx-auto flex max-w-[1280px] gap-2 px-4 pt-3 sm:px-6 lg:px-8">
        {([ ["score", "スコア入力"], ["members", "メンバー・成績"] ] as const).map(([id, label]) => <button key={id} type="button" disabled={!ready} aria-current={view === id ? "page" : undefined} onClick={() => setView(id)} className={`min-h-11 rounded-control px-4 text-sm font-bold ${view === id ? "bg-primary text-white" : "border border-line bg-surface text-ink"}`}>{label}</button>)}
      </nav>
      {view === "members" ? <main className="mx-auto max-w-[1000px] p-4 pb-12 sm:p-6">
        {!ready ? <p role="status">{storageError || "保存したメンバーを確認しています…"}</p> : null}
        {ready && storageError ? <p role="alert" className="mb-3 text-action">{storageError}</p> : null}
        {ready ? <MemberPanel book={book} selectedId={selectedMember} select={setSelectedMember} save={commitBook} disabled={!ready || pending} openMatch={openMatch} /> : null}
      </main> : <>
      {/* 記録・取消のたびに現在の試合状況を読み上げる */}
      <p aria-live="polite" className="sr-only">
        {game.inning}回{game.half === "top" ? "表" : "裏"}、{game.outs}アウト、{teams.away.name} {game.awayScore} 対{" "}
        {teams.home.name} {game.homeScore}、打席は{currentLineup.order}番 {currentBatter.name}。
      </p>

      <main className="mx-auto max-w-[1280px] px-4 pb-[168px] pt-4 sm:px-6 lg:grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start lg:gap-6 lg:px-8 lg:pb-10">
        <div className="lg:col-span-2"><MatchManager key={match.id} book={book} match={match} disabled={!ready || pending} select={openMatch} save={async next => { const success = await commitBook(next); if (success) clearDraft(); return success; }} />
          {storageError ? <p role="alert" className="mb-3 text-action">{storageError}</p> : null}
        </div>
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
            <p className="mb-2 text-sm font-bold text-primary-dark">
              {game.half === "top" ? teams.away.name : teams.home.name}の攻撃
            </p>
            <BatterCard order={currentLineup.order} player={currentBatter} />
            <p role="status" className="mt-2 text-xs text-muted">
              {pending ? "保存中…" : !ready ? storageError ? "記録を一時停止しています" : "保存済みの記録を確認しています" : saved ? "このブラウザに保存済み" : "記録すると、このブラウザに自動保存します"}
            </p>
            {storageError ? <p role="alert" className="mt-2 text-sm text-action">{storageError}</p> : null}
            <fieldset disabled={!ready || pending}>

            <fieldset className="mt-3">
              <legend className="mb-1.5 text-sm font-bold text-ink">打席結果</legend>
              <ResultPicker value={selectedResult} onChange={(result) => { setSelectedResult(result); clearDraft(); }} />
            </fieldset>

            <PlayDetailPicker result={selectedResult} value={playDetails} onChange={setPlayDetails} />
            <RunnerMovementEditor movements={movements} onChange={setEditedMovements}
              thirdOutKind={thirdOutKind} onThirdOutChange={setThirdOutKind} outs={game.outs}
              hitError={selectedResult === "hit_error"} />
            {!isRunnerResult(selectedResult) ? <label className="mt-2 block text-sm">打点（空欄は自動、失策を伴う安打は0）
              <input type="number" min="0" max="4" aria-label="打点の指定" value={rbiOverride} onChange={event => setRbiOverride(event.target.value)}
                className="ml-2 min-h-11 w-16 rounded border border-line bg-surface px-2" />
            </label> : null}
            {resolution.error === null ? <p className="mt-2 text-sm">このプレー：{resolution.transition.runsScored.length}得点・{resolution.transition.outsAdded}アウト・{resolution.transition.rbi}打点</p> : null}
            {resolution.error ? <p role="alert" className="mt-2 text-sm text-action">{resolution.error}</p> : null}
            {isRunnerResult(selectedResult) ? <p className="mt-2 text-xs text-muted">走塁・投手プレーです。現在の打者の打順は進みません。</p> : null}

            </fieldset>

            {/*
              主操作はモバイルでは画面下に固定し、スクロール中でも押せるようにする。
              main 側に同じ高さの下余白を確保しているので、下のセクションを隠さない。
              lg 以上ではカード内に戻す。
            */}
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] shadow-raised sm:px-6 lg:static lg:mt-3 lg:border-0 lg:px-0 lg:pb-0 lg:pt-0 lg:shadow-none">
              <div className="mx-auto max-w-[1280px] lg:max-w-none">
                <RecordBar
                  batterName={isRunnerResult(selectedResult) ? "走者" : currentBatter.name}
                  canRecord={ready && !resolution.error}
                  pending={pending}
                  resultLabel={describePlay(selectedResult, playDetails)}
                  canUndo={ready && !pending && game.events.length > 0}
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
              rows={buildLineScoreRows(scoreByInning, game.awayScore, game.homeScore, teams)}
            />
          </Panel>

          <Panel title="直近プレー" icon={<ClipboardList size={18} aria-hidden="true" />}>
            <RecentPlays events={game.events} />
          </Panel>

        </div>

        {/* 紙スコアは横幅が要るので、lg以上では下段の全幅に置いてマスを大きく見せる */}
        <div className="mt-4 lg:col-span-2 lg:mt-2">
          <Panel
            title="紙スコア風プレビュー"
            icon={<FileText size={18} aria-hidden="true" />}
            description="入力済みの記録から作る出力プレビューです。ここでは編集できません。"
          >
            <PaperScorePreview events={game.events} innings={innings} currentInning={game.inning} currentHalf={game.half} />
          </Panel>
        </div>
      </main>
      </>}
    </div>
    </MatchContext.Provider>
  );
}
