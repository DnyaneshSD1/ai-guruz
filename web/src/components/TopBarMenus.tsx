"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth, useTheme, type ThemeChoice } from "./Providers";
import { cx } from "./ui";

/** Open/close state for a dropdown that closes on outside click and on Escape. */
function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

const panel = "absolute right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-border bg-bg shadow-lg shadow-black/10";
const item = "flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-sm transition hover:bg-hover";

const themeIcons: Record<ThemeChoice, string> = {
  // sun, moon, monitor
  light: "M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m0-11.4L4.9 4.9m14.2 14.2-1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  dark: "M20 14.5A8.5 8.5 0 0 1 9.5 4 7.5 7.5 0 1 0 20 14.5Z",
  system: "M4 5h16v11H4zM9 20h6m-3-4v4",
};
const themeLabels: Record<ThemeChoice, string> = { light: "Light", dark: "Dark", system: "System" };

function Icon({ d }: { d: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** Theme dropdown for the top-right corner: light, dark, or follow the device. */
export function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  const { open, setOpen, ref } = useDropdown();
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${themeLabels[theme]}`}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border transition hover:bg-hover"
      >
        <Icon d={themeIcons[theme]} />
      </button>
      {open && (
        <div role="menu" className={cx(panel, "w-36 py-1")}>
          {(Object.keys(themeLabels) as ThemeChoice[]).map((choice) => (
            <button
              key={choice}
              role="menuitemradio"
              aria-checked={theme === choice}
              onClick={() => { setTheme(choice); setOpen(false); }}
              className={cx(item, theme === choice && "font-medium")}
            >
              <Icon d={themeIcons[choice]} />
              <span className="flex-1">{themeLabels[choice]}</span>
              {theme === choice && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("");

/** Profile menu for the top-right corner. Renders nothing when signed out. */
export function ProfileMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { open, setOpen, ref } = useDropdown();
  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Profile"
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-fg transition hover:opacity-85"
      >
        {initials(user.name)}
      </button>
      {open && (
        <div role="menu" className={cx(panel, "w-64")}>
          <div className="border-b border-border px-3 py-3">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
            <p className="mt-2 truncate text-xs text-muted">
              <span className="rounded-full border border-border px-2 py-0.5 font-medium">{user.role.toLowerCase()}</span>
              <span className="ml-2">{user.tenantName}</span>
            </p>
          </div>
          <div className="py-1">
            <Link href="/app" role="menuitem" onClick={() => setOpen(false)} className={item}>Home</Link>
            <Link href="/app/settings" role="menuitem" onClick={() => setOpen(false)} className={item}>Profile and settings</Link>
            <button
              role="menuitem"
              onClick={async () => { setOpen(false); await logout(); router.replace("/"); }}
              className={cx(item, "text-danger")}
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Right side of the public header: theme, then the profile menu or the sign-in links. */
export function PublicHeaderActions() {
  const { user, loading } = useAuth();
  return (
    <div className="flex items-center gap-2">
      <ThemeMenu />
      {loading ? (
        <span className="h-9 w-9" />
      ) : user ? (
        <>
          <Link href="/app" className="hidden h-9 items-center rounded-lg border border-border px-3 text-sm hover:bg-hover sm:inline-flex">Open app</Link>
          <ProfileMenu />
        </>
      ) : (
        <>
          <Link href="/login" className="hidden px-2 text-sm hover:underline sm:block">Sign in</Link>
          <Link href="/register" className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg hover:opacity-85">Get started</Link>
        </>
      )}
    </div>
  );
}
