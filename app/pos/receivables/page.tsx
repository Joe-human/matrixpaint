'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  HandCoins,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  User,
  Phone,
  Calendar,
  MapPin,
  FileText,
  Banknote,
  QrCode,
  CreditCard,
} from 'lucide-react'

interface ReceivableItem {
  id: string
  invoice_no: string
  total_amount: number
  customer_name: string | null
  customer_phone: string | null
  payment_status: 'unpaid' | 'paid'
  created_at: string
}

export default function POSReceivablesPage() {
  const [receivables, setReceivables] = useState<ReceivableItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [outletName, setOutletName] = useState('')
  const [search, setSearch] = useState('')

  // Modal & State Pelunasan
  const [confirmTx, setConfirmTx] = useState<ReceivableItem | null>(null)
  const [settleMethod, setSettleMethod] = useState<'cash' | 'qris' | 'transfer'>('cash')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  )

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev))
    }, 5000)
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

      if (userData?.outlet_id) {
        setOutletName((userData.outlets as any)?.name || 'Cabang Store')

        const { data, error } = await supabase
          .from('transactions')
          .select(
            'id, invoice_no, total_amount, customer_name, customer_phone, payment_status, created_at'
          )
          .eq('outlet_id', userData.outlet_id)
          .eq('payment_status', 'unpaid')
          .order('created_at', { ascending: false })

        if (error) throw error
        if (data) setReceivables(data as unknown as ReceivableItem[])
      }
    } catch (err) {
      console.error('Gagal memuat data piutang:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchReceivables()
  }, [fetchReceivables])

  const openSettleModal = (tx: ReceivableItem) => {
    setSettleMethod('cash')
    setConfirmTx(tx)
  }

  const handleSettle = async () => {
    if (!confirmTx) return
    const tx = confirmTx

    try {
      setProcessingId(tx.id)

      const { data, error } = await supabase
        .from('transactions')
        .update({
          payment_status: 'paid',
          payment_method: settleMethod,
        })
        .eq('id', tx.id)
        .select()

      if (error) throw error

      if (!data || data.length === 0) {
        throw new Error(
          'Gagal memperbarui status. Pastikan izin RLS pada tabel transactions memperbolehkan UPDATE.'
        )
      }

      setReceivables((prev) => prev.filter((item) => item.id !== tx.id))
      setConfirmTx(null)
      showFeedback(
        'success',
        `Bon ${tx.invoice_no} (${tx.customer_name || 'Pelanggan'}) sebesar Rp ${Number(
          tx.total_amount
        ).toLocaleString('id-ID')} berhasil dilunasi via ${settleMethod.toUpperCase()}!`
      )
    } catch (err: any) {
      console.error('Error pelunasan:', err)
      showFeedback('error', `Gagal memproses pelunasan: ${err.message || 'Terjadi kesalahan'}`)
      setConfirmTx(null)
    } finally {
      setProcessingId(null)
    }
  }

  const filtered = receivables.filter((r) => {
    const q = search.toLowerCase()
    return (
      (r.customer_name || '').toLowerCase().includes(q) ||
      (r.invoice_no || '').toLowerCase().includes(q) ||
      (r.customer_phone || '').includes(search)
    )
  })

  const totalUnpaidAmount = receivables.reduce((sum, r) => sum + Number(r.total_amount || 0), 0)

  return (
    <div className="p-3 min-[375px]:p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 max-w-6xl mx-auto space-y-5 sm:space-y-6">
      {/* HEADER & TOTAL PIUTANG */}
      <div className="bg-white p-4 min-[375px]:p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="min-w-0">
          <h1 className="text-lg min-[375px]:text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <HandCoins className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 shrink-0" />
            <span>Pelunasan Bon & Piutang</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>Cabang:</span>
            <span className="inline-flex items-center gap-1 font-semibold text-blue-600">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{outletName || '...'}</span>
            </span>
          </p>
        </div>

        <div className="w-full sm:w-auto bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-xl flex sm:block items-center justify-between sm:text-right shrink-0">
          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
            Total Piutang Aktif
          </p>
          <p className="text-sm sm:text-base font-black text-amber-900 sm:mt-0.5">
            Rp {totalUnpaidAmount.toLocaleString('id-ID')}
          </p>
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

      {/* TABEL / CARD PIUTANG */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-3.5 min-[375px]:p-4 sm:px-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama, no. HP, atau invoice..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={() => fetchReceivables(true)}
            disabled={refreshing || loading}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 rounded-xl text-xs font-semibold transition inline-flex items-center justify-center gap-1.5 disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Memuat...' : 'Refresh'}</span>
          </button>
        </div>

        {loading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-16 bg-slate-100 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-14 px-4 text-center space-y-1.5">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs sm:text-sm font-semibold text-slate-600">
              Tidak ada catatan bon / piutang aktif
            </p>
            <p className="text-[11px] text-slate-400">
              Semua tagihan pelanggan saat ini sudah lunas atau tidak cocok dengan pencarian.
            </p>
          </div>
        ) : (
          <>
            {/* TAMPILAN MOBILE (< 768px): CARD LIST */}
            <div className="md:hidden divide-y divide-slate-100">
              {filtered.map((item) => (
                <div key={item.id} className="p-3.5 min-[375px]:p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {item.invoice_no || item.id.slice(0, 8)}
                      </span>
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 mt-1 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{item.customer_name || 'Tanpa Nama'}</span>
                      </h3>
                    </div>

                    <span className="text-xs sm:text-sm font-black text-amber-600 shrink-0">
                      Rp {Number(item.total_amount).toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 bg-slate-50 px-3 py-2 rounded-xl">
                    <span className="inline-flex items-center gap-1 truncate">
                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{item.customer_phone || '-'}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 shrink-0">
                      <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>
                        {new Date(item.created_at).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </span>
                  </div>

                  <button
                    onClick={() => openSettleModal(item)}
                    disabled={processingId === item.id}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {processingId === item.id ? 'Memproses...' : 'Terima Pelunasan'}
                    </span>
                  </button>
                </div>
              ))}
            </div>

            {/* TAMPILAN DESKTOP / TABLET (>= 768px): TABEL */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                    <th className="py-3.5 px-5">No. Invoice</th>
                    <th className="py-3.5 px-5">Nama Pelanggan</th>
                    <th className="py-3.5 px-5">No. HP</th>
                    <th className="py-3.5 px-5">Tanggal Bon</th>
                    <th className="py-3.5 px-5 text-right">Total Tagihan</th>
                    <th className="py-3.5 px-5 text-center">Aksi Pelunasan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                  {filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-5 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {item.invoice_no || item.id.slice(0, 8)}
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-slate-800 whitespace-nowrap">
                        {item.customer_name || 'Tanpa Nama'}
                      </td>
                      <td className="py-3.5 px-5 text-slate-500 whitespace-nowrap">
                        {item.customer_phone || '-'}
                      </td>
                      <td className="py-3.5 px-5 text-slate-500 whitespace-nowrap">
                        {new Date(item.created_at).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3.5 px-5 text-right font-extrabold text-amber-600 whitespace-nowrap">
                        Rp {Number(item.total_amount).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-5 text-center whitespace-nowrap">
                        <button
                          onClick={() => openSettleModal(item)}
                          disabled={processingId === item.id}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-50 inline-flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>
                            {processingId === item.id ? 'Memproses...' : 'Terima Pelunasan'}
                          </span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* MODAL KONFIRMASI PELUNASAN */}
      {confirmTx && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 min-[375px]:p-4 z-50">
          <div className="bg-white rounded-2xl p-4 min-[375px]:p-5 sm:p-6 max-w-sm w-full space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <HandCoins className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900">Konfirmasi Pelunasan Bon</h3>
                <p className="text-xs text-slate-500 mt-1 break-words leading-relaxed">
                  Pelunasan invoice{' '}
                  <span className="font-mono font-bold text-slate-800">{confirmTx.invoice_no}</span>{' '}
                  atas nama{' '}
                  <span className="font-bold text-slate-800">
                    {confirmTx.customer_name || 'Pelanggan'}
                  </span>{' '}
                  sebesar{' '}
                  <span className="font-extrabold text-emerald-600">
                    Rp {Number(confirmTx.total_amount).toLocaleString('id-ID')}
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
                      onClick={() => setSettleMethod(m.id as any)}
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
                onClick={handleSettle}
                disabled={Boolean(processingId)}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {processingId && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{processingId ? 'Memproses...' : 'Konfirmasi Lunas'}</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmTx(null)}
                disabled={Boolean(processingId)}
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