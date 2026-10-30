'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface FinancialRow {
  outletName: string
  totalSalesCount: number
  totalRevenue: number
  totalCost: number
  grossProfit: number
  marginPercentage: number
}

export default function GlobalFinancialsPage() {
  const [loading, setLoading] = useState(true)
  const [financialData, setFinancialData] = useState<FinancialRow[]>([])
  const [period, setPeriod] = useState<'daily' | 'monthly' | 'yearly'>('monthly')

  // Totals
  const [grandRevenue, setGrandRevenue] = useState(0)
  const [grandCost, setGrandCost] = useState(0)
  const [grandProfit, setGrandProfit] = useState(0)
  const [grandMargin, setGrandMargin] = useState(0)

  useEffect(() => {
    fetchFinancials()
  }, [period])

  const fetchFinancials = async () => {
    try {
      setLoading(true)

      const startDate = new Date()
      if (period === 'daily') startDate.setHours(0, 0, 0, 0)
      else if (period === 'monthly') { startDate.setDate(1); startDate.setHours(0, 0, 0, 0) }
      else if (period === 'yearly') { startDate.setMonth(0, 1); startDate.setHours(0, 0, 0, 0) }

      // 1. Fetch Seluruh Outlets
      const { data: outlets } = await supabase.from('outlets').select('id, name')

      // 2. Fetch Detail Transaksi Item beserta Transaksinya
      const { data: itemsData } = await supabase
        .from('transaction_items')
        .select(`
          qty,
          subtotal,
          products(cost_price),
          transactions!inner(created_at, outlet_id)
        `)
        .gte('transactions.created_at', startDate.toISOString())

      // 3. Fetch Total Transaksi
      const { data: transactionsData } = await supabase
        .from('transactions')
        .select('id, outlet_id')
        .gte('created_at', startDate.toISOString())

      if (outlets) {
        const rows: FinancialRow[] = []
        let totRev = 0
        let totCost = 0

        outlets.forEach((outlet) => {
          const outletItems = itemsData?.filter((i: any) => i.transactions?.outlet_id === outlet.id) || []
          const outletTxs = transactionsData?.filter((t: any) => t.outlet_id === outlet.id) || []

          const revenue = outletItems.reduce((s, i) => s + Number(i.subtotal || 0), 0)
          const cost = outletItems.reduce((s, i: any) => s + (Number(i.qty || 0) * Number(i.products?.cost_price || 0)), 0)
          const profit = revenue - cost
          const margin = revenue > 0 ? (profit / revenue) * 100 : 0

          totRev += revenue
          totCost += cost

          rows.push({
            outletName: outlet.name,
            totalSalesCount: outletTxs.length,
            totalRevenue: revenue,
            totalCost: cost,
            grossProfit: profit,
            marginPercentage: margin,
          })
        })

        const totProfit = totRev - totCost
        const totMargin = totRev > 0 ? (totProfit / totRev) * 100 : 0

        setFinancialData(rows)
        setGrandRevenue(totRev)
        setGrandCost(totCost)
        setGrandProfit(totProfit)
        setGrandMargin(totMargin)
      }
    } catch (err) {
      console.error('Gagal memuat laporan finansial:', err)
    } finally {
      setLoading(false)
    }
  }

  const exportExcel = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['Cabang,Total Struk,Total Omzet,Total HPP,Laba Kotor,Margin (%)',
        ...financialData.map(r => `${r.outletName},${r.totalSalesCount},${r.totalRevenue},${r.totalCost},${r.grossProfit},${r.marginPercentage.toFixed(1)}%`)
      ].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Laporan_Finansial_MatrixPaint_${period}_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      {/* HEADER PAGE */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Laporan Finansial Global</h1>
          <p className="text-xs text-slate-500 mt-1">Rekapitulasi Laba/Rugi, HPP, dan Margin Keuntungan Lintas Cabang.</p>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
          {/* PERIODE FILTER */}
          <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex space-x-1 text-xs">
            {(['daily', 'monthly', 'yearly'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition capitalize ${
                  period === p ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                {p === 'daily' ? 'Harian' : p === 'monthly' ? 'Bulanan' : 'Tahunan'}
              </button>
            ))}
          </div>

          <button
            onClick={exportExcel}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md transition"
          >
            📊 CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-xs text-slate-400">Menghitung neraca laba rugi...</div>
      ) : (
        <>
          {/* SUMMARY CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Pendapatan (Omzet)</p>
              <h2 className="text-xl font-extrabold text-blue-600 mt-1">Rp {grandRevenue.toLocaleString('id-ID')}</h2>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total HPP (Modal)</p>
              <h2 className="text-xl font-extrabold text-slate-700 mt-1">Rp {grandCost.toLocaleString('id-ID')}</h2>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Laba Kotor Global</p>
              <h2 className="text-xl font-extrabold text-emerald-600 mt-1">Rp {grandProfit.toLocaleString('id-ID')}</h2>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rata-rata Profit Margin</p>
              <h2 className="text-xl font-extrabold text-indigo-600 mt-1">{grandMargin.toFixed(1)}%</h2>
            </div>
          </div>

          {/* TABEL FINANSIAL CABANG */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-800">
              Rincian Performa Keuntungan per Cabang Toko
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[650px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                    <th className="py-3.5 px-4 sm:px-6">Cabang Toko</th>
                    <th className="py-3.5 px-4 sm:px-6 text-center">Volume Transaksi</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Pendapatan</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Modal (HPP)</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Laba Kotor</th>
                    <th className="py-3.5 px-4 sm:px-6 text-center">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {financialData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-3.5 px-4 sm:px-6 font-bold text-slate-900 whitespace-nowrap">{row.outletName}</td>
                      <td className="py-3.5 px-4 sm:px-6 text-center font-medium">{row.totalSalesCount} Struk</td>
                      <td className="py-3.5 px-4 sm:px-6 text-right font-bold text-blue-600 whitespace-nowrap">
                        Rp {row.totalRevenue.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-right text-slate-500 whitespace-nowrap">
                        Rp {row.totalCost.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-right font-bold text-emerald-600 whitespace-nowrap">
                        Rp {row.grossProfit.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-center font-bold text-indigo-600">
                        {row.marginPercentage.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}