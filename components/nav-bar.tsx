import Link from "next/link";
import { LinkButton } from "@/components/ui";
import { LogoMark } from "@/components/logo";
import MobileMenu from "@/components/mobile-menu";

// 카카오 오픈채팅 버그 제보 링크 (실제 링크로 교체 예정)
const BUG_REPORT_URL = "https://open.kakao.com/o/sxwKdIzi";

export default function NavBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline-soft bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-on-dark">
            <LogoMark className="h-5 w-5" />
          </span>
          <span className="text-[17px] font-semibold tracking-[-0.02em] text-ink">
            역검 무제한 연습하기
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <a href="/#games" className="text-sm font-medium text-body hover:text-ink">
            신역검 9종
          </a>
          <a href="/#legacy" className="text-sm font-medium text-body hover:text-ink">
            구버전 게임
          </a>
          <Link
            href="/guide"
            data-ga="guide_click"
            data-ga-source="nav"
            className="text-sm font-medium text-body hover:text-ink"
          >
            공략 가이드
          </Link>
          <Link href="/me" className="text-sm font-medium text-body hover:text-ink">
            내 기록
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <LinkButton
            href={BUG_REPORT_URL}
            variant="secondary"
            className="h-9 px-3"
            aria-label="버그 제보 (카카오 오픈채팅)"
            title="개발자에게 버그 제보하기"
            data-ga="cta_click"
            data-ga-cta-type="openchat"
            data-ga-location="nav"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m8 2 1.88 1.88" />
              <path d="M14.12 3.88 16 2" />
              <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
              <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
              <path d="M12 20v-9" />
              <path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
              <path d="M6 13H2" />
              <path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
              <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
              <path d="M22 13h-4" />
              <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
            </svg>
            <span className="hidden sm:inline">버그 제보</span>
          </LinkButton>
          <LinkButton href="/#games" className="h-9 px-4">
            게임 시작
          </LinkButton>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
