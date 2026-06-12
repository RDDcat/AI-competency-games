import GameShell from "@/components/game-shell";
import Game from "./game";
export const metadata = { title: "마법약 만들기 — 역검 아케이드" };
export default function Page() {
  return (
    <GameShell slug="potion">
      <Game />
    </GameShell>
  );
}
