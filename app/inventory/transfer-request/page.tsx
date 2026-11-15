'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeftRight,
  Send,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  X,
  Loader2,
  Package,
  MapPin,
  Building2,
  Calendar,
} from 'lucide-react'

interface Outlet {
  id: string
  name: string
}

interface ProductMaster {
  id: string
  sku: string
  name: string
  brand: string
  unit?: string
}

interface TransferRecord {
  id: string
  qty: number
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  created_at: string
  from_outlet: { name: string } | null
  products: { name: string; sku: string; unit?: string } | null
}

export default function TransferRequestPage() {
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [products, setProducts] = useState<ProductMaster[]>([])
  const [history, setHistory] = useState<TransferRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshingHistory, setRefreshingHistory] = useState(false)

  const [staffInfo, setStaffInfo] = useState<{
    id: string
    companyId: string
    outletId: string
    outletName: string
  } | null>(null)
  const [targetOutlet, setTargetOutlet] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [qty, setQty] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  )

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev))
    }, 5000)
  }

  const fetchTransferHistory = useCallback(async (outletId: string, isManual = false) => {
    if (isManual) setRefreshingHistory(true)
    try {
      const { data } = await supabase
        .from('stock_transfers')
        .select(`
          id,
          qty,
          status,
          created_at,
          from_outlet:outlets!stock_transfers_from_outlet_id_fkey(name),
          products(name, sku, unit)
        `)
        .eq('to_outlet_id', outletId)
        .order('created_at', { ascending: false })

      if (data) setHistory(data as unknown as TransferRecord[])
    } finally {
      if (isManual) setRefreshingHistory(false)
    }
  }, [])

  const initForm = useCallback(async () => {
    try {
      setLoading(true)
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return

      const { data: userData } = await supabase
        .from('users')
        .select('id, company_id, outlet_id, outlets(name)')
        .eq('email', session.user.email)
        .single()

      if (userData && userData.outlet_id) {
        const info = {
          id: userData.id,
          companyId: userData.company_id,
          outletId: userData.outlet_id,
          outletName: (userData.outlets as any)?.name || 'Cabang Store',
        }
        setStaffInfo(info)

        const [outletsRes, productsRes] = await Promise.all([
          supabase
            .from('outlets')
            .select('id, name')
            .neq('id', userData.outlet_id)
            .order('name', { ascending: true }),
          supabase
            .from('products')
            .select('id, sku, name, brand, unit')
            .order('name', { ascending: true }),
          fetchTransferHistory(userData.outlet_id),
        ])

        if (outletsRes.data) setOutlets(outletsRes.data)
        if (productsRes.data) setProducts(productsRes.data as ProductMaster[])
      }
    } catch (err) {
      console.error('Gagal memuat form transfer:', err)
    } finally {
      setLoading(false)
    }
  }, [fetchTransferHistory])

  useEffect(() => {
    initForm()
  }, [initForm])

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!staffInfo) {
      showFeedback('error', 'Sesi pengguna tidak valid atau outlet belum terhubung.')
      return
    }

    const qtyNum = Number(qty)
    if (!qtyNum || qtyNum <= 0) {
      showFeedback('error', 'Jumlah unit yang diajukan harus lebih dari 0.')
      return
    }

    setSubmitting(true)
    setFeedback(null)

    try {
      const { error } = await supabase.from('stock_transfers').insert([
        {
          company_id: staffInfo.companyId,
          from_outlet_id: targetOutlet,
          to_outlet_id: staffInfo.outletId,
          product_id: selectedProduct,
          qty: qtyNum,
          status: 'pending',
          requested_by: staffInfo.id,
        },
      ])

      if (error) throw error

      showFeedback(
        'success',
        'Pengajuan permintaan barang berhasil dikirim! Menunggu persetujuan Admin Pusat.'
      )
      setQty('')
      setSelectedProduct('')
      setTargetOutlet('')
      await fetchTransferHistory(staffInfo.outletId)
    } catch (err: any) {
      showFeedback('error', `Gagal mengirim pengajuan: ${err.message || 'Terjadi kesalahan'}`)
    } finally {
      setSubmitting(false)
    }
  }

  const renderStatusBadge = (status: TransferRecord['status']) => {
    if (status === 'completed') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Selesai (Diterima)
        </span>
      )
    }
    if (status === 'approved') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Disetujui (Kirim)
        </span>
      )
    }
    if (status === 'rejected') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
          <XCircle className="w-3 h-3" /> Ditolak
        </span>
      )
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
        <Clock className="w-3 h-3" /> Menunggu
      </span>
    )
  }

  return (
    <div className="p-3 min-[375px]:p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 max-w-7xl mx-auto space-y-5 sm:space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-lg min-[375px]:text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 shrink-0" />
          <span>Pengajuan Transfer Stok Antar Cabang</span>
        </h1>
        <p className="text-[11px] sm:text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-1.5">
          <span>Cabang Pemohon:</span>
          <span className="inline-flex items-center gap-1 font-semibold text-blue-600">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span>{staffInfo?.outletName || '...'}</span>
          </span>
        </p>
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
        {/* PANEL FORM PENGAJUAN (KIRI) */}
        <div className="bg-white p-4 min-[375px]:p-5 sm:p-6 border border-slate-200/90 rounded-2xl shadow-sm space-y-4 h-fit">
          <h2 className="text-xs sm:text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            Buat Pengajuan Baru
          </h2>

          <form onSubmit={handleCreateRequest} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Minta Kiriman Dari Cabang *
              </label>
              <select
                required
                value={targetOutlet}
                onChange={(e) => setTargetOutlet(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50 focus:outline-none focus:bg-white focus:border-blue-500 transition"
              >
                <option value="">-- Pilih Cabang Pengirim --</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Produk Cat Yang Dibutuhkan *
              </label>
              <select
                required
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50 focus:outline-none focus:bg-white focus:border-blue-500 transition"
              >
                <option value="">-- Pilih Produk Cat --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.sku}] {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Jumlah Item (Qty) *
              </label>
              <input
                type="number"
                required
                min="1"
                placeholder="Contoh: 10"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50 focus:outline-none focus:bg-white focus:border-blue-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/20 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>{submitting ? 'Mengirim Pengajuan...' : 'Kirim Pengajuan Ke Pusat'}</span>
            </button>
          </form>
        </div>

        {/* PANEL HISTORI STATUS TRANSFER (KANAN) */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 sm:px-6 border-b border-slate-100 flex justify-between items-center gap-2">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">
              Histori Pengajuan Transfer
            </h2>
            <button
              onClick={() => staffInfo && fetchTransferHistory(staffInfo.outletId, true)}
              disabled={refreshingHistory || loading}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingHistory ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {loading ? (
            <div className="p-5 space-y-3 animate-pulse">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-16 bg-slate-100 rounded-xl" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-14 px-4 space-y-1.5">
              <Package className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs sm:text-sm font-semibold text-slate-600">
                Belum ada pengajuan transfer barang
              </p>
              <p className="text-[11px] text-slate-400">
                Gunakan formulir di samping untuk meminta suplai stok dari cabang lain.
              </p>
            </div>
          ) : (
            <>
              {/* TAMPILAN MOBILE (< 768px): CARD LIST */}
              <div className="md:hidden divide-y divide-slate-100">
                {history.map((item) => (
                  <div key={item.id} className="p-3.5 min-[375px]:p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          {item.products?.sku || '-'}
                        </span>
                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 mt-1 break-words">
                          {item.products?.name || 'Produk'}
                        </h3>
                      </div>
                      <div className="shrink-0">{renderStatusBadge(item.status)}</div>
                    </div>

                    <div className="flex items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl text-[11px]">
                      <div className="flex items-center gap-1.5 text-slate-600 min-w-0">
                        <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="truncate">
                          Dari: <strong className="text-slate-800">{item.from_outlet?.name || '-'}</strong>
                        </span>
                      </div>
                      <span className="font-extrabold text-blue-600 shrink-0">
                        {item.qty} {item.products?.unit || 'unit'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Calendar className="w-3 h-3 shrink-0" />
                      <span>
                        Diajukan{' '}
                        {new Date(item.created_at).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* TAMPILAN DESKTOP / TABLET (>= 768px): TABEL */}
              <div className="hidden md:block overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                      <th className="py-3.5 px-5">Produk</th>
                      <th className="py-3.5 px-5">Dari Cabang</th>
                      <th className="py-3.5 px-5 text-center">Qty</th>
                      <th className="py-3.5 px-5 text-center">Status</th>
                      <th className="py-3.5 px-5 text-right">Waktu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                    {history.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-5 font-medium text-slate-900">
                          <div>{item.products?.name || 'Produk'}</div>
                          <span className="block text-[10px] text-slate-400 font-mono">
                            {item.products?.sku}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-slate-600 whitespace-nowrap">
                          {item.from_outlet?.name || '-'}
                        </td>
                        <td className="py-3.5 px-5 text-center font-extrabold text-blue-600 whitespace-nowrap">
                          {item.qty}
                        </td>
                        <td className="py-3.5 px-5 text-center whitespace-nowrap">
                          {renderStatusBadge(item.status)}
                        </td>
                        <td className="py-3.5 px-5 text-right text-slate-400 whitespace-nowrap">
                          {new Date(item.created_at).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}