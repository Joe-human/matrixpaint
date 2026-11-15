'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  X,
  Loader2,
  Package,
  Calendar,
} from 'lucide-react'

interface TransferRequest {
  id: string
  created_at: string
  status: string
  qty: number
  from_outlet_id: string
  to_outlet_id: string
  product_id: string
  from_outlet: { name: string } | null
  to_outlet: { name: string } | null
  products: { name: string; sku: string; unit?: string } | null
}

export default function AdminTransferApprovalPage() {
  const [requests, setRequests] = useState<TransferRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'pending' | 'approved' | 'rejected'>(
    'ALL'
  )
  const [processingId, setProcessingId] = useState<string | null>(null)

  // Banner Notifikasi Non-Blocking
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  )

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev))
    }, 5000)
  }

  const fetchTransferRequests = useCallback(async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('stock_transfers')
        .select(`
          id,
          created_at,
          status,
          qty,
          from_outlet_id,
          to_outlet_id,
          product_id,
          from_outlet:outlets!from_outlet_id(name),
          to_outlet:outlets!to_outlet_id(name),
          products(name, sku, unit)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      if (data) setRequests(data as unknown as TransferRequest[])
    } catch (err) {
      console.error('Gagal memuat data permintaan mutasi:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTransferRequests()
  }, [fetchTransferRequests])

  const handleApprove = async (req: TransferRequest) => {
    if (processingId) return
    setProcessingId(req.id)

    try {
      const { error: rpcError } = await supabase.rpc('process_stock_transfer', {
        p_from_outlet_id: req.from_outlet_id,
        p_to_outlet_id: req.to_outlet_id,
        p_product_id: req.product_id,
        p_qty: req.qty,
      })

      if (rpcError) {
        showFeedback('error', `Gagal menyetujui mutasi: ${rpcError.message}`)
        return
      }

      const { error: updateError } = await supabase
        .from('stock_transfers')
        .update({ status: 'approved' })
        .eq('id', req.id)

      if (updateError) throw updateError

      showFeedback(
        'success',
        `Mutasi ${req.qty} unit "${req.products?.name || 'Produk'}" disetujui! Stok cabang otomatis disesuaikan.`
      )
      fetchTransferRequests()
    } catch (err: any) {
      showFeedback('error', `Terjadi kesalahan: ${err.message || 'Gagal memproses mutasi'}`)
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (req: TransferRequest) => {
    if (processingId) return
    setProcessingId(req.id)

    try {
      const { error } = await supabase
        .from('stock_transfers')
        .update({ status: 'rejected' })
        .eq('id', req.id)

      if (error) throw error

      showFeedback(
        'success',
        `Pengajuan mutasi "${req.products?.name || 'Produk'}" telah ditolak.`
      )
      fetchTransferRequests()
    } catch (err: any) {
      showFeedback('error', `Gagal menolak pengajuan: ${err.message || 'Terjadi kesalahan'}`)
    } finally {
      setProcessingId(null)
    }
  }

  const pendingCount = requests.filter((r) => r.status === 'pending').length

  const filteredRequests = requests.filter((r) => {
    if (statusFilter === 'ALL') return true
    return r.status === statusFilter
  })

  const renderStatusBadge = (status: string) => {
    if (status === 'approved') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Disetujui
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
    <div className="p-3 min-[375px]:p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 max-w-7xl mx-auto space-y-5 sm:space-y-7">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg min-[375px]:text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 shrink-0" />
            <span>Persetujuan Mutasi Stok Antar Cabang</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
            Pantau dan berikan persetujuan (approval) permintaan transfer barang yang diajukan oleh
            staf gudang antar cabang.
          </p>
        </div>

        {pendingCount > 0 && (
          <div className="self-start sm:self-auto px-3.5 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shrink-0">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>{pendingCount} Menunggu Persetujuan</span>
          </div>
        )}
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

      {/* FILTER TABS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {(
          [
            { key: 'ALL', label: 'Semua' },
            { key: 'pending', label: 'Menunggu' },
            { key: 'approved', label: 'Disetujui' },
            { key: 'rejected', label: 'Ditolak' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
              statusFilter === tab.key
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* DAFTAR PENGAJUAN MUTASI */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between gap-2">
          <span className="font-bold text-xs sm:text-sm text-slate-800">
            Daftar Pengajuan Mutasi Barang
          </span>
          <span className="text-[11px] font-semibold text-slate-400 shrink-0">
            {filteredRequests.length} pengajuan
          </span>
        </div>

        {loading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-20 bg-slate-100 rounded-xl" />
            ))}
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-14 px-4 space-y-1.5">
            <Package className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs sm:text-sm font-semibold text-slate-600">
              Tidak ada pengajuan mutasi barang
            </p>
            <p className="text-[11px] text-slate-400">
              Permintaan transfer stok antar cabang dari staf gudang akan muncul di sini.
            </p>
          </div>
        ) : (
          <>
            {/* TAMPILAN MOBILE (< 768px): CARD LIST */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredRequests.map((item) => {
                const isBusy = processingId === item.id
                return (
                  <div key={item.id} className="p-3.5 min-[375px]:p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {item.products?.sku || '-'}
                        </span>
                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 mt-1 break-words">
                          {item.products?.name || 'Produk Cat'}
                        </h3>
                      </div>
                      <div className="shrink-0">{renderStatusBadge(item.status)}</div>
                    </div>

                    {/* Rute Transfer Cabang */}
                    <div className="bg-slate-50 border border-slate-200/70 p-2.5 rounded-xl flex items-center justify-between gap-2 text-[11px]">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-slate-400">Dari Cabang</p>
                        <p className="font-semibold text-slate-800 truncate">
                          {item.from_outlet?.name || '-'}
                        </p>
                      </div>

                      <ArrowRight className="w-4 h-4 text-blue-500 shrink-0" />

                      <div className="min-w-0 flex-1 text-right">
                        <p className="text-[10px] text-slate-400">Untuk Cabang</p>
                        <p className="font-semibold text-slate-800 truncate">
                          {item.to_outlet?.name || '-'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Calendar className="w-3 h-3 shrink-0" />
                        <span>
                          {new Date(item.created_at).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </span>

                      <span className="font-extrabold text-blue-600">
                        {item.qty} {item.products?.unit || 'unit'}
                      </span>
                    </div>

                    {item.status === 'pending' && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleApprove(item)}
                          disabled={Boolean(processingId)}
                          className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white rounded-xl text-xs font-semibold transition shadow-sm shadow-blue-600/20 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                        >
                          {isBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>{isBusy ? 'Memproses...' : 'Setujui Mutasi'}</span>
                        </button>
                        <button
                          onClick={() => handleReject(item)}
                          disabled={Boolean(processingId)}
                          className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-semibold transition disabled:opacity-50"
                        >
                          Tolak
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* TAMPILAN DESKTOP / TABLET (>= 768px): TABEL */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                    <th className="py-3.5 px-5">Tanggal</th>
                    <th className="py-3.5 px-5">Produk Cat</th>
                    <th className="py-3.5 px-5">Minta Dari Cabang</th>
                    <th className="py-3.5 px-5">Untuk Cabang</th>
                    <th className="py-3.5 px-5 text-center">Qty</th>
                    <th className="py-3.5 px-5 text-center">Status</th>
                    <th className="py-3.5 px-5 text-center">Aksi Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                  {filteredRequests.map((item) => {
                    const isBusy = processingId === item.id
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-5 text-slate-500 whitespace-nowrap">
                          {new Date(item.created_at).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="font-bold text-slate-900">{item.products?.name}</div>
                          <span className="font-mono text-[10px] text-slate-400">
                            {item.products?.sku || '-'}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 font-medium whitespace-nowrap">
                          {item.from_outlet?.name}
                        </td>
                        <td className="py-3.5 px-5 font-medium whitespace-nowrap">
                          {item.to_outlet?.name}
                        </td>
                        <td className="py-3.5 px-5 text-center font-extrabold text-blue-600 whitespace-nowrap">
                          {item.qty}
                        </td>
                        <td className="py-3.5 px-5 text-center whitespace-nowrap">
                          {renderStatusBadge(item.status)}
                        </td>
                        <td className="py-3.5 px-5 text-center whitespace-nowrap">
                          {item.status === 'pending' ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => handleApprove(item)}
                                disabled={Boolean(processingId)}
                                className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-500 transition shadow-sm shadow-blue-600/20 disabled:opacity-50 inline-flex items-center gap-1"
                              >
                                {isBusy && <Loader2 className="w-3 h-3 animate-spin" />}
                                <span>{isBusy ? 'Proses...' : 'Setujui'}</span>
                              </button>
                              <button
                                onClick={() => handleReject(item)}
                                disabled={Boolean(processingId)}
                                className="px-2.5 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-semibold hover:bg-rose-100 transition disabled:opacity-50"
                              >
                                Tolak
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-medium text-xs">Selesai</span>
                          )}
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
    </div>
  )
}