'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  TrendingUp,
  Boxes,
  BarChart3,
  RefreshCw,
  ArrowRight,
  Receipt,
  Clock,
  User,
} from 'lucide-react'

interface RecentSale {
  id: string
  invoice_number: string
  total_amount: number
  payment_method: string
  created_at: string
  cashier_name: string
}

export default function AdminDashboardPage() {
  const [totalOmzet, setTotalOmzet] = useState(0)
  const [totalSales, setTotalSales] = useState(0)
  const [totalProducts, setTotalProducts] = useState(0)
  const [recentSales, setRecentSales] = useState<RecentSale[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchDashboardSummary = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true)
      else setLoading(true)

      // 1. Fetch 5 transaksi terakhir beserta relasi kasir
      const { data: recentData, error: recentError } = await supabase
        .from('transactions')
        .select('id, invoice_number, receipt_number, total_amount, payment_method, created_at, users(name)')
        .order('created_at', { ascending: false })
        .limit(5)

      if (recentError) throw recentError

      if (recentData) {
        setRecentSales(
          recentData.map((tx: any) => ({
            id: tx.id,
            invoice_number: tx.invoice_number || tx.receipt_number || `INV-${String(tx.id).slice(0, 6).toUpperCase()}`,
            total_amount: Number(tx.total_amount || 0),
            payment_method: tx.payment_method || 'cash',
            created_at: tx.created_at,
            cashier_name: tx.users?.name || 'Kasir Store',
          }))
        )
      }

      // 2. Fetch agregasi omzet & jumlah transaksi
      const { data: allAmounts, count: salesCount, error: sumError } = await supabase
        .from('transactions')
        .select('total_amount', { count: 'exact' })

      if (sumError) throw sumError

      setTotalSales(salesCount || 0)
      const total = (allAmounts || []).reduce((sum, s: any) => sum + Number(s.total_amount || 0), 0)
      setTotalOmzet(total)

      // 3. Fetch jumlah produk master
      const { count: productCount, error: prodError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })

      if (prodError) throw prodError
      setTotalProducts(productCount || 0)
    } catch (err) {
      console.error('Gagal memuat ringkasan admin:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboardSummary()
  }, [fetchDashboardSummary])

  const formatDate = (dateStr: string) => {
    const parsed = new Date(dateStr)
    if (isNaN(parsed.getTime())) return '-'
    return parsed.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="p-3 min-[375px]:p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 max-w-7xl mx-auto space-y-5 sm:space-y-7">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg min-[375px]:text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Pusat Operasional Admin
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
            Ringkasan indikator bisnis dan aktivitas transaksi terkini.
          </p>
        </div>

        <button
          onClick={() => fetchDashboardSummary(true)}
          disabled={refreshing || loading}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 active:scale-[0.98] border border-slate-200 text-slate-700 text-xs font-semibold px-3.5 py-2 rounded-xl shadow-sm transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white h-28 rounded-2xl border border-slate-200 p-5" />
            ))}
          </div>
          <div className="bg-white h-72 rounded-2xl border border-slate-200 p-5" />
        </div>
      ) : (
        <>
          {/* TOP METRICS CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
            {/* Card 1: Total Omzet */}
            <div className="bg-white p-4 min-[375px]:p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Total Akumulasi Omzet
                </p>
                <h2 className="text-lg min-[375px]:text-xl sm:text-2xl font-extrabold text-blue-600 mt-1.5 break-words">
                  Rp {totalOmzet.toLocaleString('id-ID')}
                </h2>
                <p className="text-[11px] text-slate-400 mt-1">
                  {totalSales.toLocaleString('id-ID')} Transaksi Tercatat
                </p>
              </div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>

            {/* Card 2: Katalog Produk */}
            <div className="bg-white p-4 min-[375px]:p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Katalog Produk Master
                </p>
                <h2 className="text-lg min-[375px]:text-xl sm:text-2xl font-extrabold text-slate-900 mt-1.5">
                  {totalProducts.toLocaleString('id-ID')} Item
                </h2>
                <Link
                  href="/dashboard/admin/products"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 font-semibold mt-2 hover:underline"
                >
                  <span>Kelola Katalog & Stok</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Boxes className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>

            {/* Card 3: Modul Laporan */}
            <div className="bg-white p-4 min-[375px]:p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between sm:col-span-2 lg:col-span-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Modul Laporan
                  </p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Rekap Harian, Bulanan, Tahunan & Export CSV
                  </p>
                </div>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                  <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>

              <Link
                href="/dashboard/admin/reports"
                className="mt-4 inline-flex items-center justify-center gap-1.5 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-semibold rounded-xl text-xs transition shadow-sm"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Buka Halaman Laporan</span>
              </Link>
            </div>
          </div>

          {/* TRANSAKSI TERKINI */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Receipt className="w-4 h-4 text-blue-600 shrink-0" />
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                  5 Transaksi Terakhir
                </h2>
              </div>
              <Link
                href="/dashboard/admin/reports"
                className="inline-flex items-center gap-1 text-[11px] sm:text-xs text-blue-600 font-semibold hover:underline shrink-0"
              >
                <span>Lihat Rekap</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {recentSales.length === 0 ? (
              <div className="text-center py-14 px-4 space-y-1.5">
                <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs sm:text-sm font-semibold text-slate-600">
                  Belum ada transaksi tercatat
                </p>
                <p className="text-[11px] text-slate-400">
                  Transaksi baru dari kasir akan otomatis muncul di sini.
                </p>
              </div>
            ) : (
              <>
                {/* TAMPILAN MOBILE (< 768px): CARD LIST */}
                <div className="md:hidden divide-y divide-slate-100">
                  {recentSales.map((tx) => (
                    <div key={tx.id} className="p-3.5 min-[375px]:p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900 truncate">
                          {tx.invoice_number}
                        </span>
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold uppercase border border-slate-200 shrink-0">
                          {tx.payment_method}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <div className="min-w-0 space-y-0.5 text-[11px] text-slate-500">
                          <p className="flex items-center gap-1 truncate">
                            <User className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{tx.cashier_name}</span>
                          </p>
                          <p className="flex items-center gap-1 text-[10px] text-slate-400">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>{formatDate(tx.created_at)}</span>
                          </p>
                        </div>

                        <span className="font-extrabold text-xs sm:text-sm text-blue-600 whitespace-nowrap shrink-0">
                          Rp {tx.total_amount.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* TAMPILAN DESKTOP / TABLET (>= 768px): TABEL */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                        <th className="py-3.5 px-5">No. Invoice</th>
                        <th className="py-3.5 px-5">Waktu</th>
                        <th className="py-3.5 px-5">Kasir</th>
                        <th className="py-3.5 px-5">Metode</th>
                        <th className="py-3.5 px-5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                      {recentSales.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-5 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {tx.invoice_number}
                          </td>
                          <td className="py-3.5 px-5 text-slate-500 whitespace-nowrap">
                            {formatDate(tx.created_at)}
                          </td>
                          <td className="py-3.5 px-5 font-medium whitespace-nowrap">
                            {tx.cashier_name}
                          </td>
                          <td className="py-3.5 px-5 uppercase whitespace-nowrap">
                            <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded text-[11px] font-semibold border border-slate-200">
                              {tx.payment_method}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-right font-bold text-slate-900 whitespace-nowrap">
                            Rp {tx.total_amount.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
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