import { getPlayer, resultLabels } from "@/lib/score-data";
import type { PlayEvent } from "@/lib/types";

type RecentPlaysProps = {
  events: PlayEvent[];
};

/**
 * 直近プレー。
 * 最新の1件を最も目立たせ、回表裏・選手名・結果・打点・追加アウトの順に読ませる。
 */
export function RecentPlays({ events }: RecentPlaysProps) {
  if (events.length === 0) {
    return (
      <p className="rounded-control border border-dashed border-line bg-sunken px-3 py-4 text-sm text-muted">
        まだ記録はありません。「打席結果」から結果を選び、「この内容で記録」を押すとここに残ります。
      </p>
    );
  }

  const recent = events.slice(-6).reverse();

  return (
    <ol className="space-y-2">
      {recent.map((event, index) => {
        const batter = getPlayer(event.batterId);
        const isLatest = index === 0;

        return (
          <li
            key={event.id}
            className={`rounded-control border px-3 py-2.5 ${
              isLatest ? "border-primary bg-primary-soft" : "border-line bg-surface"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                  <span className="tabular-nums">
                    {event.inning}回{event.half === "top" ? "表" : "裏"}
                  </span>
                  {isLatest ? (
                    <span className="rounded bg-primary px-1.5 py-0.5 text-[11px] font-bold leading-tight text-white">
                      最新
                    </span>
                  ) : null}
                </p>
                <p className={`mt-0.5 truncate font-bold ${isLatest ? "text-base text-ink" : "text-sm text-ink"}`}>
                  {batter.name}
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  {resultLabels[event.result].label}
                  <span aria-hidden="true"> ・ </span>
                  <span className="tabular-nums">打点 {event.rbi}</span>
                  <span aria-hidden="true"> ・ </span>
                  <span className="tabular-nums">追加アウト {event.outsAdded}</span>
                </p>
              </div>
              <span className="shrink-0 rounded border border-line bg-surface px-2 py-1 font-mono text-xs font-bold text-muted">
                {event.notation}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
