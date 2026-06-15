import GameShell from "@/components/game-shell";
import Game from "./game";
import { gameMetadata } from "@/lib/games";

export const metadata = gameMetadata("letter-number");

export default function Page() {
  return (
    <GameShell slug="letter-number">
      <Game />
    </GameShell>
  );
}
