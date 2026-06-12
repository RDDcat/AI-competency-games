"use client";

import { useEffect, useState } from "react";
import { bestScore } from "@/lib/storage";

/** 게임 카드에 표시하는 내 최고 기록 — 클라이언트에서만 렌더 */
export default function BestChip({ slug }: { slug: string }) {
  const [best, setBest] = useState<number | null>(null);

  useEffect(() => {
    setBest(bestScore(slug));
  }, [slug]);

  if (best === null) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-canvas px-2.5 py-0.5 text-[12px] font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      최고 {best}점
    </span>
  );
}
