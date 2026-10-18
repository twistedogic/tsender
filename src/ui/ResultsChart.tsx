/**
 * uPlot-based monthly chart for `cash` and `assets_value` over the run.
 *
 * Spec: openspec/changes/add-tsender-v01/specs/results-display/spec.md —
 * one line per simulated month, reflows on resize, legible at 320px.
 * Vertical markers for insolvency / saving-breach / terminal months.
 */

import { useEffect, useRef } from "react";
import uPlot from "uplot";
import type { MonthResult } from "@/scenario/types";

export interface ResultsChartProps {
  months: MonthResult[];
  insolvencyMonth?: number;
  savingBreachMonth?: number;
  terminalMonth?: number;
}

export function ResultsChart(props: ResultsChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const data = buildData(props.months);
    const opts: uPlot.Options = {
      width: ref.current.clientWidth,
      height: Math.max(240, Math.min(ref.current.clientWidth * 0.6, 360)),
      scales: { x: { time: false } },
      axes: [
        { label: "month" },
        { label: "HKD" },
      ],
      series: [
        {},
        { label: "cash", stroke: "#0b3a5b", width: 2 },
        { label: "assets_value", stroke: "#777", width: 2, dash: [4, 4] },
      ],
      hooks: {
        draw: [
          (u) => {
            drawMarker(u, props.insolvencyMonth, "#b91c1c");
            drawMarker(u, props.savingBreachMonth, "#d97706");
            drawMarker(u, props.terminalMonth, "#0b3a5b");
          },
        ],
      },
    };
    if (plotRef.current) {
      plotRef.current.setData(data, true);
    } else {
      plotRef.current = new uPlot(opts, data, ref.current);
    }
    const ro = new ResizeObserver(() => {
      if (plotRef.current && ref.current) {
        plotRef.current.setSize({
          width: ref.current.clientWidth,
          height: Math.max(240, Math.min(ref.current.clientWidth * 0.6, 360)),
        });
      }
    });
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
    };
  }, [props.months, props.insolvencyMonth, props.savingBreachMonth, props.terminalMonth]);

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
