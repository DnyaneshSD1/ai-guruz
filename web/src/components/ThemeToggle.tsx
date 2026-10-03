"use client";

import { useTheme, type ThemeChoice } from "./Providers";
import { cx } from "./ui";

const options: { id: ThemeChoice; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className={cx("inline-flex rounded-lg border border-border p-0.5", className)}>
      {options.map((option) => (
        <button
          key={option.id}
          role="radio"
          aria-checked={theme === option.id}
          onClick={() => setTheme(option.id)}
          className={cx(
            "cursor-pointer rounded-md px-2.5 py-1 text-xs transition",
            theme === option.id ? "bg-primary text-primary-fg" : "text-muted hover:text-fg",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
