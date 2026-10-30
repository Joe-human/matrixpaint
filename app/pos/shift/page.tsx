'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

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
  const [cashierInfo, setCashierInfo] = useState<{ id: string; name: string; outletId: string; outletName: string } | null>(null)

  // Input Form Shift
  const [initialCashInput, setInitialCashInput] = useState('')
  const [actualCashInput, setActualCashInput] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Metric Realtime Shift
  const [cashSales, setCashSales] = useState(0)
  const [nonCashSales, setNonCashSales] = useState(0)
  const [unpaidSales, setUnpaidSales] = useState(0)

  useEffect(() => {
    initShiftSession()
  }, [])

  const initShiftSession = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: userData } = await supabase
        .from('users')
        .select('id, name, outlet_id, outlets(name)')
        .eq('email', session.user.email)
        .single()

      if (userData && userData.outlet_id) {
        setCashierInfo({
          id: userData.id,
          name: userData.name,
          outletId: userData.outlet_id,
          outletName: (userData.outlets as any)?.name || 'Cabang Store',
        })

        // Cek shift aktif kasir ini
        const { data: shift } = await supabase
          .from('cashier_shifts')
          .select('*')
          .eq('cashier_id', userData.id)
          .eq('status', 'open')
          .order('start_time', { ascending: false })
          .maybeSingle()

        if (shift) {
          setActiveShift(shift as ShiftData)
          fetchShiftTransactions(shift.start_time, userData.outlet_id, userData.id)
        }
      }
    } catch (err) {
      console.error('Gagal memuat sesi shift:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchShiftTransactions = async (startTime: string, outletId: string, cashierId: string) => {
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
  }

  // 1. Buka Shift Kasir
  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cashierInfo) return
    const initAmt = Number(initialCashInput) || 0

    try {
      setSubmitting(true)
      const { data, error } = await supabase
        .from('cashier_shifts')
        .insert([{
          cashier_id: cashierInfo.id,
          outlet_id: cashierInfo.outletId,
          initial_cash: initAmt,
          status: 'open',
          start_time: new Date().toISOString()
        }])
        .select()
        .single()

      if (error) throw error
      setActiveShift(data as ShiftData)
      setInitialCashInput('')
      fetchShiftTransactions(data.start_time, cashierInfo.outletId, cashierInfo.id)
    } catch (err: any) {
      alert(`Gagal membuka shift: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  // 2. Tutup Shift & Rekonsiliasi Kas Laci
  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault()
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
          status: 'closed'
        })
        .eq('id', activeShift.id)

      if (error) throw error

      alert('Shift berhasil ditutup! Laporan rekonsiliasi kas telah tersimpan.')
      setActiveShift(null)
      setActualCashInput('')
    } catch (err: any) {
      alert(`Gagal menutup shift: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">Memuat status shift kasir...</div>
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Shift & Rekonsiliasi Kas Kasir</h1>
          <p className="text-xs text-slate-500 mt-1">
            Kasir: <span className="font-semibold text-slate-800">{cashierInfo?.name}</span> | Outlet: <span className="font-semibold text-blue-600">{cashierInfo?.outletName}</span>
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${activeShift ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'}`}>
          {activeShift ? '🟢 SHIFT AKTIF BERJALAN' : '⚪ SHIFT BELUM DIBUKA'}
        </span>
      </div>

      {!activeShift ? (
        /* Form Buka Shift */
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-lg mx-auto space-y-4">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">Buka Shift Baru (Clock-In)</h2>
          <form onSubmit={handleOpenShift} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Modal Kas Awal di Laci (Rp)</label>
              <input
                type="number"
                min="0"
                required
                placeholder="Contoh: 200000"
                value={initialCashInput}
                onChange={(e) => setInitialCashInput(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">Uang pecahan/kembalian fisik yang tersedia saat membuka toko.</p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs transition shadow-md shadow-blue-600/20 disabled:opacity-50"
            >
              {submitting ? 'Memproses...' : 'Buka Shift Sekarang'}
            </button>
          </form>
        </div>
      ) : (
        /* Status Shift & Form Tutup Shift */
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Modal Awal</p>
              <p className="text-lg font-bold text-slate-900 mt-1">Rp {Number(activeShift.initial_cash).toLocaleString('id-ID')}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Penjualan Tunai (Cash)</p>
              <p className="text-lg font-bold text-emerald-600 mt-1">Rp {cashSales.toLocaleString('id-ID')}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase">QRIS / Bank Transfer</p>
              <p className="text-lg font-bold text-blue-600 mt-1">Rp {nonCashSales.toLocaleString('id-ID')}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Piutang / Bon Pelanggan</p>
              <p className="text-lg font-bold text-amber-600 mt-1">Rp {unpaidSales.toLocaleString('id-ID')}</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 max-w-lg mx-auto">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">Tutup Shift & Hitung Kas Laci</h2>

            <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Estimasi Uang Tunai Laci (Modal + Cash):</span>
                <span className="font-bold text-slate-900">Rp {(Number(activeShift.initial_cash) + cashSales).toLocaleString('id-ID')}</span>
              </div>
            </div>

            <form onSubmit={handleCloseShift} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Jumlah Uang Fisik Hasil Hitung (Rp)</label>
                <input
                  type="number"
                  min="0"
                  required
                  placeholder="Hitung total uang fisik di laci saat ini..."
                  value={actualCashInput}
                  onChange={(e) => setActualCashInput(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              {actualCashInput !== '' && (
                <div className={`p-3 rounded-xl text-xs font-semibold border ${
                  (Number(actualCashInput) - (Number(activeShift.initial_cash) + cashSales)) === 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  Selisih Kas Laci: Rp {(Number(actualCashInput) - (Number(activeShift.initial_cash) + cashSales)).toLocaleString('id-ID')}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl text-xs transition shadow-md shadow-red-600/20 disabled:opacity-50"
              >
                {submitting ? 'Memproses...' : 'Selesaikan Shift & Tutup Kas'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}