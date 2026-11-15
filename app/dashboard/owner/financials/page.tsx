'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Download,
  TrendingUp,
  Wallet,
  PiggyBank,
  Percent,
  Building2,
  ReceiptText,
} from 'lucide-react'

interface FinancialRow {
  outletId: string
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

  const fetchFinancials = useCallback(async () => {
    try {
      setLoading(true)

      const startDate = new Date()
      if (period === 'daily') {
        startDate.setHours(0, 0, 0, 0)
      } else if (period === 'monthly') {
        startDate.setDate(1)
        startDate.setHours(0, 0, 0, 0)
      } else if (period === 'yearly') {
        startDate.setMonth(0, 1)
        startDate.setHours(0, 0, 0, 0)
      }

      // 1. Fetch Seluruh Outlets
      const { data: outlets, error: outletsError } = await supabase
        .from('outlets')
        .select('id, name')
        .order('name', { ascending: true })

      if (outletsError) throw outletsError

      // 2. Fetch Detail Transaksi Item beserta Transaksinya
      const { data: itemsData, error: itemsError } = await supabase
        .from('transaction_items')
        .select(`
          qty,
          subtotal,
          products(cost_price),
          transactions!inner(created_at, outlet_id)
        `)
        .gte('transactions.created_at', startDate.toISOString())

      if (itemsError) throw itemsError

      // 3. Fetch Total Transaksi
      const { data: transactionsData, error: txError } = await supabase
        .from('transactions')
        .select('id, outlet_id')
        .gte('created_at', startDate.toISOString())

      if (txError) throw txError

      if (outlets) {
        const rows: FinancialRow[] = []
        let totRev = 0
        let totCost = 0

        outlets.forEach((outlet) => {
          const outletItems =
            itemsData?.filter((i: any) => i.transactions?.outlet_id === outlet.id) || []
          const outletTxs =
            transactionsData?.filter((t: any) => t.outlet_id === outlet.id) || []

          const revenue = outletItems.reduce((s, i: any) => s + Number(i.subtotal || 0), 0)
          const cost = outletItems.reduce(
            (s, i: any) => s + Number(i.qty || 0) * Number(i.products?.cost_price || 0),
            0
          )
          const profit = revenue - cost
          const margin = revenue > 0 ? (profit / revenue) * 100 : 0

          totRev += revenue
          totCost += cost

          rows.push({
            outletId: outlet.id,
            outletName: outlet.name,
            totalSalesCount: outletTxs.length,
            totalRevenue: revenue,
            totalCost: cost,
            grossProfit: profit,
            marginPercentage: margin,
          })
        })

        // Urutkan cabang berdasarkan pendapatan terbesar
        rows.sort((a, b) => b.totalRevenue - a.totalRevenue)

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
  }, [period])

  useEffect(() => {
    fetchFinancials()
  }, [fetchFinancials])

  const exportExcel = () => {
    if (financialData.length === 0) return

    const headers = [
      'Cabang',
      'Total Struk',
      'Total Omzet (Rp)',
      'Total HPP (Rp)',
      'Laba Kotor (Rp)',
      'Margin (%)',
    ]
    const csvRows = financialData.map((r) => [
      `"${r.outletName.replace(/"/g, '""')}"`,
      r.totalSalesCount,
      r.totalRevenue,
      r.totalCost,
      r.grossProfit,
      `${r.marginPercentage.toFixed(1)}%`,
    ])

    const csvString = [headers.join(','), ...csvRows.map((row) => row.join(','))].join('\n')
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = `Laporan_Finansial_MatrixPaint_${period}_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-3 min-[375px]:p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 max-w-7xl mx-auto space-y-5 sm:space-y-7">
      {/* HEADER PAGE */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3.5">
        <div>
          <h1 className="text-lg min-[375px]:text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Laporan Finansial Global
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
            Rekapitulasi Laba/Rugi, HPP, dan Margin Keuntungan Lintas Cabang.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-between sm:justify-start lg:justify-end">
          {/* PERIODE FILTER */}
          <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex items-center text-[11px] sm:text-xs">
            {(['daily', 'monthly', 'yearly'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 min-[375px]:px-3 py-1.5 rounded-lg font-semibold transition ${
                  period === p
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p === 'daily' ? 'Harian' : p === 'monthly' ? 'Bulanan' : 'Tahunan'}
              </button>
            ))}
          </div>

          <button
            onClick={exportExcel}
            disabled={loading || financialData.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="bg-white h-24 rounded-2xl border border-slate-200 p-5" />
            ))}
          </div>
          <div className="bg-white h-72 rounded-2xl border border-slate-200 p-5" />
        </div>
      ) : (
        <>
          {/* SUMMARY CARDS */}
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-start justify-between gap-2.5">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Total Pendapatan (Omzet)
                </p>
                <h2 className="text-base min-[375px]:text-lg sm:text-xl font-extrabold text-blue-600 mt-1.5 break-words">
                  Rp {grandRevenue.toLocaleString('id-ID')}
                </h2>
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-start justify-between gap-2.5">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Total HPP (Modal)
                </p>
                <h2 className="text-base min-[375px]:text-lg sm:text-xl font-extrabold text-slate-800 mt-1.5 break-words">
                  Rp {grandCost.toLocaleString('id-ID')}
                </h2>
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-start justify-between gap-2.5">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Laba Kotor Global
                </p>
                <h2
                  className={`text-base min-[375px]:text-lg sm:text-xl font-extrabold mt-1.5 break-words ${
                    grandProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  Rp {grandProfit.toLocaleString('id-ID')}
                </h2>
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <PiggyBank className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-start justify-between gap-2.5">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Rata-rata Profit Margin
                </p>
                <h2 className="text-base min-[375px]:text-lg sm:text-xl font-extrabold text-indigo-600 mt-1.5">
                  {grandMargin.toFixed(1)}%
                </h2>
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Percent className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* RINCIAN FINANSIAL CABANG */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                <h2 className="font-bold text-xs sm:text-sm text-slate-800 truncate">
                  Rincian Performa Keuntungan per Cabang Toko
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-slate-400 shrink-0">
                {financialData.length} cabang
              </span>
            </div>

            {financialData.length === 0 ? (
              <div className="text-center py-14 px-4 space-y-1.5">
                <ReceiptText className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs sm:text-sm font-semibold text-slate-600">
                  Belum ada data cabang
                </p>
                <p className="text-[11px] text-slate-400">
                  Tambahkan cabang toko terlebih dahulu untuk melihat laporan finansial.
                </p>
              </div>
            ) : (
              <>
                {/* TAMPILAN MOBILE (< 768px): CARD LIST */}
                <div className="md:hidden divide-y divide-slate-100">
                  {financialData.map((row) => (
                    <div key={row.outletId} className="p-3.5 min-[375px]:p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                            {row.outletName}
                          </h3>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {row.totalSalesCount} Transaksi / Struk
                          </p>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-[11px] shrink-0">
                          Margin {row.marginPercentage.toFixed(1)}%
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl text-[11px]">
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-400">Omzet</p>
                          <p className="font-bold text-blue-600 truncate mt-0.5">
                            Rp {row.totalRevenue.toLocaleString('id-ID')}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-400">Modal HPP</p>
                          <p className="font-semibold text-slate-600 truncate mt-0.5">
                            Rp {row.totalCost.toLocaleString('id-ID')}
                          </p>
                        </div>
                        <div className="min-w-0 text-right">
                          <p className="text-[10px] text-slate-400">Laba Kotor</p>
                          <p
                            className={`font-bold truncate mt-0.5 ${
                              row.grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            Rp {row.grossProfit.toLocaleString('id-ID')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* TAMPILAN DESKTOP / TABLET (>= 768px): TABEL */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                        <th className="py-3.5 px-5">Cabang Toko</th>
                        <th className="py-3.5 px-5 text-center">Volume Transaksi</th>
                        <th className="py-3.5 px-5 text-right">Pendapatan</th>
                        <th className="py-3.5 px-5 text-right">Modal (HPP)</th>
                        <th className="py-3.5 px-5 text-right">Laba Kotor</th>
                        <th className="py-3.5 px-5 text-center">Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {financialData.map((row) => (
                        <tr key={row.outletId} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-5 font-bold text-slate-900 whitespace-nowrap">
                            {row.outletName}
                          </td>
                          <td className="py-3.5 px-5 text-center font-medium whitespace-nowrap">
                            {row.totalSalesCount} Struk
                          </td>
                          <td className="py-3.5 px-5 text-right font-bold text-blue-600 whitespace-nowrap">
                            Rp {row.totalRevenue.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3.5 px-5 text-right text-slate-500 whitespace-nowrap">
                            Rp {row.totalCost.toLocaleString('id-ID')}
                          </td>
                          <td
                            className={`py-3.5 px-5 text-right font-bold whitespace-nowrap ${
                              row.grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            Rp {row.grossProfit.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3.5 px-5 text-center font-bold text-indigo-600 whitespace-nowrap">
                            {row.marginPercentage.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50/90 border-t-2 border-slate-200 font-bold text-xs text-slate-900">
                        <td className="py-3.5 px-5">TOTAL KESELURUHAN</td>
                        <td className="py-3.5 px-5 text-center">
                          {financialData.reduce((s, r) => s + r.totalSalesCount, 0)} Struk
                        </td>
                        <td className="py-3.5 px-5 text-right text-blue-600 whitespace-nowrap">
                          Rp {grandRevenue.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3.5 px-5 text-right text-slate-600 whitespace-nowrap">
                          Rp {grandCost.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3.5 px-5 text-right text-emerald-600 whitespace-nowrap">
                          Rp {grandProfit.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3.5 px-5 text-center text-indigo-600">
                          {grandMargin.toFixed(1)}%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}