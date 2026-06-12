import GameShell from "@/components/game-shell";
import Game from "./game";

export const metadata = { title: "공 옮기기 (하노이의 탑) — 역검 아케이드" };

export default function Page() {
  return (
    <GameShell slug="hanoi">
      <Game />
    </GameShell>
  );
}
