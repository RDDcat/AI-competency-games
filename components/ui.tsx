import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

const BUTTON_BASE =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:bg-surface-strong disabled:text-muted";

const VARIANT = {
  primary: `${BUTTON_BASE} bg-primary text-on-dark active:bg-primary-active`,
  secondary: `${BUTTON_BASE} border border-hairline bg-canvas text-ink active:bg-surface-soft`,
} as const;

type Variant = keyof typeof VARIANT;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${VARIANT[variant]} ${className}`} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className = "",
  href,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; href: string }) {
  if (href.startsWith("http")) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${VARIANT[variant]} ${className}`}
        {...props}
      />
    );
  }
  return <Link href={href} className={`${VARIANT[variant]} ${className}`} {...props} />;
}

export function Badge({
  tone = "bg-surface-card text-ink",
  children,
}: {
  tone?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[13px] font-medium ${tone}`}
    >
      {children}
    </span>
  );
}

/** 키보드 키 표시용 칩 */
export function KeyCap({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-hairline bg-canvas px-2 font-sans text-[13px] font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      {children}
    </kbd>
  );
}
