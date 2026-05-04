'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const COLORS = ['#8B5CF6', '#A78BFA', '#F59E0B', '#8B5CF6', '#3B82F6', '#10B981', '#71717A']

/** Bar chart de receita por nicho. Lazy-importable. */
export default function RevenueByNichoChart({ data }: { data: Array<{ nicho: string; receita: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} barSize={36}>
        <XAxis dataKey="nicho" tick={{ fill: '#71717A', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip
          contentStyle={{ background: '#16161A', border: '1px solid #27272A', borderRadius: 8, color: '#F0F0F3', fontSize: 12 }}
          formatter={(v: any) => [`€${v}`, 'Receita']}
        />
        <Bar dataKey="receita" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
