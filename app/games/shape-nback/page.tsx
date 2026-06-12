import GameShell from "@/components/game-shell";
import Game from "./game";
export const metadata = { title: "도형 순서 기억하기 — 역검 아케이드" };
export default function Page() {
  return (
    <GameShell slug="shape-nback">
      <Game />
    </GameShell>
  );
}
