'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ClipboardCheck,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Package,
  MapPin,
  User,
  Calendar,
} from 'lucide-react'

interface InventoryItem {
  id: string
  sku: string
  name: string
  stock: number
  unit: string
}

interface AdjustmentRecord {
  id: string
  type: 'damage' | 'loss' | 'found' | 'opname'
  qty_change: number
  reason: string
  created_at: string
  products: { name: string; sku: string; unit?: string } | null
  users: { name: string } | null
}

export default function StockAdjustmentsPage() {
  const [products, setProducts] = useState<InventoryItem[]>([])
  const [history, setHistory] = useState<AdjustmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshingHistory, setRefreshingHistory] = useState(false)

  const [staffInfo, setStaffInfo] = useState<{
    id: string
    companyId: string
    outletId: string
    outletName: string
  } | null>(null)

  const [selectedProduct, setSelectedProduct] = useState('')
  const [adjustmentType, setAdjustmentType] = useState<'damage' | 'loss' | 'found' | 'opname'>(
    'damage'
  )
  const [opnameDirection, setOpnameDirection] = useState<'minus' | 'plus'>('minus')
  const [qtyChange, setQtyChange] = useState('')
  const [reason, setReason] = useState('')

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

  const fetchProducts = useCallback(async (outletId: string) => {
    const { data } = await supabase
      .from('outlet_stocks')
      .select('stock, products(id, sku, name, unit)')
      .eq('outlet_id', outletId)

    if (data) {
      const formatted = data
        .filter((item: any) => item.products)
        .map((item: any) => ({
          id: item.products.id,
          sku: item.products.sku,
          name: item.products.name,
          stock: Number(item.stock || 0),
          unit: item.products.unit || 'kaleng',
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
      setProducts(formatted)
    }
  }, [])

  const fetchHistory = useCallback(async (outletId: string, isManual = false) => {
    if (isManual) setRefreshingHistory(true)
    try {
      const { data } = await supabase
        .from('stock_adjustments')
        .select(`
          id,
          type,
          qty_change,
          reason,
          created_at,
          products(name, sku, unit),
          users(name)
        `)
        .eq('outlet_id', outletId)
        .order('created_at', { ascending: false })

      if (data) setHistory(data as unknown as AdjustmentRecord[])
    } finally {
      if (isManual) setRefreshingHistory(false)
    }
  }, [])

  const initPage = useCallback(async () => {
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
        setStaffInfo({
          id: userData.id,
          companyId: userData.company_id,
          outletId: userData.outlet_id,
          outletName: (userData.outlets as any)?.name || 'Cabang Store',
        })

        await Promise.all([fetchProducts(userData.outlet_id), fetchHistory(userData.outlet_id)])
      }
    } catch (err) {
      console.error('Gagal memuat halaman opname:', err)
    } finally {
      setLoading(false)
    }
  }, [fetchProducts, fetchHistory])

  useEffect(() => {
    initPage()
  }, [initPage])

  const selectedProdObj = products.find((p) => p.id === selectedProduct)
  const rawQty = Math.abs(Number(qtyChange) || 0)

  const isDeduction =
    adjustmentType === 'damage' ||
    adjustmentType === 'loss' ||
    (adjustmentType === 'opname' && opnameDirection === 'minus')

  const signedQty = isDeduction ? -rawQty : rawQty
  const projectedStock = selectedProdObj
    ? Math.max(0, selectedProdObj.stock + signedQty)
    : null

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!staffInfo) {
      showFeedback('error', 'Sesi pengguna tidak valid atau outlet belum terhubung.')
      return
    }

    if (!selectedProduct || !selectedProdObj) {
      showFeedback('error', 'Pilih produk cat terlebih dahulu.')
      return
    }

    if (!rawQty || rawQty <= 0) {
      showFeedback('error', 'Jumlah perubahan stok harus lebih dari 0.')
      return
    }

    if (isDeduction && rawQty > selectedProdObj.stock) {
      showFeedback(
        'error',
        `Jumlah pengurangan (${rawQty}) melebihi stok fisik tersedia (${selectedProdObj.stock} ${selectedProdObj.unit}).`
      )
      return
    }

    setSubmitting(true)
    setFeedback(null)

    try {
      // 1. Simpan catatan ke tabel stock_adjustments
      const { error: adjError } = await supabase.from('stock_adjustments').insert([
        {
          company_id: staffInfo.companyId,
          outlet_id: staffInfo.outletId,
          product_id: selectedProduct,
          user_id: staffInfo.id,
          type: adjustmentType,
          qty_change: signedQty,
          reason: reason.trim(),
        },
      ])

      if (adjError) throw adjError

      // 2. Update stok fisik barang di outlet_stocks
      const newStock = Math.max(0, selectedProdObj.stock + signedQty)
      const { error: stockError } = await supabase
        .from('outlet_stocks')
        .update({ stock: newStock })
        .eq('outlet_id', staffInfo.outletId)
        .eq('product_id', selectedProduct)

      if (stockError) throw stockError

      showFeedback(
        'success',
        `Penyesuaian "${selectedProdObj.name}" (${
          signedQty > 0 ? `+${signedQty}` : signedQty
        } ${selectedProdObj.unit}) berhasil dicatat!`
      )
      setSelectedProduct('')
      setQtyChange('')
      setReason('')
      await Promise.all([fetchProducts(staffInfo.outletId), fetchHistory(staffInfo.outletId)])
    } catch (err: any) {
      showFeedback('error', `Gagal menyimpan penyesuaian: ${err.message || 'Terjadi kesalahan'}`)
    } finally {
      setSubmitting(false)
    }
  }

  const renderTypeBadge = (type: AdjustmentRecord['type']) => {
    if (type === 'damage') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
          Rusak / Bocor
        </span>
      )
    }
    if (type === 'loss') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
          Hilang
        </span>
      )
    }
    if (type === 'found') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
          Ditemukan (+)
        </span>
      )
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
        Koreksi Opname
      </span>
    )
  }

  return (
    <div className="p-3 min-[375px]:p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 max-w-7xl mx-auto space-y-5 sm:space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-lg min-[375px]:text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 shrink-0" />
          <span>Stok Opname & Penyesuaian Barang</span>
        </h1>
        <p className="text-[11px] sm:text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-1.5">
          <span>Pencatatan barang rusak, kebocoran, atau penyesuaian selisih opname lokasi:</span>
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
        {/* FORM PENYESUAIAN (KIRI) */}
        <div className="bg-white p-4 min-[375px]:p-5 sm:p-6 border border-slate-200/90 rounded-2xl shadow-sm space-y-4 h-fit">
          <h2 className="text-xs sm:text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            Form Input Opname
          </h2>

          <form onSubmit={handleCreateAdjustment} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Pilih Produk Cat *
              </label>
              <select
                required
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50 focus:outline-none focus:bg-white focus:border-blue-500 transition"
              >
                <option value="">-- Pilih Barang --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.sku}] {p.name} (Sisa: {p.stock} {p.unit})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Kategori Penyesuaian *
              </label>
              <select
                required
                value={adjustmentType}
                onChange={(e) => setAdjustmentType(e.target.value as any)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50 focus:outline-none focus:bg-white focus:border-blue-500 transition"
              >
                <option value="damage">Barang Rusak / Bocor (Kurangi Stok)</option>
                <option value="loss">Barang Hilang / Selisih Minus (Kurangi Stok)</option>
                <option value="found">Barang Ditemukan / Selisih Plus (Tambah Stok)</option>
                <option value="opname">Koreksi Rutin Opname (+/-)</option>
              </select>
            </div>

            {adjustmentType === 'opname' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Arah Koreksi Opname
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOpnameDirection('minus')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                      opnameDirection === 'minus'
                        ? 'bg-rose-50 border-rose-300 text-rose-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    Kurangi Stok (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpnameDirection('plus')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                      opnameDirection === 'plus'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    Tambah Stok (+)
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Jumlah Fisik Perubahan (Qty) *
              </label>
              <input
                type="number"
                required
                min="1"
                placeholder="Contoh: 2"
                value={qtyChange}
                onChange={(e) => setQtyChange(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50 focus:outline-none focus:bg-white focus:border-blue-500 transition"
              />
              {selectedProdObj && (
                <div className="mt-1.5 flex items-center justify-between text-[11px] bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/70">
                  <span className="text-slate-500">
                    Stok saat ini: <strong className="text-slate-800">{selectedProdObj.stock}</strong>
                  </span>
                  {rawQty > 0 && projectedStock !== null && (
                    <span className="text-slate-500">
                      Menjadi:{' '}
                      <strong
                        className={isDeduction ? 'text-rose-600' : 'text-emerald-600'}
                      >
                        {projectedStock} {selectedProdObj.unit}
                      </strong>
                    </span>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Alasan / Catatan Kendala *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Contoh: Kaleng kemasan penyok dan bocor saat pemindahan rak..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50 focus:outline-none focus:bg-white focus:border-blue-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/20 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{submitting ? 'Memproses...' : 'Simpan Penyesuaian Stok'}</span>
            </button>
          </form>
        </div>

        {/* RIWAYAT PENYESUAIAN (KANAN) */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 sm:px-6 border-b border-slate-100 flex justify-between items-center gap-2">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">
              Riwayat Penyesuaian & Opname
            </h2>
            <button
              onClick={() => staffInfo && fetchHistory(staffInfo.outletId, true)}
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
                Belum ada riwayat penyesuaian opname
              </p>
              <p className="text-[11px] text-slate-400">
                Catatan barang rusak, hilang, atau hasil opname cabang ini akan muncul di sini.
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

                      <span
                        className={`text-xs sm:text-sm font-extrabold px-2.5 py-0.5 rounded-lg shrink-0 ${
                          item.qty_change < 0
                            ? 'bg-rose-50 text-rose-600'
                            : 'bg-emerald-50 text-emerald-600'
                        }`}
                      >
                        {item.qty_change > 0 ? `+${item.qty_change}` : item.qty_change}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 break-words">
                      {item.reason}
                    </p>

                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 flex-wrap">
                      <div>{renderTypeBadge(item.type)}</div>
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span>{item.users?.name || 'Staf'}</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(item.created_at).toLocaleDateString('id-ID')}</span>
                        </span>
                      </div>
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
                      <th className="py-3.5 px-5">Kategori</th>
                      <th className="py-3.5 px-5 text-center">Qty Mutasi</th>
                      <th className="py-3.5 px-5">Keterangan</th>
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
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          {renderTypeBadge(item.type)}
                        </td>
                        <td className="py-3.5 px-5 text-center font-extrabold whitespace-nowrap">
                          <span
                            className={item.qty_change < 0 ? 'text-rose-600' : 'text-emerald-600'}
                          >
                            {item.qty_change > 0 ? `+${item.qty_change}` : item.qty_change}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-slate-600 max-w-xs">
                          <p className="line-clamp-2 break-words">{item.reason}</p>
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            Oleh: {item.users?.name || 'Staf'}
                          </span>
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