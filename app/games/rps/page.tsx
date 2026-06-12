import GameShell from "@/components/game-shell";
import Game from "./game";
export const metadata = { title: "가위바위보 — 역검 아케이드" };
export default function Page() {
  return (
    <GameShell slug="rps">
      <Game />
    </GameShell>
  );
}
