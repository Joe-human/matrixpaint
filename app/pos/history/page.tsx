'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface SaleRecord {
  id: string
  invoice_number: string
  total_amount: number
  payment_method: string
  payment_status: 'paid' | 'unpaid'
  customer_name?: string
  created_at: string
  users: { name: string } | null
  transaction_items: {
    id: string
    qty: number
    price: number
    subtotal: number
    products: { name: string; sku: string } | null
  }[]
}

export default function SalesHistoryPage() {
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null)
  const [outletName, setOutletName] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all')

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: userData } = await supabase
        .from('users')
        .select('outlet_id, outlets(name)')
        .eq('email', session.user.email)
        .single()

      if (userData) {
        setOutletName((userData.outlets as any)?.name || 'Semua Cabang')

        let query = supabase
          .from('transactions')
          .select(`
            id,
            invoice_number,
            total_amount,
            payment_method,
            payment_status,
            customer_name,
            created_at,
            users(name),
            transaction_items(
              id,
              qty,
              price,
              subtotal,
              products(name, sku)
            )
          `)
          .order('created_at', { ascending: false })

        if (userData.outlet_id) {
          query = query.eq('outlet_id', userData.outlet_id)
        }

        const { data, error } = await query
        if (error) throw error
        if (data) setSales(data as any)
      }
    } catch (err) {
      console.error('Gagal mengambil riwayat penjualan:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredSales = sales.filter((s) => {
    if (statusFilter === 'all') return true
    return s.payment_status === statusFilter
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header & Filter */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Riwayat Transaksi Penjualan</h1>
          <p className="text-xs text-slate-500 mt-1">
            Cabang: <span className="font-semibold text-blue-600">{outletName}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle Filter Status Pembayaran */}
          <div className="bg-slate-100 p-1 rounded-xl flex text-xs font-semibold">
            {(['all', 'paid', 'unpaid'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg capitalize transition ${
                  statusFilter === st ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                {st === 'all' ? 'Semua' : st === 'paid' ? 'Lunas (Paid)' : 'Bon (Unpaid)'}
              </button>
            ))}
          </div>

          <button
            onClick={fetchHistory}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tabel Daftar Invoice */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs">Memuat riwayat transaksi...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm min-w-[550px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                    <th className="py-3.5 px-4 sm:px-6">No. Invoice</th>
                    <th className="py-3.5 px-4 sm:px-6">Waktu</th>
                    <th className="py-3.5 px-4 sm:px-6">Metode</th>
                    <th className="py-3.5 px-4 sm:px-6 text-center">Status</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Total</th>
                    <th className="py-3.5 px-4 sm:px-6 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-xs sm:text-sm">
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                        Tidak ada transaksi yang sesuai.
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 sm:px-6 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                          {sale.invoice_number}
                          {sale.customer_name && (
                            <span className="block text-[10px] text-slate-400 font-sans">{sale.customer_name}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-xs text-slate-500 whitespace-nowrap">
                          {new Date(sale.created_at).toLocaleString('id-ID', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-xs capitalize whitespace-nowrap">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded font-medium">
                            {sale.payment_method}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            sale.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {sale.payment_status === 'paid' ? 'LUNAS' : 'BON'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-right font-bold text-slate-900 whitespace-nowrap">
                          Rp {Number(sale.total_amount).toLocaleString('id-ID')}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-center whitespace-nowrap">
                          <button
                            onClick={() => setSelectedSale(sale)}
                            className="px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-medium transition"
                          >
                            Detail Struk
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Panel Detail Struk / Item Pesanan */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between h-fit space-y-4">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            Rincian Struk Transaksi
          </h2>

          {selectedSale ? (
            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl space-y-1">
                <p className="font-mono font-bold text-slate-800">{selectedSale.invoice_number}</p>
                <p className="text-slate-500">
                  Kasir: <span className="font-medium text-slate-700">{selectedSale.users?.name || 'Kasir Store'}</span>
                </p>
                {selectedSale.customer_name && (
                  <p className="text-slate-500">
                    Pelanggan: <span className="font-bold text-slate-800">{selectedSale.customer_name}</span>
                  </p>
                )}
                <p className="text-slate-500">
                  Waktu: {new Date(selectedSale.created_at).toLocaleString('id-ID')}
                </p>
              </div>

              <div className="space-y-2 border-t border-b border-slate-100 py-3 max-h-60 overflow-y-auto">
                {selectedSale.transaction_items?.map((item) => (
                  <div key={item.id} className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-slate-800">{item.products?.name || 'Produk'}</p>
                      <p className="text-[10px] text-slate-400">
                        {item.qty} x Rp {Number(item.price).toLocaleString('id-ID')}
                      </p>
                    </div>
                    <span className="font-semibold text-slate-900">
                      Rp {Number(item.subtotal).toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between text-sm font-bold text-slate-900 pt-1">
                <span>Total Tagihan:</span>
                <span className="text-blue-600">
                  Rp {Number(selectedSale.total_amount).toLocaleString('id-ID')}
                </span>
              </div>

              <button
                onClick={() => window.print()}
                className="w-full py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition"
              >
                Cetak Ulang Struk
              </button>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">
              Pilih tombol <span className="font-semibold text-slate-600">"Detail Struk"</span> pada salah satu transaksi untuk melihat rincian barang.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}