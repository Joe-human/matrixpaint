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
  Fuel,
  Vault,
  Banknote,
  QrCode,
  CreditCard,
} from 'lucide-react'

interface SaleRecord {
  id: string
  invoice_no: string
  subtotal_amount?: number | null
  discount_amount?: number | null
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

interface OperationalExpenseRecord {
  id: string
  category: string
  description: string
  amount: number
  created_at: string
  users?: { name: string } | null
}

interface CashierShiftRecord {
  id: string
  start_time: string
  end_time: string | null
  initial_cash: number
  expected_cash: number | null
  final_cash: number | null
  status: 'open' | 'closed'
  users?: { name: string } | null
}

export default function SalesHistoryPage() {
  const [activeTab, setActiveTab] = useState<'sales' | 'expenses' | 'shifts'>('sales')
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [expenses, setExpenses] = useState<OperationalExpenseRecord[]>([])
  const [shifts, setShifts] = useState<CashierShiftRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null)
  const [outletName, setOutletName] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Pelunasan bon
  const [settlingId, setSettlingId] = useState<string | null>(null)
  const [confirmSettleSale, setConfirmSettleSale] = useState<SaleRecord | null>(null)
  const [settleMethod, setSettleMethod] = useState<'cash' | 'qris' | 'transfer'>('cash')
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

        // 1. Ambil Riwayat Penjualan
        let salesQuery = supabase
          .from('transactions')
          .select(`
            id,
            invoice_no,
            subtotal_amount,
            discount_amount,
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
          salesQuery = salesQuery.eq('outlet_id', userData.outlet_id)
        }

        const { data: salesData, error: salesErr } = await salesQuery
        if (salesErr) throw salesErr
        if (salesData) {
          const list = salesData as unknown as SaleRecord[]
          setSales(list)
          setSelectedSale((prev) => (prev ? list.find((s) => s.id === prev.id) || null : null))
        }

        // 2. Ambil Riwayat Kas Operasional
        let expQuery = supabase
          .from('operational_expenses')
          .select('id, category, description, amount, created_at, users(name)')
          .order('created_at', { ascending: false })

        if (userData.outlet_id) {
          expQuery = expQuery.eq('outlet_id', userData.outlet_id)
        }

        const { data: expData, error: expErr } = await expQuery
        if (expErr) throw expErr
        if (expData) {
          setExpenses(expData as unknown as OperationalExpenseRecord[])
        }

        // 3. Ambil Riwayat Buka / Tutup Shift Kasir
        let shiftQuery = supabase
          .from('cashier_shifts')
          .select(
            'id, start_time, end_time, initial_cash, expected_cash, final_cash, status, users(name)'
          )
          .order('start_time', { ascending: false })

        if (userData.outlet_id) {
          shiftQuery = shiftQuery.eq('outlet_id', userData.outlet_id)
        }

        const { data: shiftData, error: shiftErr } = await shiftQuery
        if (shiftErr) throw shiftErr
        if (shiftData) {
          setShifts(shiftData as unknown as CashierShiftRecord[])
        }
      }
    } catch (err) {
      console.error('Gagal mengambil riwayat transaksi:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const openSettleModal = (sale: SaleRecord) => {
    setSettleMethod('cash')
    setConfirmSettleSale(sale)
  }

  const handleMarkAsPaid = async () => {
    if (!confirmSettleSale) return
    const target = confirmSettleSale

    try {
      setSettlingId(target.id)
      const { data, error } = await supabase
        .from('transactions')
        .update({
          payment_status: 'paid',
          payment_method: settleMethod,
        })
        .eq('id', target.id)
        .select()

      if (error) throw error

      if (!data || data.length === 0) {
        throw new Error(
          'Gagal memperbarui status. Pastikan izin RLS pada tabel transactions memperbolehkan UPDATE.'
        )
      }

      showFeedback(
        'success',
        `Tagihan Bon ${target.invoice_no} (${target.customer_name || 'Pelanggan'}) telah ditandai LUNAS via ${settleMethod.toUpperCase()}.`
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

  const filteredExpenses = expenses.filter((exp) => {
    const q = searchQuery.toLowerCase()
    return (
      !q ||
      (exp.category || '').toLowerCase().includes(q) ||
      (exp.description || '').toLowerCase().includes(q) ||
      (exp.users?.name || '').toLowerCase().includes(q)
    )
  })

  const filteredShifts = shifts.filter((sh) => {
    const q = searchQuery.toLowerCase()
    return (
      !q ||
      (sh.users?.name || '').toLowerCase().includes(q) ||
      (sh.status || '').toLowerCase().includes(q)
    )
  })

  const totalFilteredExpenses = filteredExpenses.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  )

  const renderReceiptDetail = (sale: SaleRecord) => {
    const discount = Number(sale.discount_amount || 0)
    const subtotal =
      sale.subtotal_amount !== null && sale.subtotal_amount !== undefined
        ? Number(sale.subtotal_amount)
        : Number(sale.total_amount) + discount

    return (
      <div className="space-y-4 text-xs">
        <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono font-bold text-slate-900">
              {sale.invoice_no || sale.id.slice(0, 8)}
            </p>
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

        <div className="space-y-1.5 pt-1">
          {discount > 0 && (
            <>
              <div className="flex justify-between items-center text-xs text-slate-500">
                <span>Subtotal:</span>
                <span>Rp {subtotal.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-semibold text-emerald-600">
                <span>Diskon Manual:</span>
                <span>- Rp {discount.toLocaleString('id-ID')}</span>
              </div>
            </>
          )}
          <div className="flex justify-between items-center text-sm font-bold text-slate-900">
            <span>Total Tagihan:</span>
            <span className="text-blue-600">
              Rp {Number(sale.total_amount).toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          {sale.payment_status === 'unpaid' && (
            <button
              type="button"
              onClick={() => openSettleModal(sale)}
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
  }

  return (
    <div className="p-3 min-[375px]:p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 max-w-7xl mx-auto space-y-5 sm:space-y-6">
      {/* HEADER & FILTER */}
      <div className="bg-white p-4 min-[375px]:p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="min-w-0">
            <h1 className="text-lg min-[375px]:text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Receipt className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 shrink-0" />
              <span>Riwayat Transaksi, Kas & Shift</span>
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

        {/* Switcher Tab Penjualan vs Kas Operasional vs Riwayat Shift */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="grid grid-cols-3 sm:inline-flex bg-slate-100 p-1 rounded-xl text-xs font-bold gap-1 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('sales')}
              className={`px-3 sm:px-4 py-2 rounded-lg transition inline-flex items-center justify-center gap-1.5 ${
                activeTab === 'sales'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Receipt className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Penjualan ({sales.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('expenses')}
              className={`px-3 sm:px-4 py-2 rounded-lg transition inline-flex items-center justify-center gap-1.5 ${
                activeTab === 'expenses'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Fuel className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Kas Keluar ({expenses.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('shifts')}
              className={`px-3 sm:px-4 py-2 rounded-lg transition inline-flex items-center justify-center gap-1.5 ${
                activeTab === 'shifts'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Vault className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Shift ({shifts.length})</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={
                  activeTab === 'sales'
                    ? 'Cari invoice atau pelanggan...'
                    : activeTab === 'expenses'
                    ? 'Cari kategori atau keterangan kas...'
                    : 'Cari nama kasir atau status shift...'
                }
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

            {activeTab === 'sales' && (
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
            )}
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

      {/* KONTEN TAB 1: RIWAYAT PENJUALAN */}
      {activeTab === 'sales' && (
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
                    const discount = Number(sale.discount_amount || 0)
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

                          <div className="text-right">
                            {discount > 0 && (
                              <span className="block text-[10px] font-semibold text-emerald-600">
                                Diskon -Rp {discount.toLocaleString('id-ID')}
                              </span>
                            )}
                            <span className="text-xs sm:text-sm font-extrabold text-blue-600">
                              Rp {Number(sale.total_amount).toLocaleString('id-ID')}
                            </span>
                          </div>
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
                        const discount = Number(sale.discount_amount || 0)
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
                              <div>Rp {Number(sale.total_amount).toLocaleString('id-ID')}</div>
                              {discount > 0 && (
                                <span className="block text-[10px] font-semibold text-emerald-600">
                                  Disc -Rp {discount.toLocaleString('id-ID')}
                                </span>
                              )}
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
      )}

      {/* KONTEN TAB 2: RIWAYAT KAS OPERASIONAL */}
      {activeTab === 'expenses' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 sm:px-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Fuel className="w-4 h-4 text-amber-600" />
              <span className="font-bold text-xs sm:text-sm text-slate-800">
                Catatan Kas Keluar / Operasional Cabang
              </span>
            </div>
            <div className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-xl">
              Total Kas Keluar: Rp {totalFilteredExpenses.toLocaleString('id-ID')}
            </div>
          </div>

          {loading ? (
            <div className="p-5 space-y-3 animate-pulse">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-14 bg-slate-100 rounded-xl" />
              ))}
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="py-14 px-4 text-center space-y-1.5">
              <Fuel className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs sm:text-sm font-semibold text-slate-600">
                Belum ada catatan kas operasional
              </p>
              <p className="text-[11px] text-slate-400">
                Pengeluaran bensin, parkir, plastik, atau konsumsi yang dicatat dari Terminal Kasir
                akan muncul di sini.
              </p>
            </div>
          ) : (
            <>
              {/* MOBILE LIST */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredExpenses.map((exp) => (
                  <div key={exp.id} className="p-3.5 min-[375px]:p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-bold">
                        {exp.category}
                      </span>
                      <span className="text-xs font-extrabold text-rose-600">
                        - Rp {Number(exp.amount).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 break-words">
                      {exp.description}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Kasir: {exp.users?.name || 'Kasir'}</span>
                      <span>
                        {new Date(exp.created_at).toLocaleString('id-ID', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* DESKTOP TABLE */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                      <th className="py-3.5 px-5">Waktu</th>
                      <th className="py-3.5 px-5">Kategori</th>
                      <th className="py-3.5 px-5">Keterangan Keperluan</th>
                      <th className="py-3.5 px-5">Dicatat Oleh</th>
                      <th className="py-3.5 px-5 text-right">Nominal Keluar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                    {filteredExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-5 text-slate-500 whitespace-nowrap">
                          {new Date(exp.created_at).toLocaleString('id-ID', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-md font-semibold text-[11px]">
                            {exp.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 font-semibold text-slate-800">
                          {exp.description}
                        </td>
                        <td className="py-3.5 px-5 text-slate-500 whitespace-nowrap">
                          {exp.users?.name || 'Kasir Store'}
                        </td>
                        <td className="py-3.5 px-5 text-right font-extrabold text-rose-600 whitespace-nowrap">
                          - Rp {Number(exp.amount).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* KONTEN TAB 3: RIWAYAT BUKA / TUTUP SHIFT KASIR */}
      {activeTab === 'shifts' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 sm:px-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Vault className="w-4 h-4 text-indigo-600" />
              <span className="font-bold text-xs sm:text-sm text-slate-800">
                Log Buka & Tutup Kasir (Rekonsiliasi Laci)
              </span>
            </div>
            <span className="text-[11px] font-semibold text-slate-400">
              {filteredShifts.length} riwayat shift
            </span>
          </div>

          {loading ? (
            <div className="p-5 space-y-3 animate-pulse">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-16 bg-slate-100 rounded-xl" />
              ))}
            </div>
          ) : filteredShifts.length === 0 ? (
            <div className="py-14 px-4 text-center space-y-1.5">
              <Vault className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs sm:text-sm font-semibold text-slate-600">
                Belum ada riwayat shift kasir
              </p>
              <p className="text-[11px] text-slate-400">
                Catatan buka dan tutup kasir dari menu Laci Kasir akan otomatis tersimpan di sini.
              </p>
            </div>
          ) : (
            <>
              {/* MOBILE LIST */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredShifts.map((sh) => {
                  const diff = Number(sh.final_cash || 0) - Number(sh.expected_cash || 0)
                  return (
                    <div key={sh.id} className="p-3.5 min-[375px]:p-4 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900">
                          {sh.users?.name || 'Kasir Store'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            sh.status === 'open'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {sh.status === 'open' ? 'Sedang Buka' : 'Selesai'}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 space-y-0.5">
                        <p>
                          Buka:{' '}
                          <span className="font-medium text-slate-700">
                            {new Date(sh.start_time).toLocaleString('id-ID', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </span>
                        </p>
                        <p>
                          Tutup:{' '}
                          <span className="font-medium text-slate-700">
                            {sh.end_time
                              ? new Date(sh.end_time).toLocaleString('id-ID', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })
                              : 'Masih aktif'}
                          </span>
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 text-[11px]">
                        <div>
                          <span className="block text-[10px] text-slate-400">Modal Awal</span>
                          <span className="font-bold text-slate-800">
                            Rp {Number(sh.initial_cash || 0).toLocaleString('id-ID')}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-400">Kas Fisik</span>
                          <span className="font-bold text-slate-800">
                            {sh.status === 'closed'
                              ? `Rp ${Number(sh.final_cash || 0).toLocaleString('id-ID')}`
                              : '-'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[10px] text-slate-400">Selisih</span>
                          {sh.status === 'closed' ? (
                            <span
                              className={`font-extrabold ${
                                diff === 0
                                  ? 'text-emerald-600'
                                  : diff > 0
                                  ? 'text-blue-600'
                                  : 'text-rose-600'
                              }`}
                            >
                              {diff === 0
                                ? 'Klop'
                                : `${diff > 0 ? '+' : ''}Rp ${diff.toLocaleString('id-ID')}`}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* DESKTOP TABLE */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                      <th className="py-3.5 px-5">Kasir</th>
                      <th className="py-3.5 px-5">Waktu Buka & Tutup</th>
                      <th className="py-3.5 px-5 text-right">Modal Awal</th>
                      <th className="py-3.5 px-5 text-right">Ekspektasi Sistem</th>
                      <th className="py-3.5 px-5 text-right">Kas Fisik Setor</th>
                      <th className="py-3.5 px-5 text-right">Selisih</th>
                      <th className="py-3.5 px-5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                    {filteredShifts.map((sh) => {
                      const diff = Number(sh.final_cash || 0) - Number(sh.expected_cash || 0)
                      return (
                        <tr key={sh.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3.5 px-5">
                            <div className="font-bold text-slate-900">
                              {sh.users?.name || 'Kasir Store'}
                            </div>
                          </td>
                          <td className="py-3.5 px-5 text-slate-500 whitespace-nowrap space-y-0.5">
                            <div>
                              <span className="text-[10px] font-bold text-emerald-600 mr-1">
                                BUKA:
                              </span>
                              {new Date(sh.start_time).toLocaleString('id-ID', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-rose-500 mr-1">
                                TUTUP:
                              </span>
                              {sh.end_time
                                ? new Date(sh.end_time).toLocaleString('id-ID', {
                                    dateStyle: 'short',
                                    timeStyle: 'short',
                                  })
                                : 'Masih aktif'}
                            </div>
                          </td>
                          <td className="py-3.5 px-5 text-right font-semibold text-slate-700 whitespace-nowrap">
                            Rp {Number(sh.initial_cash || 0).toLocaleString('id-ID')}
                          </td>
                          <td className="py-3.5 px-5 text-right font-semibold text-slate-700 whitespace-nowrap">
                            {sh.status === 'closed'
                              ? `Rp ${Number(sh.expected_cash || 0).toLocaleString('id-ID')}`
                              : '-'}
                          </td>
                          <td className="py-3.5 px-5 text-right font-extrabold text-slate-900 whitespace-nowrap">
                            {sh.status === 'closed'
                              ? `Rp ${Number(sh.final_cash || 0).toLocaleString('id-ID')}`
                              : '-'}
                          </td>
                          <td className="py-3.5 px-5 text-right font-extrabold whitespace-nowrap">
                            {sh.status === 'closed' ? (
                              <span
                                className={
                                  diff === 0
                                    ? 'text-emerald-600'
                                    : diff > 0
                                    ? 'text-blue-600'
                                    : 'text-rose-600'
                                }
                              >
                                {diff === 0
                                  ? 'Rp 0 (Klop)'
                                  : `${diff > 0 ? '+' : ''}Rp ${diff.toLocaleString('id-ID')}`}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3.5 px-5 text-center whitespace-nowrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                sh.status === 'open'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {sh.status === 'open' ? 'AKTIF' : 'TUTUP'}
                            </span>
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
      )}

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
                  .
                </p>
              </div>
            </div>

            {/* Pilihan Metode Pembayaran Pelunasan */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                Metode Pembayaran Diterima
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'cash', label: 'Tunai', icon: Banknote },
                  { id: 'qris', label: 'QRIS', icon: QrCode },
                  { id: 'transfer', label: 'Transfer', icon: CreditCard },
                ].map((m) => {
                  const Icon = m.icon
                  const active = settleMethod === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSettleMethod(m.id as 'cash' | 'qris' | 'transfer')}
                      className={`py-2 px-2 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-1 transition ${
                        active
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{m.label}</span>
                    </button>
                  )
                })}
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