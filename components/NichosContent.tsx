'use client'

import { formatCurrency } from '@/lib/utils'
import { Trophy } from 'lucide-react'

type NichoData = { nicho: string; total: number; fechados: number; conversao: number; receita: number; ticketMedio: number }

export default function NichosContent({ ranking }: { ranking: NichoData[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Ranking de Nichos</h1>
        <p className="text-[#6B7280] text-sm mt-1">Performance comercial por segmento de mercado</p>
      </div>

      <div className="card-dark overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[rgba(255,106,0,0.08)]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase">#</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase">Nicho</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase">Total Leads</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase">Fechados</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase">Conversão</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase">Ticket Médio</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase">Receita Total</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((row, i) => (
              <tr key={row.nicho} className="border-b border-[rgba(255,106,0,0.05)] hover:bg-[#1A1A1F]">
                <td className="px-4 py-4">
                  {i < 3 ? (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: ['#FFD700', '#C0C0C0', '#CD7F32'][i] + '20', color: ['#FFD700', '#C0C0C0', '#CD7F32'][i] }}>
                      {i + 1}
                    </div>
                  ) : (
                    <span className="text-[#4B5563] text-sm">{i + 1}</span>
                  )}
                </td>
                <td className="px-4 py-4">
                  <div className="font-medium text-white">{row.nicho}</div>
                </td>
                <td className="px-4 py-4 text-sm text-[#9CA3AF]">{row.total}</td>
                <td className="px-4 py-4 text-sm text-[#9CA3AF]">{row.fechados}</td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[#1A1A1F] rounded-full overflow-hidden w-16">
                      <div className="h-full bg-[#FF6A00] rounded-full" style={{ width: `${row.conversao}%` }} />
                    </div>
                    <span className="text-sm text-white">{row.conversao}%</span>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-[#9CA3AF]">{row.ticketMedio > 0 ? formatCurrency(row.ticketMedio) : '—'}</td>
                <td className="px-4 py-4">
                  <span className="text-sm font-bold text-[#FF6A00]">{row.receita > 0 ? formatCurrency(row.receita) : '—'}</span>
                </td>
              </tr>
            ))}
            {ranking.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-[#4B5563] text-sm">Sem dados de nichos</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
