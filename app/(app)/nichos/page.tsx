'use client'
import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function NichosPage() {
  const [data, setData] = useState<any[]>([])
  useEffect(()=>{fetch('/api/nichos').then(r=>r.json()).then(setData)},[])

  const COLORS = ['#8B5CF6','#A78BFA','#F59E0B','#8B5CF6','#3B82F6','#10B981','#71717A']

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-black text-[#F0F0F3]">Ranking de Nichos</h1>
        <p className="text-sm text-[#71717A]">Performance comercial por sector</p>
      </div>

      {data.length > 0 && (
        <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 mb-5">
          <div className="text-xs text-[#71717A] uppercase tracking-wider mb-4">Receita por Nicho</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} barSize={36}>
              <XAxis dataKey="nicho" tick={{fill:'#71717A',fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis hide/>
              <Tooltip contentStyle={{background:'#16161A',border:'1px solid #27272A',borderRadius:8,color:'#F0F0F3',fontSize:12}} formatter={(v:any)=>[`€${v}`,'Receita']}/>
              <Bar dataKey="receita" radius={[4,4,0,0]}>
                {data.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#27272A]">
              {['#','Nicho','Leads','Fechados','Conversão','Ticket Médio','Receita'].map(h=>(
                <th key={h} className="text-left px-4 py-3 text-[10px] text-[#71717A] uppercase tracking-wider font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((n,i)=>(
              <tr key={n.nicho} className="border-b border-[#16161A] hover:bg-[#16161A]/50 transition-colors">
                <td className="px-4 py-3">
                  <span className="text-[#71717A]">#{i+1}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{background:COLORS[i%COLORS.length]}}/>
                    <span className="font-medium text-[#F0F0F3]">{n.nicho}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[#71717A]">{n.totalLeads}</td>
                <td className="px-4 py-3 text-[#71717A]">{n.fechados}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-[#27272A] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{width:`${n.conversao}%`,background:COLORS[i%COLORS.length]}}/>
                    </div>
                    <span className="text-[#F0F0F3] text-xs">{n.conversao}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[#F0F0F3]">{n.ticketMedio>0?`€${n.ticketMedio}`:'—'}</td>
                <td className="px-4 py-3">
                  <span className="font-bold text-[#8B5CF6]">{n.receita>0?`€${n.receita}`:'—'}</span>
                </td>
              </tr>
            ))}
            {data.length===0&&(
              <tr><td colSpan={7} className="text-center py-12 text-[#71717A]">Sem dados de nichos ainda</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
