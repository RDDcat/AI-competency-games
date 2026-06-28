"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** 모바일 헤더 메뉴 항목 — 데스크톱 nav 와 동일 구성 */
const LINKS = [
  { href: "/#games", label: "신역검 9종" },
  { href: "/#legacy", label: "구버전 게임" },
  { href: "/guide", label: "공략 가이드" },
  { href: "/me", label: "내 기록" },
];

export default function MobileMenu() {
  const [open, setOpen] = useState(false);

  // ESC 로 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
        aria-expanded={open}
        aria-controls="mobile-menu-panel"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-hairline bg-canvas text-ink active:bg-surface-soft"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {open ? (
            <>
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </>
          ) : (
            <>
              <path d="M3 6h18" />
              <path d="M3 12h18" />
              <path d="M3 18h18" />
            </>
          )}
        </svg>
      </button>

      {open && (
        <>
          {/* 바깥 클릭 시 닫기 */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={close}
            className="fixed inset-0 top-16 z-30 cursor-default bg-black/20"
          />
          {/* 드롭다운 패널 */}
          <nav
            id="mobile-menu-panel"
            className="absolute inset-x-0 top-16 z-40 border-b border-hairline-soft bg-canvas px-6 py-3 shadow-elevated"
          >
            <ul className="flex flex-col divide-y divide-hairline-soft">
              {LINKS.map((l) => {
                const isHash =
                  l.href.startsWith("#") || l.href.startsWith("/#");
                const cls =
                  "block py-3.5 text-[15px] font-medium text-body active:text-ink";
                return (
                  <li key={l.href}>
                    {isHash ? (
                      <a href={l.href} onClick={close} className={cls}>
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} onClick={close} className={cls}>
                        {l.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
        </>
      )}
    </div>
  );
}
