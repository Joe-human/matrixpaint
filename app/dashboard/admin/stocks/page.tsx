'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Boxes,
  AlertTriangle,
  Building2,
  Search,
  Settings2,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Package,
} from 'lucide-react'

interface OutletStockRow {
  id: string
  outlet_id: string
  product_id: string
  stock: number
  min_stock: number
  outlets?: { name: string } | null
  products?: { sku: string; name: string; brand: string; category: string; unit: string } | null
}

interface Outlet {
  id: string
  name: string
}

export default function AdminStockManagementPage() {
  const [stocks, setStocks] = useState<OutletStockRow[]>([])
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [loading, setLoading] = useState(true)

  // Filter States
  const [selectedOutlet, setSelectedOutlet] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [showLowStockOnly, setShowLowStockOnly] = useState<boolean>(false)

  // Banner Notifikasi Non-Blocking
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  )

  // State Modal Edit Safety Stock (Min Stock)
  const [editingStock, setEditingStock] = useState<OutletStockRow | null>(null)
  const [editQty, setEditQty] = useState<number>(0)
  const [editMinStock, setEditMinStock] = useState<number>(3)
  const [updating, setUpdating] = useState(false)

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev))
    }, 4500)
  }

  const fetchStockData = useCallback(async () => {
    try {
      setLoading(true)

      const [outletsRes, stocksRes] = await Promise.all([
        supabase.from('outlets').select('id, name').order('name', { ascending: true }),
        supabase
          .from('outlet_stocks')
          .select(`
            id,
            outlet_id,
            product_id,
            stock,
            min_stock,
            outlets(name),
            products(sku, name, brand, category, unit)
          `)
          .order('stock', { ascending: true }),
      ])

      if (outletsRes.data) setOutlets(outletsRes.data)
      if (stocksRes.error) throw stocksRes.error
      if (stocksRes.data) setStocks(stocksRes.data as unknown as OutletStockRow[])
    } catch (err) {
      console.error('Gagal mengambil data stok:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStockData()
  }, [fetchStockData])

  // Handle Edit Min Stock & Adjustment
  const handleOpenEdit = (item: OutletStockRow) => {
    setEditingStock(item)
    setEditQty(Number(item.stock || 0))
    setEditMinStock(Number(item.min_stock || 3))
  }

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingStock) return

    try {
      setUpdating(true)
      const { error } = await supabase
        .from('outlet_stocks')
        .update({
          stock: Math.max(0, Number(editQty)),
          min_stock: Math.max(1, Number(editMinStock)),
        })
        .eq('id', editingStock.id)

      if (error) throw error

      showFeedback(
        'success',
        `Stok & batas safety "${editingStock.products?.name || 'Produk'}" di ${
          editingStock.outlets?.name || 'Cabang'
        } berhasil diperbarui!`
      )
      setEditingStock(null)
      fetchStockData()
    } catch (err: any) {
      showFeedback('error', `Gagal memperbarui stok: ${err.message || 'Terjadi kesalahan'}`)
    } finally {
      setUpdating(false)
    }
  }

  // Filter Logic
  const filteredStocks = stocks.filter((item) => {
    const matchOutlet = selectedOutlet === 'all' || item.outlet_id === selectedOutlet
    const prodName = item.products?.name?.toLowerCase() || ''
    const prodSku = item.products?.sku?.toLowerCase() || ''
    const prodBrand = item.products?.brand?.toLowerCase() || ''
    const query = searchQuery.toLowerCase()
    const matchSearch =
      prodName.includes(query) || prodSku.includes(query) || prodBrand.includes(query)
    const isLow = item.stock <= (item.min_stock || 3)
    const matchLow = !showLowStockOnly || isLow

    return matchOutlet && matchSearch && matchLow
  })

  // Summary Metrics
  const lowStockCount = stocks.filter((s) => s.stock <= (s.min_stock || 3)).length
  const totalPhysicalUnits = stocks.reduce((sum, s) => sum + Number(s.stock || 0), 0)

  return (
    <div className="p-3 min-[375px]:p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 max-w-7xl mx-auto space-y-5 sm:space-y-7">
      {/* HEADER */}
      <div>
        <h1 className="text-lg min-[375px]:text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Boxes className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 shrink-0" />
          <span>Manajemen & Kontrol Stok Cabang</span>
        </h1>
        <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
          Pemantauan ketersediaan barang fisik di seluruh lokasi serta konfigurasi batas minimum stok
          (safety stock).
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

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-5">
        <div className="bg-white p-4 min-[375px]:p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Total Item Fisik
            </p>
            <h2 className="text-lg min-[375px]:text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
              {totalPhysicalUnits.toLocaleString('id-ID')}{' '}
              <span className="text-xs font-normal text-slate-500">Unit</span>
            </h2>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Package className="w-4 h-4" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowLowStockOnly((prev) => !prev)}
          className={`text-left p-4 min-[375px]:p-5 rounded-2xl border shadow-sm flex items-start justify-between gap-3 transition ${
            showLowStockOnly
              ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200/90 hover:border-amber-200'
          }`}
        >
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Alert Stok Menipis
            </p>
            <h2 className="text-lg min-[375px]:text-xl sm:text-2xl font-extrabold text-amber-600 mt-1">
              {lowStockCount}{' '}
              <span className="text-xs font-normal text-slate-500">Item kritis</span>
            </h2>
            <p className="text-[10px] font-semibold text-amber-700 mt-1">
              {showLowStockOnly ? 'Filter aktif (klik untuk reset)' : 'Klik untuk filter item kritis'}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </button>

        <div className="bg-white p-4 min-[375px]:p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Total Cabang Dipantau
            </p>
            <h2 className="text-lg min-[375px]:text-xl sm:text-2xl font-extrabold text-blue-600 mt-1">
              {outlets.length} <span className="text-xs font-normal text-slate-500">Outlet</span>
            </h2>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-3.5 sm:p-4 border border-slate-200/90 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          {/* SEARCH INPUT */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari SKU, nama, atau merek..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
            />
          </div>

          {/* OUTLET FILTER */}
          <select
            aria-label="Filter Cabang Toko"
            value={selectedOutlet}
            onChange={(e) => setSelectedOutlet(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:bg-white focus:border-blue-500 transition"
          >
            <option value="all">Semua Cabang Toko</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        {/* CHECKBOX ALERT STOK MENIPIS */}
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showLowStockOnly}
            onChange={(e) => setShowLowStockOnly(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
          />
          <span className="inline-flex items-center gap-1">
            <span>Hanya Stok Menipis</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          </span>
        </label>
      </div>

      {/* DAFTAR PERSEDIAAN STOK */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between gap-2">
          <span className="font-bold text-xs sm:text-sm text-slate-800">
            Daftar Persediaan Barang Per Cabang
          </span>
          <span className="text-[11px] font-semibold text-slate-400 shrink-0">
            {filteredStocks.length} entri
          </span>
        </div>

        {loading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-16 bg-slate-100 rounded-xl" />
            ))}
          </div>
        ) : filteredStocks.length === 0 ? (
          <div className="text-center py-14 px-4 space-y-1.5">
            <Package className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs sm:text-sm font-semibold text-slate-600">
              Tidak ada data stok yang sesuai filter
            </p>
            <p className="text-[11px] text-slate-400">
              Coba ubah cabang tujuan, kata kunci pencarian, atau matikan filter stok kritis.
            </p>
          </div>
        ) : (
          <>
            {/* TAMPILAN MOBILE (< 768px): CARD LIST */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredStocks.map((item) => {
                const isLow = item.stock <= (item.min_stock || 3)
                return (
                  <div key={item.id} className="p-3.5 min-[375px]:p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            <Building2 className="w-3 h-3 shrink-0" />
                            <span className="truncate">{item.outlets?.name || 'Cabang'}</span>
                          </span>
                          <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {item.products?.sku || '-'}
                          </span>
                        </div>
                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 mt-1.5 break-words">
                          {item.products?.name || 'Produk Cat'}
                        </h3>
                      </div>

                      {isLow ? (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-bold inline-flex items-center gap-1 shrink-0">
                          <AlertTriangle className="w-3 h-3" /> Kritis
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold inline-flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-3 h-3" /> Aman
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl text-[11px]">
                      <div>
                        <p className="text-[10px] text-slate-400">Stok Fisik</p>
                        <p
                          className={`font-extrabold text-xs mt-0.5 ${
                            isLow ? 'text-amber-600' : 'text-slate-900'
                          }`}
                        >
                          {item.stock}{' '}
                          <span className="font-normal text-slate-500">
                            {item.products?.unit || 'kaleng'}
                          </span>
                        </p>
                      </div>

                      <div className="text-center">
                        <p className="text-[10px] text-slate-400">Batas Safety</p>
                        <p className="font-bold text-slate-700 mt-0.5">{item.min_stock || 3}</p>
                      </div>

                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition shadow-xs"
                      >
                        <Settings2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Atur Limit</span>
                      </button>
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
                    <th className="py-3.5 px-5">Cabang Toko</th>
                    <th className="py-3.5 px-5">SKU</th>
                    <th className="py-3.5 px-5">Nama Produk</th>
                    <th className="py-3.5 px-5 text-center">Stok Fisik</th>
                    <th className="py-3.5 px-5 text-center">Batas Min (Safety)</th>
                    <th className="py-3.5 px-5 text-center">Status</th>
                    <th className="py-3.5 px-5 text-center">Aksi Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                  {filteredStocks.map((item) => {
                    const isLow = item.stock <= (item.min_stock || 3)
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-5 font-bold text-blue-600 whitespace-nowrap">
                          {item.outlets?.name || 'Cabang'}
                        </td>
                        <td className="py-3.5 px-5 font-mono text-slate-500 whitespace-nowrap">
                          {item.products?.sku || '-'}
                        </td>
                        <td className="py-3.5 px-5 font-medium text-slate-900">
                          {item.products?.name || 'Produk Cat'}
                        </td>
                        <td className="py-3.5 px-5 text-center font-bold text-slate-900 text-sm whitespace-nowrap">
                          {item.stock}{' '}
                          <span className="text-[11px] font-normal text-slate-400">
                            {item.products?.unit || 'kaleng'}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-center font-semibold text-slate-500">
                          {item.min_stock || 3}
                        </td>
                        <td className="py-3.5 px-5 text-center whitespace-nowrap">
                          {isLow ? (
                            <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[11px] font-bold inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Kritis / Re-stock
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-bold inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Stok Aman
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-center whitespace-nowrap">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition"
                          >
                            <Settings2 className="w-3.5 h-3.5 text-blue-600" />
                            <span>Atur Limit</span>
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

      {/* MODAL EDIT MINIMUM STOK */}
      {editingStock && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 min-[375px]:p-4 z-50">
          <div className="bg-white rounded-2xl p-4 min-[375px]:p-5 sm:p-6 max-w-md w-full space-y-4 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Atur Batas Stok & Penyesuaian
              </h3>
              <button
                onClick={() => setEditingStock(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition"
                aria-label="Tutup modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateStock} className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                <p className="text-xs font-bold text-slate-800 break-words">
                  {editingStock.products?.name}
                </p>
                <p className="text-[11px] text-blue-600 font-semibold mt-0.5">
                  {editingStock.outlets?.name}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Jumlah Stok Fisik Sekarang
                </label>
                <input
                  type="number"
                  min="0"
                  value={editQty}
                  onChange={(e) => setEditQty(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Batas Minimum Stok (Alert Safety)
                </label>
                <input
                  type="number"
                  min="1"
                  value={editMinStock}
                  onChange={(e) => setEditMinStock(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  Sistem akan memberikan peringatan stok kritis jika stok di cabang ini menyentuh
                  atau jatuh di bawah angka ini.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-500 active:scale-[0.99] transition shadow-md shadow-blue-600/20 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                >
                  {updating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{updating ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingStock(null)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-200 transition"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}