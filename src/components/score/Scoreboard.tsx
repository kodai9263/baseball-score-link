import { useMatch } from "./MatchContext";
import type { GameState } from "@/lib/types";
import { BaseDiamond } from "./BaseDiamond";

type ScoreboardProps = Pick<GameState, "inning" | "half" | "outs" | "homeScore" | "awayScore" | "bases">;

function TeamScore({
  name,
  score,
  attacking,
  divided
}: {
  name: string;
  score: number;
  attacking: boolean;
  divided: boolean;
}) {
  return (
    <div className={`px-4 py-3 ${attacking ? "bg-primary-soft" : "bg-surface"} ${divided ? "border-r border-line" : ""}`}>
      <div className="flex items-center gap-1.5">
        <p className="min-w-0 truncate text-sm font-semibold text-ink">{name}</p>
        {/* 攻撃中は色だけでなく語でも示す */}
        {attacking ? (
          <span className="shrink-0 rounded bg-primary px-1.5 py-0.5 text-[11px] font-bold leading-tight text-white">
            攻撃中
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 text-5xl font-bold tabular-nums leading-none text-ink">{score}</p>
    </div>
  );
}

/**
 * 常時把握したいスコアボード。
 * 「何回の表裏か・何対何か・何アウトか・走者は誰か」を1つの視野に収める。
 */
export function Scoreboard({ inning, half, outs, homeScore, awayScore, bases }: ScoreboardProps) {
  const { teams } = useMatch();
  const attackingTeam = half === "top" ? teams.away : teams.home;

  return (
    <section
      aria-labelledby="scoreboard-heading"
      className="overflow-hidden rounded-card border border-line bg-surface shadow-card"
    >
      <h2 id="scoreboard-heading" className="sr-only">
        試合状況
      </h2>

      <div className="flex items-center justify-between gap-3 bg-primary-dark px-4 py-2 text-white">
        <p className="text-lg font-bold tabular-nums">
          {inning}
          <span className="text-sm font-semibold">回</span>
          {half === "top" ? "表" : "裏"}
        </p>
        <p className="min-w-0 truncate text-sm font-semibold">{attackingTeam.name} の攻撃</p>
      </div>

      <div className="grid grid-cols-2">
        {/* 得点の見出しは短縮名。フル名称はヘッダーと上の攻撃表示が持つ */}
        <TeamScore name={teams.away.short} score={awayScore} attacking={half === "top"} divided />
        <TeamScore name={teams.home.short} score={homeScore} attacking={half === "bottom"} divided={false} />
      </div>

      <div className="border-t border-line px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-muted">アウト</span>
          <span className="text-2xl font-bold tabular-nums leading-none text-ink">{outs}</span>
          {/* 数字だけに頼らないよう3つのドットでも示す */}
          <span className="flex items-center gap-1" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className={`block h-3 w-3 rounded-full ${
                  index < outs ? "bg-ink" : "border border-line bg-surface"
                }`}
              />
            ))}
          </span>
        </div>

        <div className="mt-3">
          <BaseDiamond bases={bases} />
        </div>
      </div>
    </section>
  );
}
