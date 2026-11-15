'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Clock,
  PlayCircle,
  StopCircle,
  Wallet,
  Banknote,
  QrCode,
  FileText,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  MapPin,
  Calculator,
} from 'lucide-react'

interface ShiftData {
  id: string
  cashier_id: string
  outlet_id: string
  start_time: string
  end_time?: string
  initial_cash: number
  final_cash?: number
  expected_cash?: number
  status: 'open' | 'closed'
}

export default function POSShiftPage() {
  const [activeShift, setActiveShift] = useState<ShiftData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [cashierInfo, setCashierInfo] = useState<{
    id: string
    name: string
    outletId: string
    outletName: string
  } | null>(null)

  // Input Form Shift
  const [initialCashInput, setInitialCashInput] = useState('')
  const [actualCashInput, setActualCashInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showConfirmClose, setShowConfirmClose] = useState(false)

  // Metric Realtime Shift
  const [cashSales, setCashSales] = useState(0)
  const [nonCashSales, setNonCashSales] = useState(0)
  const [unpaidSales, setUnpaidSales] = useState(0)

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  )

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev))
    }, 5000)
  }

  const fetchShiftTransactions = useCallback(
    async (startTime: string, outletId: string, cashierId: string) => {
      const { data: txs } = await supabase
        .from('transactions')
        .select('total_amount, payment_method, payment_status')
        .eq('outlet_id', outletId)
        .eq('cashier_id', cashierId)
        .gte('created_at', startTime)

      if (txs) {
        let cash = 0
        let nonCash = 0
        let unpaid = 0

        txs.forEach((tx) => {
          const amt = Number(tx.total_amount || 0)
          if (tx.payment_status === 'unpaid' || tx.payment_method === 'piutang') {
            unpaid += amt
          } else if (tx.payment_method === 'cash') {
            cash += amt
          } else {
            nonCash += amt
          }
        })

        setCashSales(cash)
        setNonCashSales(nonCash)
        setUnpaidSales(unpaid)
      }
    },
    []
  )

  const initShiftSession = useCallback(async () => {
    try {
      setLoading(true)
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return

      const { data: userData } = await supabase
        .from('users')
        .select('id, name, outlet_id, outlets(name)')
        .eq('email', session.user.email)
        .single()

      if (userData && userData.outlet_id) {
        setCashierInfo({
          id: userData.id,
          name: userData.name || 'Kasir',
          outletId: userData.outlet_id,
          outletName: (userData.outlets as any)?.name || 'Cabang Store',
        })

        const { data: shift } = await supabase
          .from('cashier_shifts')
          .select('*')
          .eq('cashier_id', userData.id)
          .eq('status', 'open')
          .order('start_time', { ascending: false })
          .maybeSingle()

        if (shift) {
          setActiveShift(shift as ShiftData)
          await fetchShiftTransactions(shift.start_time, userData.outlet_id, userData.id)
        }
      }
    } catch (err) {
      console.error('Gagal memuat sesi shift:', err)
    } finally {
      setLoading(false)
    }
  }, [fetchShiftTransactions])

  useEffect(() => {
    initShiftSession()
  }, [initShiftSession])

  const handleManualRefresh = async () => {
    if (!activeShift || !cashierInfo) return
    setRefreshing(true)
    try {
      await fetchShiftTransactions(activeShift.start_time, cashierInfo.outletId, cashierInfo.id)
    } finally {
      setRefreshing(false)
    }
  }

  // 1. Buka Shift Kasir
  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cashierInfo) {
      showFeedback('error', 'Sesi kasir tidak valid.')
      return
    }
    const initAmt = Number(initialCashInput) || 0

    try {
      setSubmitting(true)
      setFeedback(null)

      const { data, error } = await supabase
        .from('cashier_shifts')
        .insert([
          {
            cashier_id: cashierInfo.id,
            outlet_id: cashierInfo.outletId,
            initial_cash: initAmt,
            status: 'open',
            start_time: new Date().toISOString(),
          },
        ])
        .select()
        .single()

      if (error) throw error
      setActiveShift(data as ShiftData)
      setInitialCashInput('')
      setCashSales(0)
      setNonCashSales(0)
      setUnpaidSales(0)
      showFeedback('success', 'Shift kasir berhasil dibuka! Selamat bertugas.')
      await fetchShiftTransactions(data.start_time, cashierInfo.outletId, cashierInfo.id)
    } catch (err: any) {
      showFeedback('error', `Gagal membuka shift: ${err.message || 'Terjadi kesalahan'}`)
    } finally {
      setSubmitting(false)
    }
  }

  // 2. Konfirmasi sebelum Tutup Shift
  const requestCloseShift = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeShift) return
    if (actualCashInput === '' || Number(actualCashInput) < 0) {
      showFeedback('error', 'Masukkan nominal uang fisik hasil hitung di laci terlebih dahulu.')
      return
    }
    setShowConfirmClose(true)
  }

  // 3. Eksekusi Tutup Shift & Rekonsiliasi Kas Laci
  const handleConfirmCloseShift = async () => {
    if (!activeShift) return

    const expectedCash = Number(activeShift.initial_cash) + cashSales
    const actualCash = Number(actualCashInput) || 0

    try {
      setSubmitting(true)
      const { error } = await supabase
        .from('cashier_shifts')
        .update({
          end_time: new Date().toISOString(),
          final_cash: actualCash,
          expected_cash: expectedCash,
          status: 'closed',
        })
        .eq('id', activeShift.id)

      if (error) throw error

      setShowConfirmClose(false)
      setActiveShift(null)
      setActualCashInput('')
      setCashSales(0)
      setNonCashSales(0)
      setUnpaidSales(0)
      showFeedback('success', 'Shift berhasil ditutup! Laporan rekonsiliasi kas telah tersimpan.')
    } catch (err: any) {
      setShowConfirmClose(false)
      showFeedback('error', `Gagal menutup shift: ${err.message || 'Terjadi kesalahan'}`)
    } finally {
      setSubmitting(false)
    }
  }

  const expectedCashTotal = activeShift ? Number(activeShift.initial_cash) + cashSales : 0
  const actualCashNum = Number(actualCashInput) || 0
  const cashDifference = actualCashNum - expectedCashTotal

  if (loading) {
    return (
      <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-5 animate-pulse">
        <div className="h-20 bg-white rounded-2xl border border-slate-200" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-24 bg-white rounded-2xl border border-slate-200" />
          ))}
        </div>
        <div className="h-64 bg-white rounded-2xl border border-slate-200 max-w-lg mx-auto" />
      </div>
    )
  }

  return (
    <div className="p-3 min-[375px]:p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 max-w-5xl mx-auto space-y-5 sm:space-y-6">
      {/* HEADER STATUS SHIFT */}
      <div className="bg-white p-4 min-[375px]:p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5">
        <div className="min-w-0">
          <h1 className="text-lg min-[375px]:text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 shrink-0" />
            <span>Shift & Rekonsiliasi Kas Kasir</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>
              Kasir: <strong className="text-slate-800">{cashierInfo?.name || '...'}</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center gap-1 font-semibold text-blue-600">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{cashierInfo?.outletName || '...'}</span>
            </span>
          </p>
          {activeShift && (
            <p className="text-[11px] text-slate-400 mt-1">
              Mulai shift:{' '}
              {new Date(activeShift.start_time).toLocaleString('id-ID', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
          <span
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1.5 ${
              activeShift
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                activeShift ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`}
            />
            <span>{activeShift ? 'SHIFT AKTIF' : 'BELUM DIBUKA'}</span>
          </span>

          {activeShift && (
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition disabled:opacity-50"
              title="Refresh Rekap Shift"
              aria-label="Refresh Rekap Shift"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
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

      {!activeShift ? (
        /* FORM BUKA SHIFT */
        <div className="bg-white p-4 min-[375px]:p-6 rounded-2xl border border-slate-200/90 shadow-sm max-w-lg mx-auto space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <PlayCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Buka Shift Baru (Clock-In)</h2>
              <p className="text-[11px] text-slate-400">
                Catat modal awal di laci sebelum memulai transaksi kasir.
              </p>
            </div>
          </div>

          <form onSubmit={handleOpenShift} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Modal Kas Awal di Laci (Rp) *
              </label>
              <input
                type="number"
                min="0"
                required
                placeholder="Contoh: 200000"
                value={initialCashInput}
                onChange={(e) => setInitialCashInput(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 transition"
              />
              <p className="text-[11px] text-slate-400 mt-1.5">
                Uang pecahan atau kembalian fisik yang tersedia saat membuka laci kasir.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-bold rounded-xl text-xs transition shadow-md shadow-blue-600/20 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <PlayCircle className="w-4 h-4" />
              )}
              <span>{submitting ? 'Memproses...' : 'Buka Shift Sekarang'}</span>
            </button>
          </form>
        </div>
      ) : (
        /* STATUS SHIFT & FORM TUTUP SHIFT */
        <div className="space-y-5 sm:space-y-6">
          {/* 4 KARTU METRIK OMZET SHIFT */}
          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Modal Awal</p>
                <Wallet className="w-4 h-4 text-slate-400 shrink-0" />
              </div>
              <p className="text-base sm:text-lg font-extrabold text-slate-900 mt-2 truncate">
                Rp {Number(activeShift.initial_cash).toLocaleString('id-ID')}
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Penjualan Tunai</p>
                <Banknote className="w-4 h-4 text-emerald-500 shrink-0" />
              </div>
              <p className="text-base sm:text-lg font-extrabold text-emerald-600 mt-2 truncate">
                Rp {cashSales.toLocaleString('id-ID')}
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase">QRIS / Transfer</p>
                <QrCode className="w-4 h-4 text-blue-500 shrink-0" />
              </div>
              <p className="text-base sm:text-lg font-extrabold text-blue-600 mt-2 truncate">
                Rp {nonCashSales.toLocaleString('id-ID')}
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Piutang / Bon</p>
                <FileText className="w-4 h-4 text-amber-500 shrink-0" />
              </div>
              <p className="text-base sm:text-lg font-extrabold text-amber-600 mt-2 truncate">
                Rp {unpaidSales.toLocaleString('id-ID')}
              </p>
            </div>
          </div>

          {/* FORM REKONSILIASI & TUTUP SHIFT */}
          <div className="bg-white p-4 min-[375px]:p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4 max-w-lg mx-auto">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Calculator className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Tutup Shift & Hitung Kas Laci</h2>
                <p className="text-[11px] text-slate-400">
                  Bandingkan catatan sistem dengan uang tunai fisik di laci.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-500">Modal Awal Laci</span>
                <span className="font-semibold text-slate-700">
                  Rp {Number(activeShift.initial_cash).toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-500">Penjualan Tunai (Cash)</span>
                <span className="font-semibold text-emerald-600">
                  + Rp {cashSales.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="border-t border-slate-200 pt-1.5 flex justify-between items-center gap-2">
                <span className="font-bold text-slate-700">Estimasi Uang Tunai Laci</span>
                <span className="font-black text-slate-900">
                  Rp {expectedCashTotal.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <form onSubmit={requestCloseShift} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Jumlah Uang Fisik Hasil Hitung (Rp) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  placeholder="Hitung total uang fisik di laci saat ini..."
                  value={actualCashInput}
                  onChange={(e) => setActualCashInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 transition"
                />
              </div>

              {actualCashInput !== '' && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold border flex items-center justify-between gap-2 ${
                    cashDifference === 0
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : cashDifference > 0
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  <span>
                    {cashDifference === 0
                      ? 'Kas Sesuai (Klop)'
                      : cashDifference > 0
                        ? 'Selisih Lebih'
                        : 'Selisih Kurang'}
                  </span>
                  <span>
                    {cashDifference > 0 ? '+' : ''}Rp {cashDifference.toLocaleString('id-ID')}
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-rose-600 hover:bg-rose-500 active:scale-[0.99] text-white font-bold rounded-xl text-xs transition shadow-md shadow-rose-600/20 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                <StopCircle className="w-4 h-4" />
                <span>Selesaikan Shift & Tutup Kas</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI TUTUP SHIFT */}
      {showConfirmClose && activeShift && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 min-[375px]:p-4 z-50">
          <div className="bg-white rounded-2xl p-4 min-[375px]:p-5 sm:p-6 max-w-sm w-full space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <StopCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900">Konfirmasi Tutup Shift</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Pastikan perhitungan uang fisik di laci sudah benar sebelum mengunci laporan shift.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Estimasi Sistem:</span>
                <span className="font-bold text-slate-800">
                  Rp {expectedCashTotal.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Uang Fisik Laci:</span>
                <span className="font-bold text-slate-900">
                  Rp {actualCashNum.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5">
                <span className="text-slate-500">Selisih:</span>
                <span
                  className={`font-extrabold ${
                    cashDifference === 0
                      ? 'text-emerald-600'
                      : cashDifference > 0
                        ? 'text-blue-600'
                        : 'text-rose-600'
                  }`}
                >
                  {cashDifference > 0 ? '+' : ''}Rp {cashDifference.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleConfirmCloseShift}
                disabled={submitting}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{submitting ? 'Menutup...' : 'Ya, Tutup Shift'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmClose(false)}
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