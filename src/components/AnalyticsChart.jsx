import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTheme } from '../context/ThemeContext';

export const AnalyticsChart = ({ data }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs font-mono">
        Chưa có đủ dữ liệu telemetry để hiển thị biểu đồ
      </div>
    );
  }

  const strokeColor = isDark ? '#EF4444' : '#2563EB';
  const gradStart = isDark ? '#EF4444' : '#06B6D4';
  const gradEnd = isDark ? '#7F1D1D' : '#2563EB';

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={gradStart} stopOpacity={isDark ? 0.5 : 0.4} />
              <stop offset="95%" stopColor={gradEnd} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke={isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(148, 163, 184, 0.18)'}
          />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: isDark ? '#A1A1AA' : '#64748B', fontSize: 11, fontFamily: 'monospace' }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: isDark ? '#A1A1AA' : '#64748B', fontSize: 11, fontFamily: 'monospace' }}
            tickFormatter={(value) => `${(value / 1000).toLocaleString()}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? '#08080A' : '#FFFFFF',
              border: isDark ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(37, 99, 235, 0.25)',
              borderRadius: '0.875rem',
              color: isDark ? '#FAFAFA' : '#0F172A',
              fontSize: '12px',
              fontFamily: 'monospace',
              boxShadow: isDark
                ? '0 20px 25px -5px rgba(239, 68, 68, 0.18)'
                : '0 20px 25px -5px rgba(37, 99, 235, 0.12)',
            }}
            formatter={(value) => [`${Number(value).toLocaleString()} ₫`, 'Doanh Thu']}
            labelFormatter={(label) => `Thời gian: ${label}`}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke={strokeColor}
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#colorRev)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
