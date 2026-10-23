/**
 * uPlot-based monthly chart for `cash` and `assets_value` over the run.
 *
 * Spec: openspec/specs/results-display/spec.md — one line per simulated month,
 * reflows on resize, legible at 320px. Delta
 * openspec/changes/rework-style-inkwell/specs/results-display/spec.md — series
 * separable without hue, every drawn element ≥ 3:1 in every theme.
 *
 * uPlot paints to a canvas, which cannot resolve CSS custom properties at
 * paint time. Colors are read off :root with getComputedStyle and handed to
 * uPlot as literals; on a theme change the effect re-runs and restyles the
 * existing plot rather than rebuilding it.
 */

import { useEffect, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import type { MonthResult } from "@/scenario/types";
import { humanize } from "@/ui/labels";

export interface ResultsChartProps {
  months: MonthResult[];
  insolvencyMonth?: number;
  savingBreachMonth?: number;
  terminalMonth?: number;
  /** Current theme mode. Changing it restyles the plot in place. */
  theme?: string;
}

/** Resolve a theme token to the literal uPlot's canvas can paint. */
function token(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

/** assets_value keeps a dash pattern so the series stay separable in
 * grayscale and under dichromatic vision, where hue alone is not enough. */
const ASSETS_DASH = [5, 3];

function heightFor(width: number): number {
  return Math.max(240, Math.min(width * 0.6, 360));
}

export function ResultsChart(props: ResultsChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  // Markers change with the chart props; the draw hook closes over the latest.
  const markers = useRef(props);
  markers.current = props;
  const markerColors = useRef({
    insolvency: "",
    savingBreach: "",
    terminal: "",
  });

  useEffect(() => {
    if (!ref.current) return;

    const stroke = {
      cash: token("--chart-cash"),
      assets: token("--chart-assets"),
      axis: token("--fg-muted"),
      grid: token("--border"),
      insolvency: token("--danger"),
      savingBreach: token("--warning"),
      terminal: token("--accent"),
    };
    markerColors.current = {
      insolvency: stroke.insolvency,
      savingBreach: stroke.savingBreach,
      terminal: stroke.terminal,
    };

    if (plotRef.current) {
      // Theme change: restyle the existing plot and rebuild its Path2D cache.
      const plot = plotRef.current;
      const cash = plot.series[1];
      const assets = plot.series[2];
      if (cash) cash.stroke = stroke.cash;
      if (assets) assets.stroke = stroke.assets;
      for (const axis of plot.axes) {
        axis.stroke = stroke.axis;
        if (axis.grid) axis.grid.stroke = stroke.grid;
        if (axis.ticks) axis.ticks.stroke = stroke.grid;
      }
      plot.setData(buildData(props.months), true);
      plot.redraw(true);
      return;
    }

    const opts: uPlot.Options = {
      width: ref.current.clientWidth,
      height: heightFor(ref.current.clientWidth),
      scales: { x: { time: false } },
      axes: [
        {
          label: "month",
          stroke: stroke.axis,
          grid: { stroke: stroke.grid },
          ticks: { stroke: stroke.grid },
        },
        {
          label: "HKD",
          stroke: stroke.axis,
          grid: { stroke: stroke.grid },
          ticks: { stroke: stroke.grid },
        },
      ],
      series: [
        {},
        { label: humanize("cash"), stroke: stroke.cash, width: 2 },
        {
          label: humanize("assets_value"),
          stroke: stroke.assets,
          width: 2,
          dash: ASSETS_DASH,
        },
      ],
      hooks: {
        draw: [
          (u) => {
            const { insolvencyMonth, savingBreachMonth, terminalMonth } =
              markers.current;
            const colors = markerColors.current;
            drawMarker(u, insolvencyMonth, colors.insolvency);
            drawMarker(u, savingBreachMonth, colors.savingBreach);
            drawMarker(u, terminalMonth, colors.terminal);
          },
        ],
      },
    };
    plotRef.current = new uPlot(opts, buildData(props.months), ref.current);
  }, [
    props.months,
    props.insolvencyMonth,
    props.savingBreachMonth,
    props.terminalMonth,
    props.theme,
  ]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(() => {
      if (plotRef.current) {
        plotRef.current.setSize({
          width: element.clientWidth,
          height: heightFor(element.clientWidth),
        });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      plotRef.current?.destroy();
      plotRef.current = null;
    };
  }, []);

  return <div ref={ref} className="results-chart" data-testid="results-chart" />;
}

function drawMarker(u: uPlot, at: number | undefined, color: string) {
  if (at === undefined) return;
  const xScale = u.scales.x;
  if (!xScale) return;
  const xMin = xScale.min ?? 0;
  const xMax = xScale.max ?? 0;
  if (at < xMin || at > xMax) return;
  const ctx = u.ctx;
  const xPos = u.valToPos(at, "x", true);
  const top = u.bbox.top;
  const bottom = u.bbox.top + u.bbox.height;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(xPos, top);
  ctx.lineTo(xPos, bottom);
  ctx.stroke();
  ctx.restore();
}

export function buildData(months: MonthResult[]): uPlot.AlignedData {
  const xs: number[] = [];
  const cash: number[] = [];
  const assets: number[] = [];
  for (const m of months) {
    xs.push(m.month);
    cash.push(m.cash);
    assets.push(m.assets_value);
  }
  return [xs, cash, assets];
}