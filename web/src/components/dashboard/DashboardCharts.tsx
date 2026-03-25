import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
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

/* ── Pie Tooltip ──────────────────────────────────── */

function PieTooltip({
  active,
  payload,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
  formatter: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 shadow-lg">
      <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-semibold">
        {payload[0].name}
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
      <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: showYAxis ? 0 : -20 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={resolvedColor} stopOpacity={0.3} />
            <stop offset="95%" stopColor={resolvedColor} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid horizontal={false} vertical={false} />
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
          stroke="none"
          fill={`url(#${gradientId})`}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={resolvedColor}
          strokeWidth={2.5}
          dot={false}
          activeDot={{
            r: 4,
            fill: resolvedColor,
            stroke: 'var(--bg-card)',
            strokeWidth: 2,
          }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ── Donut Chart ──────────────────────────────────── */

interface DonutChartDataPoint {
  name: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutChartDataPoint[];
  size?: number;
  innerRadius?: number;
  outerRadius?: number;
  showCenterLabel?: boolean;
  centerLabel?: string;
  centerValue?: string;
  valueFormatter?: (v: number) => string;
}

export function DonutChart({
  data,
  size = 160,
  innerRadius = 0.58,
  outerRadius = 0.88,
  showCenterLabel = false,
  centerLabel,
  centerValue,
  valueFormatter = (v) => String(v),
}: DonutChartProps) {
  const computedInnerRadius = (size / 2) * innerRadius;
  const computedOuterRadius = (size / 2) * outerRadius;
  const resolvedColors = useMemo(() => {
    return data.map((d) => {
      if (!d.color.startsWith('var(')) return d.color;
      const varName = d.color.replace('var(', '').replace(')', '');
      return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || d.color;
    });
  }, [data]);

  const nonZeroData = data.filter((d) => d.value > 0);
  const nonZeroColors = data.reduce<string[]>((acc, d, i) => {
    if (d.value > 0) acc.push(resolvedColors[i]);
    return acc;
  }, []);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          {/* Background track ring */}
          <Pie
            data={[{ name: 'bg', value: 1 }]}
            dataKey="value"
            cx="50%"
            cy="50%"
            innerRadius={computedInnerRadius}
            outerRadius={computedOuterRadius}
            strokeWidth={0}
            isAnimationActive={false}
          >
            <Cell fill="var(--bg-input)" />
          </Pie>
          {/* Data segments */}
          <Pie
            data={nonZeroData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={computedInnerRadius}
            outerRadius={computedOuterRadius}
            paddingAngle={nonZeroData.length > 1 ? 3 : 0}
            strokeWidth={0}
            cornerRadius={4}
          >
            {nonZeroData.map((_, i) => (
              <Cell key={i} fill={nonZeroColors[i]} />
            ))}
          </Pie>
          <Tooltip
            content={<PieTooltip formatter={valueFormatter} />}
            wrapperStyle={{ zIndex: 10, pointerEvents: 'none' }}
            offset={20}
            allowEscapeViewBox={{ x: true, y: true }}
          />
        </PieChart>
      </ResponsiveContainer>
      {showCenterLabel && (centerValue || centerLabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {centerValue && (
            <span
              className="font-extrabold text-[var(--text-primary)] leading-tight"
              style={{ fontSize: size * 0.14 }}
            >
              {centerValue}
            </span>
          )}
          {centerLabel && (
            <span
              className="uppercase tracking-wider text-[var(--text-secondary)] font-semibold"
              style={{ fontSize: Math.max(8, size * 0.065) }}
            >
              {centerLabel}
            </span>
          )}
        </div>
      )}
    </div>
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

/* ── Vertical Bar Chart ───────────────────────────── */

interface VerticalBarChartDataPoint {
  label: string;
  value: number;
}

interface VerticalBarChartProps {
  data: VerticalBarChartDataPoint[];
  color?: string;
  gradientId: string;
  height?: number;
  valueFormatter?: (v: number) => string;
  showYAxis?: boolean;
  barRadius?: number;
}

export function VerticalBarChart({
  data,
  color = 'var(--accent)',
  gradientId,
  height = 160,
  valueFormatter = (v) => String(v),
  showYAxis = false,
  barRadius = 6,
}: VerticalBarChartProps) {
  const resolvedColor = useMemo(() => {
    if (!color.startsWith('var(')) return color;
    const varName = color.replace('var(', '').replace(')', '');
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#4BA8A8';
  }, [color]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: showYAxis ? 0 : -20 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={resolvedColor} stopOpacity={0.9} />
            <stop offset="95%" stopColor={resolvedColor} stopOpacity={0.4} />
          </linearGradient>
        </defs>
        <CartesianGrid horizontal={false} vertical={false} />
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
          content={<ChartTooltip formatter={valueFormatter} />}
          cursor={{ fill: resolvedColor, fillOpacity: 0.08 }}
        />
        <Bar
          dataKey="value"
          fill={`url(#${gradientId})`}
          radius={[barRadius, barRadius, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
