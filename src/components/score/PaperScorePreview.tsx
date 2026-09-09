import { MoveHorizontal } from "lucide-react";
import { getPlayer, inningLabels, lineup, resultLabels } from "@/lib/score-data";
import type { PlateAppearanceResult, PlayEvent } from "@/lib/types";

type PaperScorePreviewProps = {
  events: PlayEvent[];
};

/** 安打として数える打席結果 */
const hitResults: PlateAppearanceResult[] = ["single", "double", "triple", "home_run"];
/** 打数に数えない打席結果 */
const notAtBatResults: PlateAppearanceResult[] = ["walk", "hit_by_pitch", "sacrifice"];

/** 到達した塁。0=アウト、1〜3=各塁、4=生還 */
type Reached = 0 | 1 | 2 | 3 | 4;

type CellRecord = {
  event: PlayEvent;
  reached: Reached;
  /** その半回で何個目のアウトだったか */
  outNumber: number | null;
  /** 同じ回に2打席以上あるときの残り打席数 */
  extraCount: number;
};

const baseWords = ["アウト", "一塁", "二塁", "三塁", "生還"] as const;

/**
 * 1つの打席を紙スコアのマスに描くための情報を、既存のイベント列から復元する。
 * 打席時点の到達塁は basesAfter から読み、その後の進塁と生還は
 * 同じ半回の後続イベントを追って求める。試合進行ロジックには手を入れない。
 */
function buildCellRecord(events: PlayEvent[], index: number): CellRecord {
  const event = events[index];
  const playerId = event.batterId;

  let reached: Reached = 0;
  if (event.runsScored.includes(playerId)) {
    reached = 4;
  } else if (event.basesAfter.third === playerId) {
    reached = 3;
  } else if (event.basesAfter.second === playerId) {
    reached = 2;
  } else if (event.basesAfter.first === playerId) {
    reached = 1;
  }

  // 出塁していれば、同じ半回の後続プレーでどこまで進んだかを追う
  if (reached > 0 && reached < 4) {
    for (let i = index + 1; i < events.length; i += 1) {
      const later = events[i];
      if (later.inning !== event.inning || later.half !== event.half) break;

      if (later.runsScored.includes(playerId)) {
        reached = 4;
        break;
      }
      if (later.basesAfter.third === playerId) reached = Math.max(reached, 3) as Reached;
      else if (later.basesAfter.second === playerId) reached = Math.max(reached, 2) as Reached;
    }
  }

  let outNumber: number | null = null;
  if (event.outsAdded > 0) {
    outNumber = events
      .slice(0, index + 1)
      .filter((item) => item.inning === event.inning && item.half === event.half)
      .reduce((total, item) => total + item.outsAdded, 0);
  }

  const extraCount = events.filter(
    (item) => item.batterId === playerId && item.inning === event.inning && item.half === event.half
  ).length - 1;

  return { event, reached, outNumber, extraCount };
}

/** 選手ごとの打数・安打・打点・得点。表右側の成績欄に出す */
function buildPlayerSummary(events: PlayEvent[], playerId: string) {
  const own = events.filter((event) => event.batterId === playerId);

  return {
    atBats: own.filter((event) => !notAtBatResults.includes(event.result)).length,
    hits: own.filter((event) => hitResults.includes(event.result)).length,
    rbi: own.reduce((total, event) => total + event.rbi, 0),
    runs: events.filter((event) => event.runsScored.includes(playerId)).length
  };
}

/**
 * 紙スコアのマス1つ。
 * 走者が通った塁間を太線で描き、生還したら菱形を塗りつぶす早稲田式寄りの表現にする。
 */
function ScoreCell({ record, cellName }: { record: CellRecord | null; cellName: string }) {
  const reached = record?.reached ?? 0;
  const scored = reached === 4;
  const traveled = (leg: number) => reached >= leg;

  // マス単位で読んでも文脈が分かるよう、回と選手名から書き起こす
  const label = record
    ? [
        cellName,
        resultLabels[record.event.result].label,
        baseWords[reached],
        record.outNumber ? `この回${record.outNumber}アウト目` : null,
        record.event.rbi > 0 ? `打点${record.event.rbi}` : null,
        record.extraCount > 0 ? `他${record.extraCount}打席` : null
      ]
        .filter(Boolean)
        .join("、")
    : null;

  return (
    <div className="flex min-h-[84px] items-center justify-center border-r border-t border-line p-1">
      <svg
        viewBox="0 0 72 72"
        className="h-auto w-full max-w-[72px]"
        role={label ? "img" : "presentation"}
        aria-label={label ?? undefined}
        aria-hidden={label ? undefined : true}
      >
        {/* 空欄でも菱形の罫は残し、白紙のスコアブックに見えるようにする */}
        <polygon
          points="36,64 64,36 36,8 8,36"
          fill={scored ? "var(--color-primary)" : "none"}
          stroke="var(--color-line)"
          strokeWidth="1"
        />

        {/* 走者が通過した塁間。本塁→一塁→二塁→三塁→本塁の順に太線で重ねる */}
        <g stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round">
          {traveled(1) ? <line x1="36" y1="64" x2="64" y2="36" /> : null}
          {traveled(2) ? <line x1="64" y1="36" x2="36" y2="8" /> : null}
          {traveled(3) ? <line x1="36" y1="8" x2="8" y2="36" /> : null}
          {traveled(4) ? <line x1="8" y1="36" x2="36" y2="64" /> : null}
        </g>

        {/* 打点は左下に点で示す（紙スコアの慣習） */}
        {record && record.event.rbi > 0
          ? Array.from({ length: Math.min(record.event.rbi, 4) }).map((_, index) => (
              <circle key={index} cx={6 + index * 7} cy={68} r="2.2" fill="var(--color-ink)" />
            ))
          : null}

        {/* アウトはその回の何個目かを丸囲みで右上に置く */}
        {record?.outNumber ? (
          <>
            <circle cx="62" cy="10" r="8" fill="var(--color-surface)" stroke="var(--color-ink)" strokeWidth="1.2" />
            <text
              x="62"
              y="14"
              textAnchor="middle"
              className="fill-ink text-[11px] font-bold"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {record.outNumber}
            </text>
          </>
        ) : null}

        {/* 同じ回に2打席以上あるときは左上に残数を出す */}
        {record && record.extraCount > 0 ? (
          <text x="6" y="14" className="fill-muted text-[10px] font-bold">
            +{record.extraCount}
          </text>
        ) : null}

        {/* 打席結果の記号。線と重なっても読めるよう下地色で縁取る */}
        {record ? (
          <text
            x="36"
            y="41"
            textAnchor="middle"
            className="text-[14px] font-bold"
            style={{
              fontFamily: "var(--font-mono)",
              fill: scored ? "#ffffff" : "var(--color-ink)",
              stroke: scored ? "var(--color-primary)" : "var(--color-surface)",
              strokeWidth: 3,
              paintOrder: "stroke"
            }}
          >
            {record.event.notation}
          </text>
        ) : null}
      </svg>
    </div>
  );
}

function SummaryCell({ value, emphasized = false }: { value: number; emphasized?: boolean }) {
  return (
    <div
      className={`flex min-h-[84px] items-center justify-center border-r border-t border-line text-sm tabular-nums ${
        emphasized ? "bg-sunken font-bold text-ink" : "text-muted"
      }`}
    >
      {value}
    </div>
  );
}

/**
 * 紙スコア風プレビュー。
 * これは入力UIではなく出力プレビューなので、罫線と記号の可読性を優先し装飾は足さない。
 */
export function PaperScorePreview({ events }: PaperScorePreviewProps) {
  return (
    <div>
      {/* 1280px未満では表がはみ出すので、そこまではスクロール可能なことを明示する */}
      <p className="mb-2 flex items-center gap-1.5 text-xs text-muted xl:hidden">
        <MoveHorizontal size={14} aria-hidden="true" />
        横にスクロールすると6回と成績欄まで見られます
      </p>

      <div className="overflow-x-auto rounded-control border border-line bg-surface">
        <div
          className="grid min-w-[732px] grid-cols-[116px_repeat(6,minmax(0,1fr))_repeat(4,40px)] text-sm"
          role="group"
          aria-label="打順ごとの打席結果プレビュー"
        >
          <div className="border-b border-r border-line bg-sunken p-2 text-xs font-bold text-muted">打順</div>
          {inningLabels.map((inning) => (
            <div
              key={inning}
              className="border-b border-r border-line bg-sunken p-2 text-center text-xs font-bold tabular-nums text-muted"
            >
              {inning}回
            </div>
          ))}
          {["打数", "安打", "打点", "得点"].map((label) => (
            <div
              key={label}
              className="border-b border-r border-line bg-sunken px-1 py-2 text-center text-[10px] font-bold text-muted"
            >
              {label}
            </div>
          ))}

          {lineup.map((slot) => {
            const player = getPlayer(slot.playerId);
            const summary = buildPlayerSummary(events, player.id);

            return (
              <div key={player.id} className="contents">
                <div className="border-r border-t border-line p-2">
                  <p className="truncate font-bold text-ink">
                    <span className="tabular-nums">{slot.order}.</span> {player.name}
                  </p>
                  <p className="truncate text-xs text-muted">
                    <span className="tabular-nums">#{player.number}</span> {slot.position}
                  </p>
                </div>

                {inningLabels.map((inning) => {
                  const index = events.findIndex(
                    (event) => event.batterId === player.id && event.inning === Number(inning)
                  );

                  return (
                    <ScoreCell
                      key={`${player.id}-${inning}`}
                      cellName={`${inning}回 ${slot.order}番 ${player.name}`}
                      record={index === -1 ? null : buildCellRecord(events, index)}
                    />
                  );
                })}

                <SummaryCell value={summary.atBats} />
                <SummaryCell value={summary.hits} emphasized />
                <SummaryCell value={summary.rbi} />
                <SummaryCell value={summary.runs} emphasized />
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-2 text-xs text-muted">
        菱形は走者の進塁を表します。塁間の太線は到達した塁、塗りつぶしは生還、右上の丸数字はその回の何アウト目か、左下の点は打点です。
      </p>
    </div>
  );
}
