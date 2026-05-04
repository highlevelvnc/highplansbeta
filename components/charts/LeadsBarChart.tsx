'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="bg-[#16161A] border border-[#27272A] rounded-lg px-3 py-2 shadow-lg">
      <div className="text-[10px] text-[#71717A] mb-0.5">{label}</div>
      <div className="text-xs font-bold text-[#A78BFA] tabular-nums">{payload[0].value} leads</div>
    </div>
  )
}

/**
 * Bar chart de leads por período (4 semanas).
 * Extraído + dynamic-importable para isolar recharts do initial bundle.
 */
export default function LeadsBarChart({ data }: { data: Array<{ day: string; count: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} barSize={36}>
        <CartesianGrid vertical={false} stroke="#27272A" strokeDasharray="3 3" />
        <XAxis dataKey="day" tick={{ fill: '#71717A', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis hide allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(139,92,246,0.05)', radius: 4 }} />
        <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} fillOpacity={0.85} />
      </BarChart>
    </ResponsiveContainer>
  )
}
