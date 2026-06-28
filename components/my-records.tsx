"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GAMES } from "@/lib/games";
import { LinkButton } from "@/components/ui";
import { loadHistory, type GameResult } from "@/lib/storage";

type LogEntry = GameResult & {
  slug: string;
  title: string;
  emoji: string;
};

type BestRow = {
  slug: string;
  title: string;
  emoji: string;
  tier: string;
  best: number | null;
  count: number;
};

/** ISO → "2026.06.27 14:32" (클라이언트에서만 호출) */
function formatWhen(at?: string): string {
  if (!at) return "—";
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
}

export default function MyRecords() {
  const [ready, setReady] = useState(false);
  const [bests, setBests] = useState<BestRow[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  // 마운트 후에만 localStorage 접근 → SSR/첫 페인트와 하이드레이션 일치
  useEffect(() => {
    const allLog: LogEntry[] = [];
    const rows: BestRow[] = GAMES.map((g) => {
      const hist = loadHistory(g.slug);
      for (const r of hist) {
        allLog.push({ ...r, slug: g.slug, title: g.title, emoji: g.emoji });
      }
      return {
        slug: g.slug,
        title: g.title,
        emoji: g.emoji,
        tier: g.tier,
        best: hist.length ? Math.max(...hist.map((h) => h.score)) : null,
        count: hist.length,
      };
    });
    allLog.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
    setBests(rows);
    setLog(allLog);
    setReady(true);
  }, []);

  const gamesPlayed = useMemo(
    () => bests.filter((b) => b.best !== null).length,
    [bests],
  );

  if (!ready) {
    return (
      <p className="py-20 text-center text-sm text-muted">
        기록을 불러오는 중…
      </p>
    );
  }

  if (log.length === 0) {
    return (
      <div className="rounded-2xl border border-hairline bg-surface-card p-10 text-center">
        <p className="text-lg font-semibold text-ink">
          아직 플레이 기록이 없어요
        </p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          게임을 한 판이라도 플레이하면 이 기기에 기록이 저장되고, 여기에서
          게임별 최고 기록과 플레이 로그를 볼 수 있어요.
        </p>
        <div className="mt-6">
          <LinkButton href="/#games">게임 시작하기</LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <p className="text-sm text-muted">
        지금까지 <b className="text-ink">{gamesPlayed}종</b>의 게임을{" "}
        <b className="text-ink">{log.length}번</b> 플레이했어요. 모든 기록은 이
        브라우저에만 저장됩니다.
      </p>

      {/* ── 게임별 최고 기록 ── */}
      <section>
        <h2 className="display-sm mb-5">게임별 최고 기록</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bests.map((b) => (
            <Link
              key={b.slug}
              href={`/games/${b.slug}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-canvas p-4 transition-colors hover:bg-surface-soft"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="text-xl">{b.emoji}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {b.title}
                  </span>
                  <span className="block text-[12px] text-muted-soft">
                    {b.count > 0 ? `${b.count}회 플레이` : "미플레이"}
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-right">
                {b.best !== null ? (
                  <span className="text-lg font-bold tabular-nums text-ink">
                    {b.best}
                    <span className="text-[12px] font-medium text-muted-soft">
                      점
                    </span>
                  </span>
                ) : (
                  <span className="text-[13px] text-muted-soft">기록 없음</span>
                )}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 플레이 로그 ── */}
      <section>
        <h2 className="display-sm mb-5">플레이 로그</h2>
        <ul className="divide-y divide-hairline-soft overflow-hidden rounded-xl border border-hairline">
          {log.map((e, i) => {
            const open = openIdx === i;
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : i)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-3 bg-canvas px-4 py-3 text-left transition-colors hover:bg-surface-soft"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="text-lg">{e.emoji}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">
                        {e.title}
                      </span>
                      <span className="block text-[12px] text-muted-soft">
                        {formatWhen(e.at)}
                      </span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-base font-semibold tabular-nums text-ink">
                      {e.score}점
                    </span>
                    <span
                      className={`text-muted-soft transition-transform ${
                        open ? "rotate-180" : ""
                      }`}
                    >
                      ▾
                    </span>
                  </span>
                </button>

                {open && (
                  <div className="bg-surface-soft px-4 py-4">
                    {e.label && (
                      <p className="mb-3 text-sm font-medium text-body">
                        {e.label}
                      </p>
                    )}
                    {e.detail && e.detail.length > 0 ? (
                      <dl className="divide-y divide-hairline-soft rounded-lg bg-canvas px-4">
                        {e.detail.map((d) => (
                          <div
                            key={d.name}
                            className="flex items-center justify-between py-2.5 text-sm"
                          >
                            <dt className="text-muted">{d.name}</dt>
                            <dd className="font-semibold text-ink">{d.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="text-[13px] text-muted-soft">
                        상세 정보가 없는 기록입니다.
                      </p>
                    )}
                    <div className="mt-3">
                      <Link
                        href={`/games/${e.slug}`}
                        className="text-[13px] font-semibold text-ink hover:underline"
                      >
                        이 게임 다시 하기 →
                      </Link>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
