"use client";

import { useEffect, useRef, useState } from "react";
import { useGameShell } from "@/components/game-shell";
import { GameHUD, RoundIntro } from "@/components/game-ui";
import { Button } from "@/components/ui";

const ROUNDS = 5;
const CARD_COUNT = 32;
const COLS = 8;
const HAPPY_POINT = 30;
const BOMB_PENALTY = 500;
const BOOM_DELAY_MS = 1500;

type Card = { bomb: boolean; flipped: boolean };
type Phase = "intro" | "play" | "boom" | "between";

/** 32장 보드 생성 — 폭탄 2~4장을 랜덤 배치 (항상 행복 카드 28장 이상 보장) */
function makeBoard(): { cards: Card[]; bombCount: number } {
  const bombCount = 2 + Math.floor(Math.random() * 3); // 2, 3, 4
  const idx = Array.from({ length: CARD_COUNT }, (_, i) => i);
  // Fisher–Yates 셔플
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = idx[i];
    idx[i] = idx[j];
    idx[j] = tmp;
  }
  const bombSet = new Set(idx.slice(0, bombCount));
  const cards: Card[] = Array.from({ length: CARD_COUNT }, (_, i) => ({
    bomb: bombSet.has(i),
    flipped: false,
  }));
  return { cards, bombCount };
}

function fmt(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default function Game() {
  const { finish } = useGameShell();

  const [phase, setPhase] = useState<Phase>("intro");
  const [round, setRound] = useState(1);
  const [cards, setCards] = useState<Card[]>([]);
  const [bombCount, setBombCount] = useState(0);
  const [pts, setPts] = useState(0); // 이번 판 점수
  const [flips, setFlips] = useState(0); // 이번 판 뒤집은 장수
  const [banked, setBanked] = useState(0); // 확정된 누적 총점
  const [roundScores, setRoundScores] = useState<number[]>([]);
  const [flipCounts, setFlipCounts] = useState<number[]>([]);
  const [bombHits, setBombHits] = useState(0);
  const [cursor, setCursor] = useState(11); // 키보드 선택 위치
  const [boomIndex, setBoomIndex] = useState<number | null>(null);

  const finishedRef = useRef(false);
  const boomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (boomTimerRef.current !== null) clearTimeout(boomTimerRef.current);
    };
  }, []);

  function doFinish(
    scores: number[],
    flipsArr: number[],
    total: number,
    hits: number,
  ) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (boomTimerRef.current !== null) clearTimeout(boomTimerRef.current);
    const avg = flipsArr.reduce((a, b) => a + b, 0) / ROUNDS;
    const style = avg <= 6 ? "신중" : avg >= 13 ? "공격적" : "균형";
    const score = Math.max(
      0,
      Math.min(100, Math.round(((total + 500) / 1700) * 100)),
    );
    finish({
      score,
      label: `총점 ${fmt(total)}점`,
      detail: [
        { name: "판별 점수", value: scores.map(fmt).join(" · ") },
        { name: "평균 뒤집은 장수", value: `${avg.toFixed(1)}장` },
        { name: "폭탄 적중", value: `${hits}회` },
        { name: "플레이 성향", value: style },
      ],
    });
  }

  /** 판 종료 — 점수 확정 후 다음 판 또는 최종 결과 */
  function settleRound(finalPts: number, flipped: number, hits: number) {
    const scores = [...roundScores, finalPts];
    const flipsArr = [...flipCounts, flipped];
    const total = banked + finalPts;
    setRoundScores(scores);
    setFlipCounts(flipsArr);
    setBanked(total);
    setPts(finalPts);
    if (round >= ROUNDS) {
      doFinish(scores, flipsArr, total, hits);
    } else {
      setPhase("between");
    }
  }

  function startRound(nextRound: number) {
    const board = makeBoard();
    setRound(nextRound);
    setCards(board.cards);
    setBombCount(board.bombCount);
    setPts(0);
    setFlips(0);
    setCursor(11);
    setBoomIndex(null);
    setPhase("play");
  }

  function flipAt(i: number) {
    if (phase !== "play") return;
    const card = cards[i];
    if (!card || card.flipped) return;
    const next = cards.slice();
    next[i] = { ...card, flipped: true };
    setCards(next);
    setCursor(i);
    if (card.bomb) {
      const finalPts = pts - BOMB_PENALTY;
      const hits = bombHits + 1;
      setPts(finalPts);
      setBombHits(hits);
      setBoomIndex(i);
      setPhase("boom");
      const flipped = flips + 1;
      boomTimerRef.current = setTimeout(() => {
        boomTimerRef.current = null;
        settleRound(finalPts, flipped, hits);
      }, BOOM_DELAY_MS);
    } else {
      setPts(pts + HAPPY_POINT);
      setFlips(flips + 1);
    }
  }

  function stopRound() {
    if (phase !== "play") return;
    settleRound(pts, flips, bombHits);
  }

  function nextRound() {
    if (phase !== "between") return;
    startRound(round + 1);
  }

  // 키보드 입력 — 최신 상태를 ref 로 참조해 stale closure 방지
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandlerRef.current = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (phase === "play") {
      const col = cursor % COLS;
      const row = Math.floor(cursor / COLS);
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (col > 0) setCursor(cursor - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (col < COLS - 1) setCursor(cursor + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (row > 0) setCursor(cursor - COLS);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (row < CARD_COUNT / COLS - 1) setCursor(cursor + COLS);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        flipAt(cursor);
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        stopRound();
      }
    } else if (phase === "between") {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        nextRound();
      }
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandlerRef.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (phase === "intro") {
    return (
      <RoundIntro
        title="카드 뒤집기"
        lines={[
          `총 ${ROUNDS}판, 판마다 32장의 카드가 뒷면으로 놓입니다.`,
          `행복 카드 😊 는 +${HAPPY_POINT}점, 폭탄 💣 은 -${BOMB_PENALTY}점이며 그 즉시 판이 끝납니다.`,
          "폭탄이 몇 장인지 알 수 없습니다. '그만 뒤집기'를 누르면 이번 판 점수가 확정됩니다.",
          "공략: 폭탄(-500)은 카드(+30)의 17배 — 남은 폭탄 확률이 5.7%를 넘으면 한 장 더는 손해입니다.",
        ]}
        keys={[
          { key: "← ↑ → ↓", action: "카드 선택" },
          { key: "Enter", action: "카드 뒤집기" },
          { key: "S", action: "그만 뒤집기" },
        ]}
        startLabel="1판 시작"
        onStart={() => startRound(1)}
      />
    );
  }

  if (phase === "between") {
    const lastScore = roundScores[roundScores.length - 1] ?? 0;
    const lastFlips = flipCounts[flipCounts.length - 1] ?? 0;
    return (
      <RoundIntro
        title={`${round}판 종료`}
        lines={[
          `이번 판 점수: ${fmt(lastScore)}점 (${lastFlips}장 뒤집음)`,
          `이번 판 폭탄은 ${bombCount}장이었습니다.`,
          `누적 총점: ${fmt(banked)}점`,
        ]}
        startLabel={`${round + 1}판 시작 (Enter)`}
        onStart={nextRound}
      />
    );
  }

  // play / boom — 게임 보드
  return (
    <div className="min-h-[24rem]">
      <GameHUD
        left={`${round}판 / ${ROUNDS}판 · 뒤집은 카드 ${flips}장`}
        right={
          <>
            이번 판 <strong className="text-ink">{fmt(pts)}점</strong>
            {" · "}누적 <strong className="text-ink">{fmt(banked + pts)}점</strong>
          </>
        }
      />

      <p className="mb-4 text-center text-[13px] text-muted">
        폭탄이 몇 장인지 알 수 없습니다 · 😊 +{HAPPY_POINT}점 · 💣 -
        {BOMB_PENALTY}점(즉시 판 종료)
      </p>

      <div className="mx-auto grid max-w-2xl grid-cols-8 gap-1.5 sm:gap-2">
        {cards.map((card, i) => {
          const revealBoom = phase === "boom" && card.bomb && !card.flipped;
          const shown = card.flipped || revealBoom;
          const face = shown ? (card.bomb ? "💣" : "😊") : "?";
          const tone = !shown
            ? "border border-hairline bg-surface-strong text-muted hover:bg-surface-card"
            : card.bomb
              ? "bg-badge-pink"
              : "bg-badge-emerald";
          const cursorRing =
            phase === "play" && i === cursor && !card.flipped
              ? " ring-2 ring-ink ring-offset-1"
              : "";
          const boomRing =
            i === boomIndex ? " ring-2 ring-error ring-offset-1" : "";
          const dim = revealBoom ? " opacity-50" : "";
          return (
            <button
              key={i}
              type="button"
              onClick={() => flipAt(i)}
              onMouseEnter={() => {
                if (phase === "play" && !card.flipped) setCursor(i);
              }}
              disabled={phase !== "play" || card.flipped}
              aria-label={shown ? (card.bomb ? "폭탄" : "행복 카드") : `카드 ${i + 1}`}
              className={`flex aspect-square items-center justify-center rounded-lg text-base font-semibold transition-transform sm:text-xl ${tone}${cursorRing}${boomRing}${dim} ${
                phase === "play" && !card.flipped ? "active:scale-95" : ""
              }`}
            >
              {face}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex h-12 items-center justify-center">
        {phase === "boom" ? (
          <p className="text-sm font-semibold text-error">
            💣 폭탄! -{BOMB_PENALTY}점 — {round}판이 종료됩니다
          </p>
        ) : (
          <Button onClick={stopRound}>그만 뒤집기 (S) — {fmt(pts)}점 확정</Button>
        )}
      </div>
    </div>
  );
}
