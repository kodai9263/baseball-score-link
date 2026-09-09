"use client";

import { Check, RotateCcw } from "lucide-react";

type RecordBarProps = {
  batterName: string;
  resultLabel: string;
  canUndo: boolean;
  onRecord: () => void;
  onUndo: () => void;
  /** 保存処理を足したときに二重送信を止めるための口。現状は常に false */
  pending?: boolean;
};

/**
 * 画面の主操作。
 * 主CTAは「この内容で記録」だけにし、取消は副操作として明確に格を下げる。
 */
export function RecordBar({
  batterName,
  resultLabel,
  canUndo,
  onRecord,
  onUndo,
  pending = false
}: RecordBarProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* 何を記録しようとしているかをCTAの真上に再掲し、誤入力を減らす */}
      <p className="text-sm leading-snug text-muted">
        <span className="font-bold text-ink">{batterName}</span>
        <span> の結果を </span>
        <span className="rounded bg-primary-soft px-1.5 py-0.5 font-bold text-primary-dark">{resultLabel}</span>
        <span> として記録します</span>
      </p>

      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={onRecord}
          disabled={pending}
          aria-busy={pending}
          className="inline-flex min-h-[52px] flex-1 select-none items-center justify-center gap-2 rounded-control bg-action px-4 text-[17px] font-bold text-white transition-colors duration-150 hover:bg-action-hover active:bg-action-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Check size={20} aria-hidden="true" />
          この内容で記録
        </button>

        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="直前のプレーを取り消す"
          className="inline-flex min-h-[52px] shrink-0 select-none items-center justify-center gap-1.5 rounded-control border border-line bg-surface px-3.5 text-sm font-bold text-muted transition-colors duration-150 hover:border-muted hover:text-ink active:bg-sunken disabled:cursor-not-allowed disabled:border-line disabled:bg-sunken disabled:text-muted disabled:opacity-55"
        >
          <RotateCcw size={17} aria-hidden="true" />
          取消
        </button>
      </div>
    </div>
  );
}
