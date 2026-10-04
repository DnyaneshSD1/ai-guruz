"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "./ui";

/** Series colours in their fixed order (defined per theme in globals.css). Never reorder or cycle them. */
export const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];

export interface Slice {
  label: string;
  value: number;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

/** The same numbers as the chart, for screen readers and anyone who prefers a table. */
export function DataTable({ columns, rows }: { columns: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-3 text-xs text-muted">
      <summary className="cursor-pointer select-none hover:text-fg">Show data</summary>
      <table className="mt-2 w-full tabular-nums">
        <thead>
          <tr>{columns.map((column) => <th key={column} className="py-1 text-left font-normal">{column}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border text-fg">
          {rows.map((row, index) => (
            <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="py-1">{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export function NoData({ children = "No data in this period yet." }: { children?: React.ReactNode }) {
  return <p className="flex h-40 items-center justify-center text-sm text-muted">{children}</p>;
}

/**
 * Part-to-whole at a glance, for a handful of segments. Every value is also written in the legend,
 * so nothing depends on telling colours apart or on hovering.
 */
export function Donut({ slices, unit }: { slices: Slice[]; unit: string }) {
  const [active, setActive] = useState<number | null>(null);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (total === 0) return <NoData />;

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const gap = slices.filter((slice) => slice.value > 0).length > 1 ? 2 : 0; // surface gap between segments
  let offset = 0;
  const arcs = slices.map((slice, index) => {
    const length = (slice.value / total) * circumference;
    const arc = { index, length: Math.max(0, length - gap), offset };
    offset += length;
    return arc;
  });
  const shown = active == null ? null : slices[active];

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 120 120" className="h-40 w-40 shrink-0" role="img" aria-label={`${unit}: ${slices.map((s) => `${s.label} ${s.value}`).join(", ")}`}>
        <g transform="rotate(-90 60 60)">
          {arcs.map((arc) =>
            slices[arc.index].value > 0 ? (
              <circle
                key={arc.index}
                cx="60" cy="60" r={radius} fill="none"
                stroke={SERIES[arc.index]}
                strokeWidth={active === arc.index ? 17 : 14}
                strokeDasharray={`${arc.length} ${circumference - arc.length}`}
                strokeDashoffset={-arc.offset}
                opacity={active == null || active === arc.index ? 1 : 0.35}
                className="transition-all"
                onPointerEnter={() => setActive(arc.index)}
                onPointerLeave={() => setActive(null)}
              />
            ) : null,
          )}
        </g>
        <text x="60" y="58" textAnchor="middle" fill="var(--fg)" fontSize="20" fontWeight="600">{shown ? shown.value : total}</text>
        <text x="60" y="73" textAnchor="middle" fill="var(--muted)" fontSize="8">
          {shown ? `${Math.round((shown.value / total) * 100)}% of ${unit}` : unit}
        </text>
      </svg>
      <ul className="min-w-40 flex-1 space-y-1 text-sm">
        {slices.map((slice, index) => (
          <li
            key={slice.label}
            tabIndex={0}
            onPointerEnter={() => setActive(index)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(index)}
            onBlur={() => setActive(null)}
            className={cx("flex items-center gap-2 rounded-md px-1.5 py-1 outline-none transition", active === index && "bg-hover")}
          >
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: SERIES[index] }} />
            <span className="flex-1">{slice.label}</span>
            <span className="font-medium tabular-nums">{slice.value}</span>
            <span className="w-10 text-right tabular-nums text-muted">{Math.round((slice.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const PLOT = { top: 12, right: 14, bottom: 22, left: 34, height: 180 };

/** One series over time on a 0-100% scale, with a crosshair that snaps to the nearest day. */
export function TrendLine({ points, label }: { points: { date: string; value: number }[]; label: string }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  if (points.length === 0) return <NoData />;

  const innerWidth = Math.max(0, width - PLOT.left - PLOT.right);
  const innerHeight = PLOT.height - PLOT.top - PLOT.bottom;
  const x = (index: number) => PLOT.left + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
  const y = (value: number) => PLOT.top + (1 - value) * innerHeight;
  const line = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)} ${y(point.value).toFixed(1)}`).join(" ");
  const last = points.length - 1;
  const shown = active ?? last;

  function track(event: React.PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = innerWidth ? (event.clientX - bounds.left - PLOT.left) / innerWidth : 0;
    setActive(Math.max(0, Math.min(last, Math.round(ratio * last))));
  }

  return (
    <div ref={ref}>
      <div className="mb-1 flex items-baseline justify-between text-xs text-muted">
        <span>{label}</span>
        <span>
          <span className="font-medium text-fg tabular-nums">{Math.round(points[shown].value * 100)}%</span> on {points[shown].date}
        </span>
      </div>
      {width > 0 && (
        <svg width={width} height={PLOT.height} role="img" aria-label={`${label} over time`} onPointerMove={track} onPointerLeave={() => setActive(null)} className="touch-none">
          {[0, 0.5, 1].map((tick) => (
            <g key={tick}>
              <line x1={PLOT.left} x2={width - PLOT.right} y1={y(tick)} y2={y(tick)} stroke="var(--border)" />
              <text x={PLOT.left - 8} y={y(tick) + 3} textAnchor="end" fontSize="10" fill="var(--muted)">{tick * 100}%</text>
            </g>
          ))}
          {points.length > 1 && (
            <>
              <path d={`${line} L${x(last)} ${y(0)} L${x(0)} ${y(0)} Z`} fill="var(--series-1)" opacity="0.1" />
              <path d={line} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </>
          )}
          {active != null && <line x1={x(active)} x2={x(active)} y1={PLOT.top} y2={y(0)} stroke="var(--muted)" />}
          <circle cx={x(shown)} cy={y(points[shown].value)} r="4" fill="var(--series-1)" stroke="var(--card)" strokeWidth="2" />
          <text x={PLOT.left} y={PLOT.height - 6} fontSize="10" fill="var(--muted)">{points[0].date}</text>
          {points.length > 1 && (
            <text x={width - PLOT.right} y={PLOT.height - 6} textAnchor="end" fontSize="10" fill="var(--muted)">{points[last].date}</text>
          )}
        </svg>
      )}
      <DataTable columns={["Date", label]} rows={points.map((point) => [point.date, `${Math.round(point.value * 100)}%`])} />
    </div>
  );
}

/** Magnitude per category: thin columns from one baseline, the count written on each cap. */
export function Columns({ bars, unit }: { bars: Slice[]; unit: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...bars.map((bar) => bar.value));
  if (max === 0) return <NoData />;
  return (
    <div>
      <div className="flex h-40 items-end gap-3 border-b border-border" role="img" aria-label={`${unit}: ${bars.map((b) => `${b.label} ${b.value}`).join(", ")}`}>
        {bars.map((bar, index) => (
          <div
            key={bar.label}
            className="flex h-full flex-1 flex-col items-center justify-end"
            onPointerEnter={() => setActive(index)}
            onPointerLeave={() => setActive(null)}
          >
            <span className="mb-1 text-xs tabular-nums">{bar.value}</span>
            <div
              className="w-full max-w-6 rounded-t transition-opacity"
              style={{ height: `${(bar.value / max) * 80}%`, minHeight: bar.value ? 3 : 0, background: "var(--series-1)", opacity: active == null || active === index ? 1 : 0.45 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-3">
        {bars.map((bar) => <span key={bar.label} className="flex-1 text-center text-[11px] text-muted">{bar.label}</span>)}
      </div>
    </div>
  );
}

/** Magnitude per category with long names: horizontal bars, the count at the tip. */
export function Rows({ bars }: { bars: Slice[] }) {
  const max = Math.max(...bars.map((bar) => bar.value));
  if (max === 0) return <NoData />;
  return (
    <div className="space-y-3">
      {bars.map((bar) => (
        <div key={bar.label} className="grid grid-cols-[110px_1fr] items-center gap-3 text-sm">
          <span className="truncate">{bar.label}</span>
          <div className="flex items-center gap-2">
            <div className="h-3 rounded-r" style={{ width: `${(bar.value / max) * 85}%`, minWidth: bar.value ? 3 : 0, background: "var(--series-1)" }} />
            <span className="text-xs tabular-nums text-muted">{bar.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
