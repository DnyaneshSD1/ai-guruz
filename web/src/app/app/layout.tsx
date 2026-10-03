"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/Providers";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge, Loading, cx } from "@/components/ui";
import { site } from "@/content/site";
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
  const { user, loading, logout } = useAuth();
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
    <div className="md:grid md:min-h-dvh md:grid-cols-[232px_1fr]">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-bg px-4 md:hidden">
        <Link href="/app" className="font-semibold tracking-tight">{site.product}</Link>
        <button onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-sm">
          Menu
        </button>
      </header>

      <aside
        className={cx(
          "border-border bg-bg md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:border-r",
          menuOpen ? "fixed inset-x-0 top-14 bottom-0 z-10 flex flex-col overflow-y-auto border-b" : "hidden",
        )}
      >
        <Link href="/app" className="hidden h-14 items-center px-5 font-semibold tracking-tight md:flex">{site.product}</Link>
        <nav className="flex-1 space-y-0.5 p-3">
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
        <div className="space-y-3 border-t border-border p-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.tenantName}</p>
            <div className="mt-2"><Badge>{user.role.toLowerCase()}</Badge></div>
          </div>
          <ThemeToggle />
          <button
            onClick={async () => { await logout(); router.replace("/"); }}
            className="block cursor-pointer text-sm text-muted hover:text-fg"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 px-4 py-6 md:px-10 md:py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
