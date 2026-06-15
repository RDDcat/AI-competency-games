import GameShell from "@/components/game-shell";
import Game from "./game";
import { gameMetadata } from "@/lib/games";

export const metadata = gameMetadata("stroop");

export default function Page() {
  return (
    <GameShell slug="stroop">
      <Game />
    </GameShell>
  );
}
