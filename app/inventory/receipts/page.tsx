'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  PackageCheck,
  Truck,
  Building2,
  CheckCircle2,
  Clock,
  RefreshCw,
  Loader2,
  Boxes,
  AlertCircle,
  X,
  MapPin,
} from 'lucide-react'

interface IncomingTransfer {
  id: string
  parent_id: string
  reference_no: string
  qty: number
  status: string
  created_at: string
  source_name: string
  type: 'interbranch' | 'supplier'
  products: { id: string; name: string; sku: string; unit: string } | null
}

export default function GoodsReceiptPage() {
  const [activeTab, setActiveTab] = useState<'interbranch' | 'supplier'>('interbranch')
  const [incomingList, setIncomingList] = useState<IncomingTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [staffInfo, setStaffInfo] = useState<{
    id: string
    outletId: string
    outletName: string
  } | null>(null)

  // Modal konfirmasi & feedback banner
  const [confirmItem, setConfirmItem] = useState<IncomingTransfer | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  )

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev))
    }, 5000)
  }

  const fetchIncomingItems = useCallback(
    async (outletId: string, tab: 'interbranch' | 'supplier', isManual = false) => {
      if (isManual) setRefreshing(true)
      else setLoading(true)

      try {
        if (tab === 'interbranch') {
          const { data, error } = await supabase
            .from('stock_transfers')
            .select(`
              id,
              qty,
              status,
              created_at,
              from_outlet:outlets!stock_transfers_from_outlet_id_fkey(name),
              products(id, name, sku, unit)
            `)
            .eq('to_outlet_id', outletId)
            .in('status', ['approved', 'completed'])
            .order('created_at', { ascending: false })

          if (error) throw error

          if (data) {
            const formatted: IncomingTransfer[] = data.map((item: any) => ({
              id: item.id,
              parent_id: item.id,
              reference_no: `TRF-${item.id.slice(0, 6).toUpperCase()}`,
              qty: Number(item.qty || 0),
              status: item.status,
              created_at: item.created_at,
              source_name: item.from_outlet?.name || 'Pusat / Cabang',
              type: 'interbranch',
              products: item.products,
            }))
            setIncomingList(formatted)
          }
        } else {
          const { data, error } = await supabase
            .from('po_items')
            .select(`
              id,
              quantity,
              purchase_orders!inner(
                id,
                po_number,
                status,
                created_at,
                outlet_id,
                suppliers(name)
              ),
              products(id, name, sku, unit)
            `)
            .eq('purchase_orders.outlet_id', outletId)
            .neq('purchase_orders.status', 'cancelled')
            .order('created_at', { ascending: false })

          if (error) throw error

          if (data) {
            const formatted: IncomingTransfer[] = data.map((item: any) => ({
              id: item.id,
              parent_id: item.purchase_orders?.id || item.id,
              reference_no: item.purchase_orders?.po_number || 'PO-VENDOR',
              qty: Number(item.quantity || 0),
              status: item.purchase_orders?.status || 'ordered',
              created_at: item.purchase_orders?.created_at,
              source_name: item.purchase_orders?.suppliers?.name || 'Vendor Luar',
              type: 'supplier',
              products: item.products,
            }))
            setIncomingList(formatted)
          }
        }
      } catch (err) {
        console.error('Error fetching incoming items:', err)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    []
  )

  useEffect(() => {
    let isMounted = true

    const initPage = async () => {
      try {
        setLoading(true)
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session) return

        const { data: userData } = await supabase
          .from('users')
          .select('id, outlet_id, outlets(name)')
          .eq('email', session.user.email)
          .single()

        if (!isMounted) return

        if (userData && userData.outlet_id) {
          const outletData = {
            id: userData.id,
            outletId: userData.outlet_id,
            outletName: (userData.outlets as any)?.name || 'Cabang Store',
          }
          setStaffInfo(outletData)
          await fetchIncomingItems(outletData.outletId, 'interbranch')
        } else {
          setLoading(false)
        }
      } catch (err) {
        console.error('Error init page:', err)
        if (isMounted) setLoading(false)
      }
    }

    initPage()

    return () => {
      isMounted = false
    }
  }, [fetchIncomingItems])

  const handleTabChange = (tab: 'interbranch' | 'supplier') => {
    setActiveTab(tab)
    if (staffInfo) {
      fetchIncomingItems(staffInfo.outletId, tab)
    }
  }

  const executeConfirmReceipt = async () => {
    if (!confirmItem || !staffInfo || !confirmItem.products) return
    const item = confirmItem
    const product = confirmItem.products

    try {
      setProcessingId(item.id)

      // 1. Tambahkan stok barang ke outlet_stocks cabang tujuan
      const { data: existingStock, error: fetchStockErr } = await supabase
        .from('outlet_stocks')
        .select('stock')
        .eq('outlet_id', staffInfo.outletId)
        .eq('product_id', product.id)
        .maybeSingle()

      if (fetchStockErr) throw fetchStockErr

      if (existingStock) {
        const newStock = Number(existingStock.stock || 0) + Number(item.qty)
        const { error: updStockErr } = await supabase
          .from('outlet_stocks')
          .update({ stock: newStock })
          .eq('outlet_id', staffInfo.outletId)
          .eq('product_id', product.id)

        if (updStockErr) throw updStockErr
      } else {
        const { error: insStockErr } = await supabase.from('outlet_stocks').insert([
          {
            outlet_id: staffInfo.outletId,
            product_id: product.id,
            stock: item.qty,
            min_stock: 3,
          },
        ])

        if (insStockErr) throw insStockErr
      }

      // 2. Ubah status transaksi (Transfer -> completed | PO -> received)
      if (item.type === 'interbranch') {
        const { error: updateError } = await supabase
          .from('stock_transfers')
          .update({ status: 'completed' })
          .eq('id', item.id)

        if (updateError) throw updateError
      } else {
        const { error: updateError } = await supabase
          .from('purchase_orders')
          .update({ status: 'received' })
          .eq('id', item.parent_id)

        if (updateError) throw updateError
      }

      showFeedback(
        'success',
        `Penerimaan "${product.name}" (+${item.qty} ${
          product.unit || 'unit'
        }) dikonfirmasi! Stok gudang diperbarui.`
      )
      setConfirmItem(null)
      await fetchIncomingItems(staffInfo.outletId, activeTab)
    } catch (err: any) {
      showFeedback('error', `Gagal mengonfirmasi penerimaan: ${err.message || 'Terjadi kesalahan'}`)
      setConfirmItem(null)
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="p-3 min-[375px]:p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 max-w-7xl mx-auto space-y-5 sm:space-y-6">
      {/* HEADER INFO OUTLET */}
      <div className="bg-white border border-slate-200/90 p-4 min-[375px]:p-5 sm:p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5">
        <div className="min-w-0">
          <h1 className="text-lg min-[375px]:text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <PackageCheck className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 shrink-0" />
            <span>Penerimaan Barang Masuk</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-1.5">
            <span>Konfirmasi fisik barang masuk ke gudang:</span>
            <span className="inline-flex items-center gap-1 font-semibold text-blue-600">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{staffInfo?.outletName || '...'}</span>
            </span>
          </p>
        </div>

        <button
          onClick={() => staffInfo && fetchIncomingItems(staffInfo.outletId, activeTab, true)}
          disabled={refreshing || loading}
          className="w-full sm:w-auto px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 rounded-xl text-xs font-semibold transition inline-flex items-center justify-center gap-1.5 disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Menyinkronkan...' : 'Refresh Data'}</span>
        </button>
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

      {/* TABS MENU (TRANSFER CABANG VS PO SUPPLIER) */}
      <div className="grid grid-cols-2 sm:inline-flex bg-white p-1 rounded-2xl border border-slate-200/90 shadow-xs gap-1 w-full sm:w-auto">
        <button
          onClick={() => handleTabChange('interbranch')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold transition inline-flex items-center justify-center gap-1.5 ${
            activeTab === 'interbranch'
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Building2 className="w-4 h-4 shrink-0" />
          <span className="truncate">Transfer Cabang</span>
        </button>

        <button
          onClick={() => handleTabChange('supplier')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold transition inline-flex items-center justify-center gap-1.5 ${
            activeTab === 'supplier'
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Truck className="w-4 h-4 shrink-0" />
          <span className="truncate">PO Supplier</span>
        </button>
      </div>

      {/* DATA CONTAINER */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between gap-2">
          <span className="font-bold text-xs sm:text-sm text-slate-800">
            {activeTab === 'interbranch'
              ? 'Antrean Kiriman Antar Cabang'
              : 'Antrean Barang Masuk dari Supplier (PO)'}
          </span>
          <span className="text-[11px] font-semibold text-slate-400 shrink-0">
            {incomingList.length} item
          </span>
        </div>

        {loading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-20 bg-slate-100 rounded-xl" />
            ))}
          </div>
        ) : incomingList.length === 0 ? (
          <div className="text-center py-14 px-4 space-y-1.5">
            <Boxes className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs sm:text-sm font-semibold text-slate-600">
              Tidak ada antrean kiriman barang masuk
            </p>
            <p className="text-[11px] text-slate-400">
              Kiriman yang sudah disetujui akan muncul di sini untuk dikonfirmasi.
            </p>
          </div>
        ) : (
          <>
            {/* TAMPILAN MOBILE (< 768px): CARD LIST */}
            <div className="md:hidden divide-y divide-slate-100">
              {incomingList.map((item) => {
                const isDone = item.status === 'completed' || item.status === 'received'
                const isBusy = processingId === item.id
                return (
                  <div key={item.id} className="p-3.5 min-[375px]:p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-1.5 py-0.5 rounded">
                            {item.reference_no}
                          </span>
                          {item.products?.sku && (
                            <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              {item.products.sku}
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 mt-1.5 break-words">
                          {item.products?.name || 'Produk Cat'}
                        </h3>
                      </div>

                      {isDone ? (
                        <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold rounded-full inline-flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-3 h-3" /> Diterima
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold rounded-full inline-flex items-center gap-1 shrink-0">
                          <Clock className="w-3 h-3" /> Siap Terima
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl text-[11px]">
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-400">
                          {activeTab === 'interbranch' ? 'Cabang Pengirim' : 'Vendor Supplier'}
                        </p>
                        <p className="font-semibold text-slate-800 truncate mt-0.5">
                          {item.source_name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400">Jumlah Masuk</p>
                        <p className="font-extrabold text-blue-600 text-xs mt-0.5">
                          +{item.qty} {item.products?.unit || 'kaleng'}
                        </p>
                      </div>
                    </div>

                    {!isDone && (
                      <button
                        onClick={() => setConfirmItem(item)}
                        disabled={Boolean(processingId)}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/20 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                      >
                        {isBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>{isBusy ? 'Memproses...' : 'Konfirmasi Terima Barang'}</span>
                      </button>
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
                    <th className="py-3.5 px-5">Produk</th>
                    <th className="py-3.5 px-5">
                      {activeTab === 'interbranch' ? 'Cabang Pengirim' : 'Vendor Supplier'}
                    </th>
                    <th className="py-3.5 px-5 text-center">Jumlah (Qty)</th>
                    <th className="py-3.5 px-5 text-center">Status Kiriman</th>
                    <th className="py-3.5 px-5 text-center">Aksi Konfirmasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                  {incomingList.map((item) => {
                    const isDone = item.status === 'completed' || item.status === 'received'
                    const isBusy = processingId === item.id
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-5 font-semibold text-slate-900">
                          <div>{item.products?.name || 'Produk Cat'}</div>
                          <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                            {item.products?.sku} • {item.reference_no}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-slate-700 font-medium whitespace-nowrap">
                          {item.source_name}
                        </td>
                        <td className="py-3.5 px-5 text-center font-extrabold text-blue-600 whitespace-nowrap">
                          +{item.qty} {item.products?.unit || 'kaleng'}
                        </td>
                        <td className="py-3.5 px-5 text-center whitespace-nowrap">
                          {isDone ? (
                            <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold rounded-full inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Selesai (Diterima)
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold rounded-full inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Siap Diterima
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-center whitespace-nowrap">
                          {isDone ? (
                            <span className="text-xs text-emerald-600 font-semibold">
                              Terkonfirmasi
                            </span>
                          ) : (
                            <button
                              onClick={() => setConfirmItem(item)}
                              disabled={Boolean(processingId)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm shadow-emerald-600/20 transition active:scale-95 disabled:opacity-50 inline-flex items-center gap-1.5"
                            >
                              {isBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                              <span>{isBusy ? 'Memproses...' : 'Konfirmasi Terima'}</span>
                            </button>
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

      {/* MODAL KONFIRMASI PENERIMAAN BARANG */}
      {confirmItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 min-[375px]:p-4 z-50">
          <div className="bg-white rounded-2xl p-4 min-[375px]:p-5 sm:p-6 max-w-sm w-full space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <PackageCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900">Konfirmasi Terima Barang?</h3>
                <p className="text-xs text-slate-500 mt-1 break-words leading-relaxed">
                  Pastikan fisik{' '}
                  <span className="font-bold text-slate-800">{confirmItem.products?.name}</span>{' '}
                  sebanyak{' '}
                  <span className="font-bold text-blue-600">
                    {confirmItem.qty} {confirmItem.products?.unit || 'unit'}
                  </span>{' '}
                  sudah diterima dengan baik. Stok gudang akan otomatis bertambah.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={executeConfirmReceipt}
                disabled={Boolean(processingId)}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white rounded-xl text-xs font-semibold transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {processingId === confirmItem.id && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                <span>{processingId === confirmItem.id ? 'Menyimpan...' : 'Ya, Terima Barang'}</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmItem(null)}
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