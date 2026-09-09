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
 * 打席1つ分のマス。早稲田式の記入法に合わせている。
 *
 * - ひし形の頂点が各塁。下=本塁、右=一塁、上=二塁、左=三塁
 * - 走者が到達した塁まで塁間に斜線を引く
 * - 打席結果の記号は一塁の区画（右下）に書く
 * - 中央には、アウトなら I / II / III、生還なら ●、残塁なら ℓ を置く
 * - アウトになったプレーの記号にはアンダーラインを引く
 * - 3アウトチェンジのときはマスの右下角に斜線2本を入れる
 */
function DiamondMark({ record, label }: { record: CellRecord | null; label: string | null }) {
  const reached = record?.reached ?? 0;
  const traveled = (leg: number) => reached >= leg;
  const isOut = Boolean(record?.outNumber);

  return (
    <svg
      viewBox="0 0 72 72"
      className="h-auto w-full max-w-[72px]"
      role={label ? "img" : "presentation"}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
    >
      {/* 空欄でも塁の罫は残し、白紙のスコアブックに見えるようにする */}
      <polygon points="36,62 62,36 36,10 10,36" fill="none" stroke="var(--color-line)" strokeWidth="1" />

      {/* 到達した塁まで塁間に斜線を引く。本塁→一塁→二塁→三塁→本塁の順 */}
      <g stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round">
        {traveled(1) ? <line x1="36" y1="62" x2="62" y2="36" /> : null}
        {traveled(2) ? <line x1="62" y1="36" x2="36" y2="10" /> : null}
        {traveled(3) ? <line x1="36" y1="10" x2="10" y2="36" /> : null}
        {traveled(4) ? <line x1="10" y1="36" x2="36" y2="62" /> : null}
      </g>

      {/* 中央。アウト数・得点・残塁は同時に起こらないので同じ場所を使う */}
      {record?.outNumber ? (
        <text
          x="36"
          y="41"
          textAnchor="middle"
          className="fill-ink text-[15px] font-bold"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {"I".repeat(record.outNumber)}
        </text>
      ) : null}
      {reached === 4 ? <circle cx="36" cy="36" r="6" fill="var(--color-primary)" /> : null}
      {record?.leftOnBase ? (
        <text x="36" y="42" textAnchor="middle" className="fill-muted text-[17px] italic">
          ℓ
        </text>
      ) : null}

      {/* 打席結果の記号は一塁の区画（右下）。アウトのプレーにはアンダーラインを引く */}
      {record ? (
        <>
          <text
            x="51"
            y="59"
            textAnchor="middle"
            className="text-[11px] font-bold"
            style={{
              fontFamily: "var(--font-mono)",
              fill: "var(--color-ink)",
              stroke: "var(--color-surface)",
              strokeWidth: 3,
              paintOrder: "stroke"
            }}
          >
            {record.event.notation}
          </text>
          {isOut ? <line x1="39" y1="62" x2="63" y2="62" stroke="var(--color-ink)" strokeWidth="1" /> : null}
        </>
      ) : null}

      {/* 3アウトチェンジは右下角に斜線2本 */}
      {record?.outNumber === 3 ? (
        <g stroke="var(--color-ink)" strokeWidth="1.4" strokeLinecap="round">
          <line x1="61" y1="71" x2="71" y2="61" />
          <line x1="65" y1="71" x2="71" y2="65" />
        </g>
      ) : null}

      {/* 打点は左下に点で示す */}
      {record && record.event.rbi > 0
        ? Array.from({ length: Math.min(record.event.rbi, 4) }).map((_, index) => (
            <circle key={index} cx={5 + index * 6} cy={68} r="2" fill="var(--color-ink)" />
          ))
        : null}
    </svg>
  );
}

function describe(cellName: string, record: CellRecord, order: string) {
  return [
    cellName + order,
    resultLabels[record.event.result].label,
    baseWords[record.reached],
    record.leftOnBase ? "残塁" : null,
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

      <p className="mt-2 text-xs leading-relaxed text-muted">
        早稲田式の記入法に合わせています。ひし形の頂点は下から反時計回りに本塁・一塁・二塁・三塁で、塁間の太線は走者が到達した塁を表します。
        打席結果の記号は一塁側（右下）、中央はアウトなら <span className="font-mono font-bold">I</span> /{" "}
        <span className="font-mono font-bold">II</span> / <span className="font-mono font-bold">III</span>、生還なら ●、残塁なら ℓ です。
        アウトになったプレーの記号には下線、3アウトチェンジは右下角の斜線2本、左下の点は打点を示します。
      </p>
    </div>
  );
}
