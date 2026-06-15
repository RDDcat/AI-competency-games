import GameShell from "@/components/game-shell";
import Game from "./game";
import { gameMetadata } from "@/lib/games";

export const metadata = gameMetadata("potion");

export default function Page() {
  return (
    <GameShell slug="potion">
      <Game />
    </GameShell>
  );
}
