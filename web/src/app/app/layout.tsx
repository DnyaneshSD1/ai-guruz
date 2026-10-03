"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/components/Providers";
import { ProfileMenu, ThemeMenu } from "@/components/TopBarMenus";
import { Loading, cx } from "@/components/ui";
import type { Role } from "@/lib/types";

// roles: who sees the item. The backend enforces the same rules; hiding links is only for clarity.
const nav: { href: string; label: string; roles?: Role[] }[] = [
  { href: "/app", label: "Home" },
  { href: "/app/learn", label: "Learn" },
  { href: "/app/documents", label: "Documents" },
  { href: "/app/knowledge", label: "Knowledge graph" },
  { href: "/app/analytics", label: "Analytics" },
  { href: "/app/admin/users", label: "Users", roles: ["ADMIN"] },
  { href: "/app/admin/audit", label: "Audit log", roles: ["ADMIN"] },
  { href: "/app/settings", label: "Settings" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => setMenuOpen(false), [pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loading />
      </div>
    );
  }

  const items = nav.filter((item) => !item.roles || item.roles.includes(user.role));
  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));

  return (
    <div className="min-h-dvh">
      {/* Top bar: logo (home) on the left; theme and profile on the right. */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur md:px-5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label="Menu"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border md:hidden"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <Logo href="/app" />
        </div>
        <div className="flex items-center gap-2">
          <ThemeMenu />
          <ProfileMenu />
        </div>
      </header>

      <div className="md:grid md:grid-cols-[224px_1fr]">
        <aside
          className={cx(
            "border-border bg-bg md:sticky md:top-14 md:block md:h-[calc(100dvh-3.5rem)] md:border-r",
            menuOpen ? "fixed inset-x-0 bottom-0 top-14 z-10 overflow-y-auto" : "hidden",
          )}
        >
          <nav className="space-y-0.5 p-3">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cx(
                  "block rounded-lg px-3 py-2 text-sm transition",
                  isActive(item.href) ? "bg-primary font-medium text-primary-fg" : "text-muted hover:bg-hover hover:text-fg",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 px-4 py-6 md:px-10 md:py-10">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
