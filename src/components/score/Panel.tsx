import type { ReactNode } from "react";

type PanelProps = {
  title: string;
  icon: ReactNode;
  /** 見出しの直下に置く補足。何のための面かを1行で説明する */
  description?: string;
  children: ReactNode;
};

/** 画面内の各セクションを包む共通カード */
export function Panel({ title, icon, description, children }: PanelProps) {
  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center gap-2 text-primary">
        {icon}
        <h2 className="text-base font-bold text-ink">{title}</h2>
      </div>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}
