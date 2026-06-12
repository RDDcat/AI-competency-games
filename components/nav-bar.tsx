import Link from "next/link";
import { LinkButton } from "@/components/ui";

export default function NavBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline-soft bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-on-dark">
            역
          </span>
          <span className="text-[17px] font-semibold tracking-[-0.02em] text-ink">
            역검 아케이드
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/#games" className="text-sm font-medium text-body hover:text-ink">
            신역검 9종
          </Link>
          <Link href="/#legacy" className="text-sm font-medium text-body hover:text-ink">
            구버전 게임
          </Link>
          <Link href="/#about" className="text-sm font-medium text-body hover:text-ink">
            이 사이트는
          </Link>
        </nav>

        <LinkButton href="/#games" className="h-9 px-4">
          게임 시작
        </LinkButton>
      </div>
    </header>
  );
}
