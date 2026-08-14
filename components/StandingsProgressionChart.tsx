"use client";

import { useEffect, useRef, useState } from "react";
import type { ConstructorProgression } from "@/lib/aggregate";

// Validated default categorical palette (8 hues, fixed order — see the
// dataviz skill's references/palette.md). This exact order clears the
// adjacent-pair colorblind-safety gate in both light and dark mode, which
// is why series are always colored by this array index, never a generated
// hue: past 8 series, additional constructors are omitted from the chart
// (with a note) rather than assigned a 9th color.
const PALETTE_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const PALETTE_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
const MAX_SERIES = PALETTE_LIGHT.length;

const CHROME = {
  grid: { light: "#e1e0d9", dark: "#2c2c2a" },
  baseline: { light: "#c3c2b7", dark: "#383835" },
  inkPrimary: { light: "#0b0b0b", dark: "#ffffff" },
  inkSecondary: { light: "#52514e", dark: "#c3c2b7" },
  inkMuted: { light: "#898781", dark: "#898781" },
  surface: { light: "#fcfcfb", dark: "#1a1a19" },
};

const WIDTH = 720;
const HEIGHT = 340;
const PADDING = { top: 16, right: 16, bottom: 32, leftDirectLabels: 116 };
const MIN_LABEL_GAP = 13;

/** Tracks whether <html> currently carries the `.dark` class (see
 * app/globals.css's `@custom-variant dark` and the theme-init script in
 * app/layout.tsx). Reacts live to ThemeToggle's class changes via a
 * MutationObserver, rather than only reading it once on mount. */
function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

/** Rounds a max value up to a "nice" axis ceiling (1/2/5 x 10^n) targeting ~5 gridlines. */
function niceStep(maxValue: number, targetTicks = 5): number {
  if (maxValue <= 0) return 10;
  const roughStep = maxValue / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const residual = roughStep / magnitude;
  const niceResidual = residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1;
  return niceResidual * magnitude;
}

/** Pushes colliding direct end-labels apart vertically (never sideways),
 * cascading from the closest-together pair outward — see
 * marks-and-anatomy.md's "when end-labels collide, don't stack them"
 * (this is the "nudge apart" resolution, appropriate for the small,
 * ≤4-series case direct labels are limited to). */
function spreadLabelPositions(rawY: number[], minGap: number, top: number, bottom: number): number[] {
  const order = rawY.map((_, i) => i).sort((a, b) => rawY[a] - rawY[b]);
  const adjusted = [...rawY];

  for (let k = 1; k < order.length; k++) {
    const prev = order[k - 1];
    const cur = order[k];
    if (adjusted[cur] - adjusted[prev] < minGap) adjusted[cur] = adjusted[prev] + minGap;
  }
  const lastIdx = order[order.length - 1];
  if (adjusted[lastIdx] > bottom) {
    adjusted[lastIdx] = bottom;
    for (let k = order.length - 2; k >= 0; k--) {
      const next = order[k + 1];
      const cur = order[k];
      if (adjusted[next] - adjusted[cur] < minGap) adjusted[cur] = adjusted[next] - minGap;
    }
  }
  if (order.length > 0) adjusted[order[0]] = Math.max(adjusted[order[0]], top);

  return adjusted;
}

/** Cumulative constructor points by round for a season — a line per
 * constructor (top 8 by final points; the palette's validated categorical
 * count), with a hover crosshair + tooltip, a legend, direct end-labels
 * when there are few enough series to place them, and a table fallback so
 * every value is reachable without hovering.
 *
 * `officialFinalPointsById` (from the season's real getConstructorStandings
 * — the same data the "Final Constructor Standings" table on the same page
 * renders) is optional, purely for a discrepancy check: this chart's totals
 * are a raw sum of every round's results, but many pre-1991 F1 seasons only
 * counted each constructor's *best N* results toward the championship,
 * dropping the rest — so a raw sum can legitimately disagree with the
 * official total for those years. Rather than hardcode which years that
 * applies to, it's detected live by comparing against the real standings
 * whenever they're passed in, and surfaced as a note instead of silently
 * showing a number that looks official but doesn't match the table above. */
export default function StandingsProgressionChart({
  progression,
  officialFinalPointsById,
}: {
  progression: ConstructorProgression;
  officialFinalPointsById?: Map<string, number>;
}) {
  const isDark = useIsDarkMode();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { rounds, series } = progression;
  const shown = series.slice(0, MAX_SERIES);
  const hiddenCount = series.length - shown.length;
  const directLabels = shown.length <= 4;
  const padding = { ...PADDING, left: directLabels ? PADDING.leftDirectLabels : 48 };

  const palette = isDark ? PALETTE_DARK : PALETTE_LIGHT;
  const color = (role: keyof typeof CHROME) => CHROME[role][isDark ? "dark" : "light"];

  if (rounds.length === 0 || shown.length === 0) return null;

  const hasScoringRuleDiscrepancy = shown.some((s) => {
    const official = officialFinalPointsById?.get(s.constructorId);
    return official !== undefined && official !== s.finalPoints;
  });

  const plotWidth = WIDTH - padding.left - padding.right;
  const plotHeight = HEIGHT - padding.top - padding.bottom;
  const xStep = rounds.length > 1 ? plotWidth / (rounds.length - 1) : 0;
  const x = (i: number) => padding.left + i * xStep;

  const maxValue = Math.max(1, ...shown.map((s) => Math.max(...s.points)));
  const step = niceStep(maxValue);
  const axisMax = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= axisMax; t += step) ticks.push(t);
  const y = (v: number) => padding.top + plotHeight - (v / axisMax) * plotHeight;

  const xTickEvery = Math.max(1, Math.ceil(rounds.length / 10));

  const rawLabelY = shown.map((s) => y(s.points[s.points.length - 1] ?? 0));
  const labelY = directLabels ? spreadLabelPositions(rawLabelY, MIN_LABEL_GAP, padding.top, HEIGHT - padding.bottom) : rawLabelY;

  function handlePointerMove(e: React.PointerEvent<SVGRectElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const svgPoint = pt.matrixTransform(ctm.inverse());
    const index = Math.round((svgPoint.x - padding.left) / (xStep || 1));
    setHoverIndex(Math.min(rounds.length - 1, Math.max(0, index)));
  }

  const hovered = hoverIndex !== null ? rounds[hoverIndex] : null;
  const hoveredRows =
    hoverIndex !== null
      ? shown
          .map((s, i) => ({ name: s.name, value: s.points[hoverIndex], color: palette[i] }))
          .sort((a, b) => b.value - a.value)
      : [];
  const tooltipWidth = 172;
  const tooltipHeight = 20 + hoveredRows.length * 15 + 10;
  const tooltipFlipped = hoverIndex !== null && x(hoverIndex) + 12 + tooltipWidth > WIDTH - padding.right;
  const tooltipX = hoverIndex !== null ? (tooltipFlipped ? x(hoverIndex) - 12 - tooltipWidth : x(hoverIndex) + 12) : 0;

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Cumulative constructor points by round across ${rounds.length} rounds`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padding.left} x2={WIDTH - padding.right} y1={y(t)} y2={y(t)} stroke={color("grid")} strokeWidth={1} />
            <text x={padding.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill={color("inkMuted")}>
              {t.toLocaleString()}
            </text>
          </g>
        ))}
        <line
          x1={padding.left}
          x2={WIDTH - padding.right}
          y1={HEIGHT - padding.bottom}
          y2={HEIGHT - padding.bottom}
          stroke={color("baseline")}
          strokeWidth={1}
        />
        {rounds.map((r, i) =>
          i % xTickEvery === 0 || i === rounds.length - 1 ? (
            <text
              key={r.round}
              x={x(i)}
              y={HEIGHT - padding.bottom + 16}
              textAnchor="middle"
              fontSize={10}
              fill={color("inkMuted")}
            >
              {r.round}
            </text>
          ) : null,
        )}

        {shown.map((s, i) => {
          const d = s.points.map((v, j) => `${j === 0 ? "M" : "L"} ${x(j)} ${y(v)}`).join(" ");
          const lastIndex = s.points.length - 1;
          return (
            <g key={s.constructorId}>
              <path d={d} fill="none" stroke={palette[i]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={x(lastIndex)} cy={y(s.points[lastIndex])} r={4} fill={palette[i]} stroke={color("surface")} strokeWidth={2} />
              {directLabels && (
                <text x={x(lastIndex) + 8} y={labelY[i]} dominantBaseline="middle" fontSize={11} fill={color("inkSecondary")}>
                  {s.name}
                </text>
              )}
            </g>
          );
        })}

        {hoverIndex !== null && (
          <>
            <line
              x1={x(hoverIndex)}
              x2={x(hoverIndex)}
              y1={padding.top}
              y2={HEIGHT - padding.bottom}
              stroke={color("baseline")}
              strokeWidth={1}
            />
            <g>
              <rect
                x={tooltipX}
                y={padding.top}
                width={tooltipWidth}
                height={tooltipHeight}
                rx={6}
                fill={color("surface")}
                stroke={color("baseline")}
                strokeWidth={1}
              />
              <text x={tooltipX + 10} y={padding.top + 16} fontSize={11} fontWeight={600} fill={color("inkPrimary")}>
                {hovered ? `R${hovered.round} · ${hovered.raceName}` : ""}
              </text>
              {hoveredRows.map((row, i) => (
                <g key={row.name}>
                  <line
                    x1={tooltipX + 10}
                    x2={tooltipX + 20}
                    y1={padding.top + 30 + i * 15}
                    y2={padding.top + 30 + i * 15}
                    stroke={row.color}
                    strokeWidth={2}
                  />
                  <text x={tooltipX + 26} y={padding.top + 34 + i * 15} fontSize={10} fill={color("inkSecondary")}>
                    {row.name}
                  </text>
                  <text
                    x={tooltipX + tooltipWidth - 10}
                    y={padding.top + 34 + i * 15}
                    textAnchor="end"
                    fontSize={10}
                    fontWeight={600}
                    fill={color("inkPrimary")}
                  >
                    {row.value}
                  </text>
                </g>
              ))}
            </g>
          </>
        )}

        <rect
          x={padding.left}
          y={padding.top}
          width={plotWidth}
          height={plotHeight}
          fill="transparent"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverIndex(null)}
        />
      </svg>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {shown.map((s, i) => (
          <div key={s.constructorId} className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
            <span className="inline-block h-0.5 w-3 rounded-full" style={{ backgroundColor: palette[i] }} aria-hidden />
            {s.name}
          </div>
        ))}
      </div>
      {hiddenCount > 0 && (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
          +{hiddenCount} more constructor{hiddenCount === 1 ? "" : "s"} not charted — see the standings above.
        </p>
      )}
      {hasScoringRuleDiscrepancy && (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
          Totals here are a raw sum of every round&apos;s points, which can differ from the official standings above
          for seasons that only counted a constructor&apos;s best results toward the championship.
        </p>
      )}

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white">
          View as table
        </summary>
        <div className="mt-2 overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-black/[.03] text-xs uppercase tracking-wide text-zinc-500 dark:bg-white/[.05] dark:text-zinc-400">
              <tr>
                <th className="px-3 py-2">Round</th>
                {shown.map((s) => (
                  <th key={s.constructorId} className="px-3 py-2 text-right">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {rounds.map((r, i) => (
                <tr key={r.round}>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                    R{r.round} · {r.raceName}
                  </td>
                  {shown.map((s) => (
                    <td key={s.constructorId} className="px-3 py-2 text-right">
                      {s.points[i]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
