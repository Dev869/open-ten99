import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

/* ── Types ─────────────────────────────────────────── */

interface ChartDataPoint {
  label: string;
  value: number;
}

interface TrendChartProps {
  data: ChartDataPoint[];
  color?: string;
  gradientId: string;
  height?: number;
  valueFormatter?: (v: number) => string;
  showYAxis?: boolean;
}

/* ── Custom Tooltip ────────────────────────────────── */

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  formatter: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 shadow-lg">
      <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-semibold">
        {label}
      </p>
      <p className="text-sm font-extrabold text-[var(--text-primary)] mt-0.5">
        {formatter(payload[0].value)}
      </p>
    </div>
  );
}

/* ── Area Chart ────────────────────────────────────── */

export function TrendChart({
  data,
  color = 'var(--accent)',
  gradientId,
  height = 120,
  valueFormatter = (v) => String(v),
  showYAxis = false,
}: TrendChartProps) {
  // Resolve CSS variable to actual color for SVG gradients
  const resolvedColor = useMemo(() => {
    if (!color.startsWith('var(')) return color;
    const varName = color.replace('var(', '').replace(')', '');
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#4BA8A8';
  }, [color]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: showYAxis ? 0 : -20 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={resolvedColor} stopOpacity={0.3} />
            <stop offset="95%" stopColor={resolvedColor} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: 'var(--text-secondary)', fontFamily: 'inherit' }}
          dy={6}
        />
        {showYAxis && (
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 9, fill: 'var(--text-secondary)', fontFamily: 'inherit' }}
            width={36}
          />
        )}
        <Tooltip
          content={
            <ChartTooltip formatter={valueFormatter} />
          }
          cursor={{ stroke: resolvedColor, strokeWidth: 1, strokeDasharray: '4 4' }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={resolvedColor}
          strokeWidth={2.5}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{
            r: 4,
            fill: resolvedColor,
            stroke: 'var(--bg-card)',
            strokeWidth: 2,
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── Mini Sparkline (for stat cards) ───────────────── */

interface SparklineProps {
  data: number[];
  color?: string;
  gradientId: string;
  height?: number;
}

export function Sparkline({
  data,
  color = 'var(--accent)',
  gradientId,
  height = 40,
}: SparklineProps) {
  const resolvedColor = useMemo(() => {
    if (!color.startsWith('var(')) return color;
    const varName = color.replace('var(', '').replace(')', '');
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#4BA8A8';
  }, [color]);

  const chartData = data.map((value, i) => ({ i, value }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={resolvedColor} stopOpacity={0.25} />
            <stop offset="95%" stopColor={resolvedColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={resolvedColor}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
