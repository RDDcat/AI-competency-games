"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, KeyCap } from "@/components/ui";

/** 게임 화면 상단 HUD — 좌측 라벨(라운드·문항), 우측 라벨(타이머·점수) */
export function GameHUD({
  left,
  right,
}: {
  left: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center justify-between rounded-lg bg-surface-soft px-4 py-2.5 text-sm font-medium text-body">
      <div>{left}</div>
      {right && <div className="tabular-nums">{right}</div>}
    </div>
  );
}

/** 라운드 시작 전 안내 화면 */
export function RoundIntro({
  title,
  lines,
  keys,
  startLabel = "라운드 시작",
  onStart,
}: {
  title: string;
  lines: string[];
  keys?: { key: string; action: string }[];
  startLabel?: string;
  onStart: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-10 text-center">
      <h2 className="display-sm mb-4">{title}</h2>
      <ul className="mb-6 space-y-2 text-[15px] leading-relaxed text-body">
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      {keys && (
        <div className="mb-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {keys.map((k) => (
            <span
              key={k.key}
              className="inline-flex items-center gap-1.5 text-[13px] text-muted"
            >
              <KeyCap>{k.key}</KeyCap> {k.action}
            </span>
          ))}
        </div>
      )}
      <Button onClick={onStart}>{startLabel}</Button>
    </div>
  );
}

/** 3·2·1 카운트다운 후 onDone 호출 */
export function Countdown({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(3);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (n === 0) {
      doneRef.current();
      return;
    }
    const t = setTimeout(() => setN((v) => v - 1), 700);
    return () => clearTimeout(t);
  }, [n]);

  return (
    <div className="flex h-64 items-center justify-center">
      <span className="display-xl">{n}</span>
    </div>
  );
}

/**
 * 카운트다운 훅 — running 동안 10ms 간격으로 남은 시간을 줄인다.
 * 만료 시 onExpire 1회 호출.
 */
export function useCountdown(
  totalMs: number,
  running: boolean,
  onExpire?: () => void,
) {
  const [remaining, setRemaining] = useState(totalMs);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;

  useEffect(() => {
    if (!running) return;
    setRemaining(totalMs);
    const startedAt = Date.now();
    const id = setInterval(() => {
      const left = totalMs - (Date.now() - startedAt);
      if (left <= 0) {
        clearInterval(id);
        setRemaining(0);
        expireRef.current?.();
      } else {
        setRemaining(left);
      }
    }, 10);
    return () => clearInterval(id);
  }, [totalMs, running]);

  return remaining;
}

/** mm:ss 표기 */
export function formatSec(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** 문항 응답 제한시간 시각화 — 가로 진행 바 */
export function TimeBar({ remaining, total }: { remaining: number; total: number }) {
  const ratio = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-strong">
      <div
        className={`h-full rounded-full transition-[width] duration-100 ${
          ratio < 0.3 ? "bg-error" : "bg-ink"
        }`}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}

/** 정답/오답 순간 피드백 표시 */
export function Flash({ ok }: { ok: boolean | null }) {
  if (ok === null) return <div className="h-6" />;
  return (
    <div
      className={`flex h-6 items-center justify-center text-sm font-semibold ${
        ok ? "text-success" : "text-error"
      }`}
    >
      {ok ? "정답!" : "오답"}
    </div>
  );
}
