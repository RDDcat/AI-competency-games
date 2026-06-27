"use client";

import { useEffect, useState } from "react";
import { LinkButton } from "@/components/ui";
import { getGame } from "@/lib/games";
import { bestScore, lastPlayed } from "@/lib/storage";

/** 신규 방문자에게 권하는 첫 게임 — 진입장벽이 가장 낮은 가위바위보 */
const FIRST_GAME = "rps";

type Resume = {
  slug: string;
  title: string;
  emoji: string;
  best: number | null;
};

export default function HomeHeroCta() {
  const [resume, setResume] = useState<Resume | null>(null);

  // 마운트 후에만 localStorage 확인 → SSR/첫 페인트는 항상 신규 버전(하이드레이션 일치)
  useEffect(() => {
    const lp = lastPlayed();
    if (!lp) return;
    try {
      const g = getGame(lp.slug); // 알 수 없는 slug 면 throw → 무시
      setResume({
        slug: lp.slug,
        title: g.title,
        emoji: g.emoji,
        best: bestScore(lp.slug),
      });
    } catch {
      /* 정의되지 않은 게임 기록은 무시 */
    }
  }, []);

  // ── 재방문자: 전면 카피와 CTA를 다르게 ──
  if (resume) {
    return (
      <div>
        <div className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-surface-card px-4 py-3 text-sm">
          <span className="font-semibold text-ink">👋 다시 오셨네요</span>
          <span className="text-muted">
            마지막 연습{" "}
            <span className="font-medium text-ink">
              {resume.emoji} {resume.title}
            </span>
            {resume.best !== null && (
              <>
                {" · "}최고 <span className="font-semibold text-ink">{resume.best}점</span>
              </>
            )}
          </span>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <LinkButton href={`/games/${resume.slug}`} className="h-11 px-6">
            이어서 연습하기 →
          </LinkButton>
          <LinkButton variant="secondary" href="#games" className="h-11 px-6">
            다른 게임 보기
          </LinkButton>
        </div>
      </div>
    );
  }

  // ── 신규(또는 판단 전): 첫 게임으로 바로 진입 ──
  return (
    <div className="flex flex-wrap gap-3">
      <LinkButton href={`/games/${FIRST_GAME}`} className="h-11 px-6">
        가위바위보로 바로 시작 →
      </LinkButton>
      <LinkButton variant="secondary" href="#games" className="h-11 px-6">
        전략게임 9종 보기
      </LinkButton>
    </div>
  );
}
