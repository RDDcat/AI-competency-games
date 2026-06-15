import GameShell from "@/components/game-shell";
import Game from "./game";
import { gameMetadata } from "@/lib/games";

export const metadata = gameMetadata("path");

export default function Page() {
  return (
    <GameShell slug="path">
      <Game />
    </GameShell>
  );
}
