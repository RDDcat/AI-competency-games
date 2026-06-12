import GameShell from "@/components/game-shell";
import Game from "./game";
export const metadata = { title: "도형 회전하기 — 역검 아케이드" };
export default function Page() {
  return (
    <GameShell slug="rotate">
      <Game />
    </GameShell>
  );
}
