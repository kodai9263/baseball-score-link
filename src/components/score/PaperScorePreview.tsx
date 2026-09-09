import { MoveHorizontal } from "lucide-react";
import { buildCellRecord, buildPlayerSummary, findPlateAppearances } from "@/lib/paper-score";
import type { CellRecord } from "@/lib/paper-score";
import { getPlayer, lineup, regulationInnings, resultLabels } from "@/lib/score-data";
import type { PlayEvent } from "@/lib/types";

type PaperScorePreviewProps = {
  events: PlayEvent[];
  /** 表示するイニング。延長したときは6回より伸びる */
  innings: string[];
};

const baseWords = ["アウト", "一塁", "二塁", "三塁", "生還"] as const;

/**
 * 打席1つ分の菱形。
 * 走者が通った塁間を太線で描き、生還したら塗りつぶす早稲田式寄りの表現にする。
 */
function DiamondMark({ record, label }: { record: CellRecord | null; label: string | null }) {
  const reached = record?.reached ?? 0;
  const scored = reached === 4;
  const traveled = (leg: number) => reached >= leg;

  return (
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
  );
}

function describe(cellName: string, record: CellRecord, order: string) {
  return [
    cellName + order,
    resultLabels[record.event.result].label,
    baseWords[record.reached],
    record.outNumber ? `この回${record.outNumber}アウト目` : null,
    record.event.rbi > 0 ? `打点${record.event.rbi}` : null
  ]
    .filter(Boolean)
    .join("、");
}

/**
 * 紙スコアのマス1つ。
 * 打者一巡して同じ回に2打席立った場合は、紙のスコアブックと同じように
 * 同じマスへ縦に並べる。打席を隠さない。
 */
function ScoreCell({ records, cellName }: { records: CellRecord[]; cellName: string }) {
  return (
    <div className="flex min-h-[84px] flex-col items-center justify-center gap-1.5 border-r border-t border-line p-1">
      {records.length === 0 ? (
        <DiamondMark record={null} label={null} />
      ) : (
        records.map((record, index) => (
          <DiamondMark
            key={record.event.id}
            record={record}
            label={describe(cellName, record, records.length > 1 ? ` ${index + 1}打席目` : "")}
          />
        ))
      )}
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
export function PaperScorePreview({ events, innings }: PaperScorePreviewProps) {
  // 打順116px + 各回76px + 成績欄4列40px
  const gridTemplateColumns = `116px repeat(${innings.length}, minmax(0, 1fr)) repeat(4, 40px)`;
  const minWidth = 116 + innings.length * 76 + 160;

  return (
    <div>
      {/*
        表がはみ出す幅では、スクロールできることを明示する。
        6回までなら1280px以上で収まるが、延長すると広い画面でもはみ出すので常に出す。
      */}
      <p
        className={`mb-2 flex items-center gap-1.5 text-xs text-muted ${
          innings.length > regulationInnings ? "" : "xl:hidden"
        }`}
      >
        <MoveHorizontal size={14} aria-hidden="true" />
        横にスクロールすると{innings.length}回と成績欄まで見られます
      </p>

      <div className="overflow-x-auto rounded-control border border-line bg-surface">
        <div
          className="grid text-sm"
          style={{ gridTemplateColumns, minWidth }}
          role="group"
          aria-label="打順ごとの打席結果プレビュー"
        >
          <div className="border-b border-r border-line bg-sunken p-2 text-xs font-bold text-muted">打順</div>
          {innings.map((inning) => (
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

                {innings.map((inning) => (
                  <ScoreCell
                    key={`${player.id}-${inning}`}
                    cellName={`${inning}回 ${slot.order}番 ${player.name}`}
                    records={findPlateAppearances(events, player.id, Number(inning)).map((index) =>
                      buildCellRecord(events, index)
                    )}
                  />
                ))}

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
