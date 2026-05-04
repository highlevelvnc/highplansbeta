'use client'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

interface ScoreDataPoint {
  name: string
  value: number
  color: string
}

/**
 * Pie chart de distribuição de score (HOT/WARM/COLD).
 * Extraído como componente separado para permitir dynamic import — recharts
 * é ~100KB e não deve estar no initial bundle de páginas que não o usam.
 */
export default function ScoreDistributionChart({ data }: { data: ScoreDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <PieChart>
        <Pie
          data={data}
          cx="50%" cy="50%"
          innerRadius={42} outerRadius={62}
          dataKey="value"
          paddingAngle={3}
          strokeWidth={0}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: '#16161A', border: '1px solid #27272A', borderRadius: 8, fontSize: 12 }}
          formatter={(v: any, name: any) => [v, name]}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
