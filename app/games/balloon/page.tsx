import GameShell from "@/components/game-shell";
import Game from "./game";
import { gameMetadata } from "@/lib/games";

export const metadata = gameMetadata("balloon");

export default function Page() {
  return (
    <GameShell slug="balloon">
      <Game />
    </GameShell>
  );
}
