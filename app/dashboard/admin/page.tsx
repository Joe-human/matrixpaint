'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function AdminDashboardPage() {
  const [totalOmzet, setTotalOmzet] = useState(0)
  const [totalSales, setTotalSales] = useState(0)
  const [totalProducts, setTotalProducts] = useState(0)
  const [recentSales, setRecentSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardSummary()
  }, [])

  const fetchDashboardSummary = async () => {
    try {
      setLoading(true)

      // Fetch ringkasan transaksi dari tabel transactions
      const { data: salesData } = await supabase
        .from('transactions')
        .select('id, invoice_number, total_amount, payment_method, created_at, users(name)')
        .order('created_at', { ascending: false })

      if (salesData) {
        setRecentSales(salesData.slice(0, 5))
        setTotalSales(salesData.length)
        const total = salesData.reduce((sum, s) => sum + Number(s.total_amount), 0)
        setTotalOmzet(total)
      }

      // Fetch jumlah produk master
      const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })

      setTotalProducts(count || 0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Pusat Operasional Admin</h1>
        <p className="text-xs text-slate-500 mt-1">Ringkasan indikator bisnis dan aktivitas transaksi terkini.</p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-xs text-slate-400">Memuat data operasional...</div>
      ) : (
        <>
          {/* Top Metrics Cards - Responsive Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Accumulative Omzet</p>
              <h2 className="text-xl sm:text-2xl font-extrabold text-blue-600 mt-2">Rp {totalOmzet.toLocaleString('id-ID')}</h2>
              <p className="text-[11px] text-slate-400 mt-1">{totalSales} Transaksi Tercatat</p>
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Katalog Produk Master</p>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-2">{totalProducts} Item</h2>
              <Link href="/dashboard/admin/products" className="text-xs text-blue-600 font-semibold mt-2 inline-block hover:underline">
                Kelola Katalog & Stok ➔
              </Link>
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between sm:col-span-2 md:col-span-1">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Modul Laporan</p>
                <p className="text-xs text-slate-600 mt-1">Rekap Harian, Bulanan, Tahunan & Export Excel</p>
              </div>
              <Link
                href="/dashboard/admin/reports"
                className="mt-4 sm:mt-3 text-center py-2.5 sm:py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition shadow-sm"
              >
                Buka Halaman Laporan 📊
              </Link>
            </div>
          </div>

          {/* Transaksi Terkini */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">5 Transaksi Terakhir</h2>
              <Link href="/dashboard/admin/reports" className="text-xs text-blue-600 font-semibold hover:underline">
                Lihat Seluruh Rekap ➔
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm min-w-[650px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                    <th className="py-3 px-4">No. Invoice</th>
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-4">Kasir</th>
                    <th className="py-3 px-4">Metode</th>
                    <th className="py-3 px-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {recentSales.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4 font-mono text-xs font-bold text-slate-900 whitespace-nowrap">{tx.invoice_number}</td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(tx.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="py-3.5 px-4 font-medium whitespace-nowrap">{tx.users?.name || 'Kasir Store'}</td>
                      <td className="py-3.5 px-4 capitalize whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded text-xs border border-slate-200">
                          {tx.payment_method}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                        Rp {Number(tx.total_amount).toLocaleString('id-ID')}
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