/**
 * 도형 순서 기억하기(2-back / 2&3-back) 시퀀스 생성기.
 * 도형은 0·1·2 인덱스로 다루고, 표시용 이모지는 game.tsx 의 풀에서 매핑한다.
 *
 * 매칭 비율 제어:
 * - R1(응답 20회): 2-back 일치 7회(35%)를 위치 추첨으로 확정 배치.
 * - R2(응답 24회): 2-back 일치 6회(25%) + 3-back 일치 6회(25%) + 불일치 12회.
 *   2-back 과 3-back 이 동시에 일치하는 문항은 생성 단계에서 배제한다.
 */

export type Action = "left" | "right" | "space";

export const R1_MEMO = 2;
export const R1_RESP = 20; // 시퀀스 22개
export const R2_MEMO = 3;
export const R2_RESP = 24; // 시퀀스 27개
export const TOTAL_RESP = R1_RESP + R2_RESP; // 44

const R1_MATCH = 7; // 35%
const R2_2B = 6; // 25%
const R2_3B = 6; // 25%

function rand3(): number {
  return Math.floor(Math.random() * 3);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** R1: 2-back 일치 위치를 먼저 추첨해 비율(7/20)을 정확히 맞춘다. */
export function makeRound1Seq(): number[] {
  const seq: number[] = [rand3(), rand3()];
  const matchSet = new Set(
    shuffle(Array.from({ length: R1_RESP }, (_, k) => k)).slice(0, R1_MATCH),
  );
  for (let k = 0; k < R1_RESP; k++) {
    const back2 = seq[k]; // seq[i-2], i = k + 2
    if (matchSet.has(k)) {
      seq.push(back2);
    } else {
      // 2-back 과 다른 도형만 — 우연 일치 원천 차단
      seq.push(pick([0, 1, 2].filter((s) => s !== back2)));
    }
  }
  return seq;
}

/**
 * R2: 라벨(2b×6 / 3b×6 / 불일치×12)을 섞어 배치하되,
 * seq[i-2] === seq[i-3] 인 자리에는 일치 라벨을 둘 수 없으므로(동시 일치가 되어버림)
 * 뒤쪽의 불일치 라벨과 맞바꾼다. 교환 불가 시 전체 재시도.
 */
export function makeRound2Seq(): number[] {
  for (let attempt = 0; attempt < 300; attempt++) {
    const labels: ("2b" | "3b" | "no")[] = shuffle([
      ...Array<"2b">(R2_2B).fill("2b"),
      ...Array<"3b">(R2_3B).fill("3b"),
      ...Array<"no">(R2_RESP - R2_2B - R2_3B).fill("no"),
    ]);
    const seq: number[] = [rand3(), rand3(), rand3()];
    let ok = true;
    for (let k = 0; k < R2_RESP; k++) {
      const i = k + R2_MEMO;
      const back2 = seq[i - 2];
      const back3 = seq[i - 3];
      if (labels[k] !== "no" && back2 === back3) {
        const j = labels.findIndex((l, idx) => idx > k && l === "no");
        if (j === -1) {
          ok = false;
          break;
        }
        [labels[k], labels[j]] = [labels[j], labels[k]];
      }
      const label = labels[k];
      if (label === "2b") {
        seq.push(back2); // back2 !== back3 보장 → 3-back 동시 일치 없음
      } else if (label === "3b") {
        seq.push(back3); // back3 !== back2 보장 → 2-back 동시 일치 없음
      } else {
        // 둘 다와 다른 도형 — back2===back3 이면 2종, 아니면 1종 남아 항상 존재
        seq.push(pick([0, 1, 2].filter((s) => s !== back2 && s !== back3)));
      }
    }
    if (ok) return seq;
  }
  // 사실상 도달 불가 안전망: 전부 불일치 시퀀스 (항상 생성 가능)
  const seq: number[] = [rand3(), rand3(), rand3()];
  for (let k = 0; k < R2_RESP; k++) {
    const i = k + R2_MEMO;
    seq.push(pick([0, 1, 2].filter((s) => s !== seq[i - 2] && s !== seq[i - 3])));
  }
  return seq;
}

/** 시퀀스에서 정답 키를 유도 — 2-back 우선(left), 그다음 3-back(right). */
export function answersFor(
  seq: number[],
  memo: number,
  useThreeBack: boolean,
): Action[] {
  const out: Action[] = [];
  for (let i = memo; i < seq.length; i++) {
    if (seq[i] === seq[i - 2]) out.push("left");
    else if (useThreeBack && seq[i] === seq[i - 3]) out.push("right");
    else out.push("space");
  }
  return out;
}
