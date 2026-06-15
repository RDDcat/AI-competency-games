import GameShell from "@/components/game-shell";
import Game from "./game";
import { gameMetadata } from "@/lib/games";

export const metadata = gameMetadata("number-press");

export default function Page() {
  return (
    <GameShell slug="number-press">
      <Game />
    </GameShell>
  );
}
