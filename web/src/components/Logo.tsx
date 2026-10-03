import Link from "next/link";
import { site } from "@/content/site";

/**
 * The AI Guruz mark: a letter G drawn as a learning path. The path starts at one node (where the
 * learner begins), travels round, and turns inward to end on a second node at the centre (mastery).
 * It uses currentColor, so it follows the light and dark themes.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M23.8 8.2A11 11 0 1 0 27 16H16" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="23.8" cy="8.2" r="2.7" fill="currentColor" />
      <circle cx="16" cy="16" r="2.7" fill="currentColor" />
    </svg>
  );
}

/** Mark plus wordmark, linking home. */
export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} aria-label={`${site.product} home`} className="flex items-center gap-2 rounded-md">
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-tight">
        <span className="text-muted">AI</span> Guruz
      </span>
    </Link>
  );
}
