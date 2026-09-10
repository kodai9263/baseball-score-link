import { teams } from "@/lib/score-data";

type LineScoreProps = {
  currentInning: number;
  /** 表示するイニング。延長したときは6回より伸びる */
  innings: string[];
  rows: Array<{ team: string; values: number[]; total: number }>;
};

/**
 * イニング別得点。
 * チーム名列と合計列を左右に固定し、モバイルで横スクロールしても合計が見切れないようにする。
 */
export function LineScore({ currentInning, innings, rows }: LineScoreProps) {
  // チーム名116px + 各回44px + 合計56px
  const minWidth = 116 + innings.length * 44 + 56;

  return (
    <div className="overflow-x-auto rounded-control border border-line">
      {/* sticky を効かせるため border-collapse は使わず、罫線はセル側に持たせる */}
      <table className="w-full border-separate border-spacing-0 text-sm" style={{ minWidth }}>
        <caption className="sr-only">イニング別得点</caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-10 border-b border-r border-line bg-sunken px-3 py-2 text-left text-xs font-bold text-muted"
            >
              チーム
            </th>
            {innings.map((inning) => {
              const isCurrent = Number(inning) === currentInning;

              return (
                <th
                  key={inning}
                  scope="col"
                  className={`w-11 border-b border-line px-1 py-2 text-center text-xs font-bold tabular-nums ${
                    isCurrent ? "bg-primary-soft text-primary-dark" : "bg-sunken text-muted"
                  }`}
                >
                  {inning}
                  {isCurrent ? <span className="sr-only">（現在のイニング）</span> : null}
                </th>
              );
            })}
            <th
              scope="col"
              className="sticky right-0 z-10 w-14 border-b border-l border-line bg-sunken px-2 py-2 text-center text-xs font-bold text-ink"
            >
              計
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const isLast = rowIndex === rows.length - 1;
            const cellBorder = isLast ? "" : "border-b border-line";

            return (
              <tr key={row.team}>
                <th
                  scope="row"
                  className={`sticky left-0 z-10 border-r border-line bg-surface px-3 py-2.5 text-left font-bold text-ink ${cellBorder}`}
                >
                  <span className="block max-w-[7.5rem] truncate">{row.team}</span>
                </th>
                {row.values.map((value, index) => {
                  const isCurrent = index + 1 === currentInning;

                  return (
                    <td
                      key={`${row.team}-${index}`}
                      className={`px-1 py-2.5 text-center tabular-nums ${cellBorder} ${
                        isCurrent ? "bg-primary-soft font-bold text-primary-dark" : "text-ink"
                      }`}
                    >
                      {value}
                    </td>
                  );
                })}
                <td
                  className={`sticky right-0 z-10 border-l border-line bg-sunken px-2 py-2.5 text-center text-base font-bold tabular-nums text-ink ${cellBorder}`}
                >
                  {row.total}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** ライブ共有表に渡す行データ。得点集計そのものはページ側の既存ロジックが持つ */
export function buildLineScoreRows(
  scoreByInning: Array<{ topRuns: number; bottomRuns: number }>,
  awayScore: number,
  homeScore: number,
  matchTeams: { away: { name: string }; home: { name: string } } = teams
) {
  return [
    { team: matchTeams.away.name, values: scoreByInning.map((item) => item.topRuns), total: awayScore },
    { team: matchTeams.home.name, values: scoreByInning.map((item) => item.bottomRuns), total: homeScore }
  ];
}
