'use client'
import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function NichosPage() {
  const [data, setData] = useState<any[]>([])
  useEffect(()=>{fetch('/api/nichos').then(r=>r.json()).then(setData)},[])

  const COLORS = ['#FF6A00','#FF7F1A','#F59E0B','#8B5CF6','#3B82F6','#10B981','#6B6B7B']

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#F5F5F7]">Ranking de Nichos</h1>
        <p className="text-sm text-[#6B6B7B]">Performance comercial por sector</p>
      </div>

      {data.length > 0 && (
        <div className="bg-[#111114] border border-[#2A2A32] rounded-xl p-4 mb-5">
          <div className="text-xs text-[#6B6B7B] uppercase tracking-wider mb-4">Receita por Nicho</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} barSize={36}>
              <XAxis dataKey="nicho" tick={{fill:'#6B6B7B',fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis hide/>
              <Tooltip contentStyle={{background:'#1A1A1F',border:'1px solid #2A2A32',borderRadius:8,color:'#F5F5F7',fontSize:12}} formatter={(v:any)=>[`€${v}`,'Receita']}/>
              <Bar dataKey="receita" radius={[4,4,0,0]}>
                {data.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-[#111114] border border-[#2A2A32] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2A2A32]">
              {['#','Nicho','Leads','Fechados','Conversão','Ticket Médio','Receita'].map(h=>(
                <th key={h} className="text-left px-4 py-3 text-[10px] text-[#6B6B7B] uppercase tracking-wider font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((n,i)=>(
              <tr key={n.nicho} className="border-b border-[#1A1A1F] hover:bg-[#1A1A1F]/50 transition-colors">
                <td className="px-4 py-3">
                  <span className="text-[#6B6B7B]">#{i+1}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{background:COLORS[i%COLORS.length]}}/>
                    <span className="font-medium text-[#F5F5F7]">{n.nicho}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[#6B6B7B]">{n.totalLeads}</td>
                <td className="px-4 py-3 text-[#6B6B7B]">{n.fechados}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-[#2A2A32] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{width:`${n.conversao}%`,background:COLORS[i%COLORS.length]}}/>
                    </div>
                    <span className="text-[#F5F5F7] text-xs">{n.conversao}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[#F5F5F7]">{n.ticketMedio>0?`€${n.ticketMedio}`:'—'}</td>
                <td className="px-4 py-3">
                  <span className="font-bold text-[#FF6A00]">{n.receita>0?`€${n.receita}`:'—'}</span>
                </td>
              </tr>
            ))}
            {data.length===0&&(
              <tr><td colSpan={7} className="text-center py-12 text-[#6B6B7B]">Sem dados de nichos ainda</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
