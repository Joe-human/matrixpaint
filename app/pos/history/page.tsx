'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Receipt,
  Search,
  RefreshCw,
  Printer,
  CheckCircle2,
  Clock,
  MapPin,
  X,
  FileText,
  User,
  Calendar,
  Loader2,
  AlertCircle,
} from 'lucide-react'

interface SaleRecord {
  id: string
  invoice_no: string
  total_amount: number
  payment_method: string
  payment_status: 'paid' | 'unpaid'
  customer_name?: string | null
  customer_phone?: string | null
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
  const [refreshing, setRefreshing] = useState(false)
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null)
  const [outletName, setOutletName] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Pelunasan bon
  const [settlingId, setSettlingId] = useState<string | null>(null)
  const [confirmSettleSale, setConfirmSettleSale] = useState<SaleRecord | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  )

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev))
    }, 4500)
  }

  const fetchHistory = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    else setLoading(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
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
            invoice_no,
            total_amount,
            payment_method,
            payment_status,
            customer_name,
            customer_phone,
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
        if (data) {
          const list = data as unknown as SaleRecord[]
          setSales(list)
          setSelectedSale((prev) => (prev ? list.find((s) => s.id === prev.id) || null : null))
        }
      }
    } catch (err) {
      console.error('Gagal mengambil riwayat penjualan:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const handleMarkAsPaid = async () => {
    if (!confirmSettleSale) return
    const target = confirmSettleSale

    try {
      setSettlingId(target.id)
      const { error } = await supabase
        .from('transactions')
        .update({ payment_status: 'paid' })
        .eq('id', target.id)

      if (error) throw error

      showFeedback(
        'success',
        `Tagihan Bon ${target.invoice_no} (${target.customer_name || 'Pelanggan'}) telah ditandai LUNAS.`
      )
      setConfirmSettleSale(null)
      await fetchHistory(true)
    } catch (err: any) {
      showFeedback('error', `Gagal memperbarui status bon: ${err.message || 'Terjadi kesalahan'}`)
      setConfirmSettleSale(null)
    } finally {
      setSettlingId(null)
    }
  }

  const filteredSales = sales.filter((s) => {
    const matchStatus = statusFilter === 'all' || s.payment_status === statusFilter
    const q = searchQuery.toLowerCase()
    const matchQuery =
      !q ||
      (s.invoice_no || '').toLowerCase().includes(q) ||
      (s.customer_name || '').toLowerCase().includes(q) ||
      (s.payment_method || '').toLowerCase().includes(q)
    return matchStatus && matchQuery
  })

  const renderReceiptDetail = (sale: SaleRecord) => (
    <div className="space-y-4 text-xs">
      <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono font-bold text-slate-900">{sale.invoice_no || sale.id.slice(0, 8)}</p>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
              sale.payment_status === 'paid'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            {sale.payment_status === 'paid' ? 'LUNAS' : 'BON'}
          </span>
        </div>
        <p className="text-slate-500">
          Kasir:{' '}
          <span className="font-semibold text-slate-800">{sale.users?.name || 'Kasir Store'}</span>
        </p>
        {sale.customer_name && (
          <p className="text-slate-500">
            Pelanggan: <span className="font-bold text-slate-800">{sale.customer_name}</span>
            {sale.customer_phone ? ` (${sale.customer_phone})` : ''}
          </p>
        )}
        <p className="text-slate-500">
          Metode:{' '}
          <span className="font-semibold uppercase text-slate-700">{sale.payment_method}</span>
        </p>
        <p className="text-slate-500">
          Waktu: {new Date(sale.created_at).toLocaleString('id-ID')}
        </p>
      </div>

      <div className="space-y-2.5 border-t border-b border-slate-100 py-3 max-h-60 overflow-y-auto pr-1">
        {sale.transaction_items?.map((item) => (
          <div key={item.id} className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 break-words">
                {item.products?.name || 'Produk'}
              </p>
              <p className="text-[10px] text-slate-400">
                {item.qty} x Rp {Number(item.price).toLocaleString('id-ID')}
              </p>
            </div>
            <span className="font-bold text-slate-900 shrink-0">
              Rp {Number(item.subtotal).toLocaleString('id-ID')}
            </span>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center text-sm font-bold text-slate-900 pt-1">
        <span>Total Tagihan:</span>
        <span className="text-blue-600">
          Rp {Number(sale.total_amount).toLocaleString('id-ID')}
        </span>
      </div>

      <div className="space-y-2 pt-1">
        {sale.payment_status === 'unpaid' && (
          <button
            type="button"
            onClick={() => setConfirmSettleSale(sale)}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition inline-flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/20"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Tandai Bon Lunas</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => window.print()}
          className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition inline-flex items-center justify-center gap-1.5"
        >
          <Printer className="w-4 h-4" />
          <span>Cetak Ulang Struk</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="p-3 min-[375px]:p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 max-w-7xl mx-auto space-y-5 sm:space-y-6">
      {/* HEADER & FILTER */}
      <div className="bg-white p-4 min-[375px]:p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="min-w-0">
            <h1 className="text-lg min-[375px]:text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Receipt className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 shrink-0" />
              <span>Riwayat Transaksi Penjualan</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span>Cabang:</span>
              <span className="inline-flex items-center gap-1 font-semibold text-blue-600">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>{outletName || '...'}</span>
              </span>
            </p>
          </div>

          <button
            onClick={() => fetchHistory(true)}
            disabled={refreshing || loading}
            className="w-full sm:w-auto px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 rounded-xl text-xs font-semibold transition inline-flex items-center justify-center gap-1.5 disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Memuat...' : 'Refresh'}</span>
          </button>
        </div>

        {/* Search & Filter Status */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari invoice atau pelanggan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 sm:inline-flex bg-slate-100 p-1 rounded-xl text-xs font-semibold gap-1">
            {(['all', 'paid', 'unpaid'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg transition text-center ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {st === 'all' ? 'Semua' : st === 'paid' ? 'Lunas' : 'Bon'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {feedback && (
        <div
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="break-words">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-700 shrink-0 p-1"
            aria-label="Tutup notifikasi"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        {/* DAFTAR INVOICE (KIRI) */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between">
            <span className="font-bold text-xs sm:text-sm text-slate-800">Daftar Invoice</span>
            <span className="text-[11px] font-semibold text-slate-400">
              {filteredSales.length} transaksi
            </span>
          </div>

          {loading ? (
            <div className="p-5 space-y-3 animate-pulse">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-16 bg-slate-100 rounded-xl" />
              ))}
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="py-14 px-4 text-center space-y-1.5">
              <FileText className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs sm:text-sm font-semibold text-slate-600">
                Tidak ada transaksi yang sesuai
              </p>
              <p className="text-[11px] text-slate-400">
                Coba ubah filter status atau kata kunci pencarian invoice.
              </p>
            </div>
          ) : (
            <>
              {/* TAMPILAN MOBILE (< 768px): CARD LIST */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredSales.map((sale) => {
                  const isSelected = selectedSale?.id === sale.id
                  return (
                    <div
                      key={sale.id}
                      onClick={() => setSelectedSale(sale)}
                      className={`p-3.5 min-[375px]:p-4 space-y-2.5 cursor-pointer transition ${
                        isSelected ? 'bg-blue-50/50' : 'active:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-mono text-xs font-bold text-slate-900">
                            {sale.invoice_no || sale.id.slice(0, 8)}
                          </span>
                          <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 truncate">
                            <User className="w-3 h-3 shrink-0" />
                            <span className="truncate">
                              {sale.customer_name || 'Pelanggan Umum'}
                            </span>
                          </p>
                        </div>

                        {sale.payment_status === 'paid' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1 shrink-0">
                            <CheckCircle2 className="w-3 h-3" /> Lunas
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1 shrink-0">
                            <Clock className="w-3 h-3" /> Bon
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-semibold uppercase text-[10px]">
                            {sale.payment_method}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>
                              {new Date(sale.created_at).toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                              })}
                            </span>
                          </span>
                        </div>

                        <span className="text-xs sm:text-sm font-extrabold text-blue-600">
                          Rp {Number(sale.total_amount).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* TAMPILAN DESKTOP / TABLET (>= 768px): TABEL */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                      <th className="py-3.5 px-5">No. Invoice</th>
                      <th className="py-3.5 px-5">Waktu</th>
                      <th className="py-3.5 px-5">Metode</th>
                      <th className="py-3.5 px-5 text-center">Status</th>
                      <th className="py-3.5 px-5 text-right">Total</th>
                      <th className="py-3.5 px-5 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                    {filteredSales.map((sale) => {
                      const isSelected = selectedSale?.id === sale.id
                      return (
                        <tr
                          key={sale.id}
                          className={`transition ${
                            isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <td className="py-3.5 px-5 font-mono font-bold text-slate-900 whitespace-nowrap">
                            <div>{sale.invoice_no || sale.id.slice(0, 8)}</div>
                            {sale.customer_name && (
                              <span className="block text-[10px] text-slate-400 font-sans font-normal">
                                {sale.customer_name}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-5 text-slate-500 whitespace-nowrap">
                            {new Date(sale.created_at).toLocaleString('id-ID', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </td>
                          <td className="py-3.5 px-5 uppercase whitespace-nowrap">
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md font-semibold text-[11px]">
                              {sale.payment_method}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-center whitespace-nowrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                sale.payment_status === 'paid'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {sale.payment_status === 'paid' ? 'LUNAS' : 'BON'}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-right font-extrabold text-slate-900 whitespace-nowrap">
                            Rp {Number(sale.total_amount).toLocaleString('id-ID')}
                          </td>
                          <td className="py-3.5 px-5 text-center whitespace-nowrap">
                            <button
                              onClick={() => setSelectedSale(sale)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                                isSelected
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                              }`}
                            >
                              Detail Struk
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* PANEL DETAIL STRUK (DESKTOP >= 1024px) */}
        <div className="hidden lg:flex bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex-col justify-between h-fit sticky top-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            Rincian Struk Transaksi
          </h2>

          {selectedSale ? (
            renderReceiptDetail(selectedSale)
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs space-y-1.5">
              <Receipt className="w-7 h-7 text-slate-300 mx-auto" />
              <p>
                Pilih tombol <span className="font-semibold text-slate-600">"Detail Struk"</span>{' '}
                pada salah satu transaksi untuk melihat rincian barang.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DETAIL STRUK UNTUK MOBILE / TABLET (< 1024px) */}
      {selectedSale && (
        <div className="lg:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-40">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-4 min-[375px]:p-5 max-w-md w-full space-y-4 shadow-2xl border border-slate-200 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-5 max-h-[88dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">Rincian Struk Transaksi</h2>
              <button
                type="button"
                onClick={() => setSelectedSale(null)}
                className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900"
                aria-label="Tutup rincian"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {renderReceiptDetail(selectedSale)}
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI PELUNASAN BON */}
      {confirmSettleSale && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 min-[375px]:p-4 z-50">
          <div className="bg-white rounded-2xl p-4 min-[375px]:p-5 sm:p-6 max-w-sm w-full space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900">Tandai Transaksi Lunas?</h3>
                <p className="text-xs text-slate-500 mt-1 break-words leading-relaxed">
                  Konfirmasi pelunasan bon{' '}
                  <span className="font-mono font-bold text-slate-800">
                    {confirmSettleSale.invoice_no}
                  </span>{' '}
                  atas nama{' '}
                  <span className="font-bold text-slate-800">
                    {confirmSettleSale.customer_name || 'Pelanggan Umum'}
                  </span>{' '}
                  senilai{' '}
                  <span className="font-bold text-blue-600">
                    Rp {Number(confirmSettleSale.total_amount).toLocaleString('id-ID')}
                  </span>
                  ?
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleMarkAsPaid}
                disabled={Boolean(settlingId)}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {settlingId && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{settlingId ? 'Menyimpan...' : 'Ya, Sudah Lunas'}</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmSettleSale(null)}
                disabled={Boolean(settlingId)}
                className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-200 transition"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}