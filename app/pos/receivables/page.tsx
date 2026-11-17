'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  FileText,
  Search,
  CheckCircle2,
  Phone,
  User,
  RefreshCw,
  Banknote,
  QrCode,
  CreditCard,
  MapPin,
  Loader2,
  X,
  AlertCircle,
  Calendar,
} from 'lucide-react'

interface ReceivableRecord {
  id: string
  invoice_no: string
  subtotal_amount?: number | null
  discount_amount?: number | null
  total_amount: number
  customer_name: string | null
  customer_phone: string | null
  created_at: string
  users: { name: string } | null
}

export default function ReceivablesPage() {
  const [receivables, setReceivables] = useState<ReceivableRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [outletName, setOutletName] = useState('')
  const [settlingTx, setSettlingTx] = useState<ReceivableRecord | null>(null)
  const [settleMethod, setSettleMethod] = useState<'cash' | 'qris' | 'transfer'>('cash')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  )

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev))
    }, 4500)
  }

  const fetchReceivables = useCallback(async (isManual = false) => {
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
          .select(
            'id, invoice_no, subtotal_amount, discount_amount, total_amount, customer_name, customer_phone, created_at, users(name)'
          )
          .eq('payment_status', 'unpaid')
          .order('created_at', { ascending: false })

        if (userData.outlet_id) {
          query = query.eq('outlet_id', userData.outlet_id)
        }

        const { data, error } = await query
        if (error) throw error
        if (data) setReceivables(data as unknown as ReceivableRecord[])
      }
    } catch (err) {
      console.error('Gagal memuat daftar piutang:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchReceivables()
  }, [fetchReceivables])

  const handleSettle = async () => {
    if (!settlingTx) return
    const target = settlingTx

    try {
      setSubmitting(true)
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

      setSettlingTx(null)
      showFeedback(
        'success',
        `Tagihan ${target.invoice_no} (${target.customer_name || 'Pelanggan'}) telah lunas via ${settleMethod.toUpperCase()}!`
      )
      await fetchReceivables(true)
    } catch (err: any) {
      showFeedback('error', `Gagal memproses pelunasan: ${err.message || 'Terjadi kesalahan'}`)
    } finally {
      setSubmitting(false)
    }
  }

  const filteredReceivables = receivables.filter((r) => {
    const q = searchQuery.toLowerCase()
    return (
      !q ||
      (r.customer_name || '').toLowerCase().includes(q) ||
      (r.invoice_no || '').toLowerCase().includes(q) ||
      (r.customer_phone || '').toLowerCase().includes(q)
    )
  })

  const totalPiutang = filteredReceivables.reduce((sum, r) => sum + Number(r.total_amount), 0)

  return (
    <div className="p-3 min-[375px]:p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 max-w-6xl mx-auto space-y-5 sm:space-y-6">
      {/* HEADER & TOTAL PIUTANG */}
      <div className="bg-white p-4 min-[375px]:p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="min-w-0">
          <h1 className="text-lg min-[375px]:text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500 shrink-0" />
            <span>Piutang & Bon Pelanggan</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <span>Cabang:</span>
            <span className="inline-flex items-center gap-1 font-semibold text-blue-600">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{outletName || '...'}</span>
            </span>
          </p>
        </div>

        <div className="w-full md:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
          <div className="bg-amber-50 border border-amber-200/90 px-4 py-2.5 rounded-xl flex sm:block items-center justify-between">
            <p className="text-[10px] font-bold text-amber-700 uppercase">Total Tagihan Bon</p>
            <p className="text-base sm:text-lg font-extrabold text-amber-800">
              Rp {totalPiutang.toLocaleString('id-ID')}
            </p>
          </div>
          <button
            onClick={() => fetchReceivables(true)}
            disabled={refreshing || loading}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 rounded-xl text-xs font-semibold transition inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
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

      {/* SEARCH BAR */}
      <div className="relative w-full sm:max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Cari nama pelanggan, nomor HP, atau invoice..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-xs transition"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* DAFTAR PIUTANG */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-20 bg-slate-100 rounded-xl" />
            ))}
          </div>
        ) : filteredReceivables.length === 0 ? (
          <div className="py-16 px-4 text-center space-y-1.5">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="text-xs sm:text-sm font-semibold text-slate-700">
              Tidak ada tagihan bon / piutang tertunda
            </p>
            <p className="text-[11px] text-slate-400">
              Semua transaksi pelanggan di cabang ini telah berstatus lunas.
            </p>
          </div>
        ) : (
          <>
            {/* TAMPILAN MOBILE (< 768px): CARD LIST */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredReceivables.map((item) => {
                const discount = Number(item.discount_amount || 0)
                return (
                  <div key={item.id} className="p-3.5 min-[375px]:p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{item.customer_name || 'Pelanggan Umum'}</span>
                        </div>
                        {item.customer_phone && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 shrink-0" />
                            <span>{item.customer_phone}</span>
                          </div>
                        )}
                      </div>

                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0">
                        {item.invoice_no}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {new Date(item.created_at).toLocaleString('id-ID', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                      </span>
                      <div className="text-right">
                        {discount > 0 && (
                          <span className="block text-[10px] font-semibold text-emerald-600">
                            Diskon -Rp {discount.toLocaleString('id-ID')}
                          </span>
                        )}
                        <span className="text-sm font-extrabold text-amber-600">
                          Rp {Number(item.total_amount).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSettleMethod('cash')
                        setSettlingTx(item)
                      }}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white rounded-xl text-xs font-bold transition shadow-xs inline-flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Proses Pelunasan Bon</span>
                    </button>
                  </div>
                )
              })}
            </div>

            {/* TAMPILAN DESKTOP / TABLET (>= 768px): TABEL */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                    <th className="py-3.5 px-5">Pelanggan</th>
                    <th className="py-3.5 px-5">No. Invoice</th>
                    <th className="py-3.5 px-5">Tanggal Bon</th>
                    <th className="py-3.5 px-5 text-right">Nominal Tagihan</th>
                    <th className="py-3.5 px-5 text-center">Aksi Pelunasan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                  {filteredReceivables.map((item) => {
                    const discount = Number(item.discount_amount || 0)
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-4 px-5">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{item.customer_name || 'Pelanggan Umum'}</span>
                          </div>
                          {item.customer_phone && (
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 shrink-0" />
                              <span>{item.customer_phone}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-5 font-mono font-bold text-slate-800 whitespace-nowrap">
                          {item.invoice_no}
                        </td>
                        <td className="py-4 px-5 text-slate-500 whitespace-nowrap">
                          {new Date(item.created_at).toLocaleString('id-ID', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="py-4 px-5 text-right font-extrabold text-amber-600 text-sm whitespace-nowrap">
                          <div>Rp {Number(item.total_amount).toLocaleString('id-ID')}</div>
                          {discount > 0 && (
                            <span className="block text-[10px] font-semibold text-emerald-600">
                              Disc -Rp {discount.toLocaleString('id-ID')}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-5 text-center whitespace-nowrap">
                          <button
                            onClick={() => {
                              setSettleMethod('cash')
                              setSettlingTx(item)
                            }}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Lunasi Bon</span>
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

      {/* MODAL PELUNASAN PIUTANG */}
      {settlingTx && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 min-[375px]:p-4 z-50">
          <div className="bg-white rounded-2xl p-4 min-[375px]:p-5 sm:p-6 max-w-sm w-full space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">Pelunasan Tagihan Bon</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pelanggan:{' '}
                  <strong className="text-slate-800">{settlingTx.customer_name || 'Umum'}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettlingTx(null)}
                disabled={submitting}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl flex justify-between items-center">
              <span className="text-xs text-slate-500">Total Dibayar:</span>
              <span className="text-base font-extrabold text-blue-600">
                Rp {Number(settlingTx.total_amount).toLocaleString('id-ID')}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Metode Pembayaran Pelunasan
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
                          ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
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
                onClick={handleSettle}
                disabled={submitting}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{submitting ? 'Memproses...' : 'Konfirmasi Lunas'}</span>
              </button>
              <button
                onClick={() => setSettlingTx(null)}
                disabled={submitting}
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