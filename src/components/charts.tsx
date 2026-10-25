'use client';

import { useRouter } from 'next/navigation';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMonth, formatShort } from '@/lib/dates';
import { CATEGORY_COLORS, type Category } from '@/lib/types';

type By = 'day' | 'week' | 'month';

const AXIS = '#6d6b88';
const GRID = '#1f1f31';
const TOOLTIP = {
  contentStyle: { background: '#0c0c14', border: '1px solid #3b3b5c', borderRadius: 6, color: '#e9e7f5', fontSize: 12 },
  labelStyle: { color: '#a78bfa' },
  itemStyle: { color: '#e9e7f5' },
  cursor: { fill: 'rgba(139,92,246,0.08)', stroke: '#3b3b5c' },
} as const;

function tick(by: By) {
  return (v: string) => (by === 'month' ? formatMonth(v) : formatShort(v));
}

function Empty() {
  return <div className="empty">No data in this range yet.</div>;
}

export function VolumeChart({
  data,
  by,
}: {
  data: { period: string; sessions: number; push: number; pull: number; legs: number; core: number; skill: number; cardio: number; mobility: number }[];
  by: By;
}) {
  if (data.length === 0) return <Empty />;
  const cats: Category[] = ['push', 'pull', 'legs', 'core', 'skill', 'cardio', 'mobility'];
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="period" tickFormatter={tick(by)} stroke={AXIS} fontSize={11} />
          <YAxis yAxisId="sets" stroke={AXIS} fontSize={11} allowDecimals={false} />
          <YAxis yAxisId="sessions" orientation="right" stroke={AXIS} fontSize={11} allowDecimals={false} />
          <Tooltip {...TOOLTIP} labelFormatter={(l) => (by === 'month' ? formatMonth(String(l)) : `Period of ${formatShort(String(l))}`)} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {cats.map((c) => (
            <Bar key={c} yAxisId="sets" dataKey={c} stackId="sets" fill={CATEGORY_COLORS[c]} name={c} />
          ))}
          <Line yAxisId="sessions" type="monotone" dataKey="sessions" name="workouts" stroke="#ffffff" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendChart({
  data,
  by,
  lines,
  refLine,
  unit = '',
  domainPad = true,
}: {
  data: Record<string, string | number>[];
  by: By;
  lines: { key: string; name: string; color: string }[];
  refLine?: { value: number; label: string };
  unit?: string;
  domainPad?: boolean;
}) {
  if (data.length === 0) return <Empty />;
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="period" tickFormatter={tick(by)} stroke={AXIS} fontSize={11} />
          <YAxis
            stroke={AXIS}
            fontSize={11}
            unit={unit}
            domain={domainPad ? [(min: number) => Math.floor(min * 0.95), (max: number) => Math.ceil(max * 1.05)] : [0, 'auto']}
          />
          <Tooltip {...TOOLTIP} labelFormatter={(l) => (by === 'month' ? formatMonth(String(l)) : formatShort(String(l)))} />
          {lines.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {refLine && (
            <ReferenceLine y={refLine.value} stroke="#d946ef" strokeDasharray="5 4" label={{ value: refLine.label, fill: '#d946ef', fontSize: 11, position: 'insideTopRight' }} />
          )}
          {lines.map((l) => (
            <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={2.4} dot={{ r: 3, fill: l.color }} activeDot={{ r: 5 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function XpChart({ data, by }: { data: { period: string; xp: number }[]; by: By }) {
  if (data.length === 0) return <Empty />;
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="period" tickFormatter={tick(by)} stroke={AXIS} fontSize={11} />
          <YAxis stroke={AXIS} fontSize={11} allowDecimals={false} />
          <Tooltip {...TOOLTIP} labelFormatter={(l) => (by === 'month' ? formatMonth(String(l)) : formatShort(String(l)))} />
          <Bar dataKey="xp" name="XP" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SparkChart({ data }: { data: { period: string; value: number }[] }) {
  if (data.length < 2) return null;
  return (
    <div style={{ height: 36, width: '100%', minWidth: 80 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <Line type="monotone" dataKey="value" stroke="#a78bfa" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ExercisePicker({
  base,
  value,
  options,
}: {
  base: string;
  value: string;
  options: { slug: string; name: string }[];
}) {
  const router = useRouter();
  return (
    <select
      aria-label="Exercise"
      value={value}
      style={{ width: 'auto', minWidth: 200 }}
      onChange={(e) => router.replace(`${base}&ex=${encodeURIComponent(e.target.value)}`, { scroll: false })}
    >
      {options.map((o) => (
        <option key={o.slug} value={o.slug}>
          {o.name}
        </option>
      ))}
    </select>
  );
}
