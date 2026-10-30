'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

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

  // State Modal Edit Safety Stock (Min Stock)
  const [editingStock, setEditingStock] = useState<OutletStockRow | null>(null)
  const [editQty, setEditQty] = useState<number>(0)
  const [editMinStock, setEditMinStock] = useState<number>(3)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetchStockData()
  }, [])

  const fetchStockData = async () => {
    try {
      setLoading(true)

      // Fetch Outlet
      const { data: outletsData } = await supabase.from('outlets').select('id, name')
      if (outletsData) setOutlets(outletsData)

      // Fetch Stok Fisik Seluruh Cabang
      const { data: stocksData, error } = await supabase
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
        .order('stock', { ascending: true })

      if (error) throw error
      if (stocksData) setStocks(stocksData as any)
    } catch (err) {
      console.error('Gagal mengambil data stok:', err)
    } finally {
      setLoading(false)
    }
  }

  // Handle Edit Min Stock & Adjustment
  const handleOpenEdit = (item: OutletStockRow) => {
    setEditingStock(item)
    setEditQty(item.stock)
    setEditMinStock(item.min_stock || 3)
  }

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingStock) return

    try {
      setUpdating(true)
      const { error } = await supabase
        .from('outlet_stocks')
        .update({
          stock: Number(editQty),
          min_stock: Number(editMinStock),
        })
        .eq('id', editingStock.id)

      if (error) throw error

      alert('Batas minimum stok & jumlah fisik berhasil diperbarui!')
      setEditingStock(null)
      fetchStockData()
    } catch (err: any) {
      alert(`Gagal memperbarui stok: ${err.message}`)
    } finally {
      setUpdating(false)
    }
  }

  // Filter Logic
  const filteredStocks = stocks.filter((item) => {
    const matchOutlet = selectedOutlet === 'all' || item.outlet_id === selectedOutlet
    const prodName = item.products?.name?.toLowerCase() || ''
    const prodSku = item.products?.sku?.toLowerCase() || ''
    const query = searchQuery.toLowerCase()
    const matchSearch = prodName.includes(query) || prodSku.includes(query)
    const isLow = item.stock <= (item.min_stock || 3)
    const matchLow = !showLowStockOnly || isLow

    return matchOutlet && matchSearch && matchLow
  })

  // Summary Metrics
  const lowStockCount = stocks.filter((s) => s.stock <= (s.min_stock || 3)).length
  const totalPhysicalUnits = stocks.reduce((sum, s) => sum + Number(s.stock || 0), 0)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      {/* HEADER */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Manajemen & Kontrol Stok Cabang</h1>
        <p className="text-xs text-slate-500 mt-1">
          Pemantauan ketersediaan barang fisik di seluruh lokasi serta konfigurasi batas minimum stok (safety stock).
        </p>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Item Fisik</p>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
            {totalPhysicalUnits.toLocaleString('id-ID')} <span className="text-xs font-normal text-slate-500">Unit</span>
          </h2>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alert Stok Menipis</p>
          <h2 className="text-xl sm:text-2xl font-extrabold text-amber-600 mt-1">
            {lowStockCount} <span className="text-xs font-normal text-slate-500">Item kritis</span>
          </h2>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Cabang Dipantau</p>
          <h2 className="text-xl sm:text-2xl font-extrabold text-blue-600 mt-1">
            {outlets.length} <span className="text-xs font-normal text-slate-500">Outlet</span>
          </h2>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 sm:p-5 border border-slate-200 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* SEARCH INPUT */}
          <input
            type="text"
            placeholder="Cari SKU atau Nama Produk..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 w-full sm:w-64"
          />

          {/* OUTLET FILTER */}
          <select
            value={selectedOutlet}
            onChange={(e) => setSelectedOutlet(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
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
        <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer self-start md:self-auto">
          <input
            type="checkbox"
            checked={showLowStockOnly}
            onChange={(e) => setShowLowStockOnly(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
          />
          <span>Tampilkan Hanya Stok Menipis (⚠️)</span>
        </label>
      </div>

      {/* TABEL DATA STOK */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-800">
          Daftar Persediaan Barang Per Cabang
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Memuat data persediaan stok...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <th className="py-3.5 px-4 sm:px-6">Cabang Toko</th>
                  <th className="py-3.5 px-4 sm:px-6">SKU</th>
                  <th className="py-3.5 px-4 sm:px-6">Nama Produk</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">Stok Fisik</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">Batas Min (Safety)</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">Status</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">Aksi Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredStocks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      Tidak ada data stok yang sesuai dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredStocks.map((item) => {
                    const isLow = item.stock <= (item.min_stock || 3)
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4 sm:px-6 font-bold text-blue-600 whitespace-nowrap">
                          {item.outlets?.name || 'Cabang'}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 font-mono text-xs text-slate-500 whitespace-nowrap">
                          {item.products?.sku || '-'}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900 whitespace-nowrap">
                          {item.products?.name || 'Produk Cat'}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-center font-bold text-slate-900 text-sm">
                          {item.stock} <span className="text-[10px] font-normal text-slate-400">{item.products?.unit || 'kaleng'}</span>
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-center font-semibold text-slate-500">
                          {item.min_stock || 3}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-center whitespace-nowrap">
                          {isLow ? (
                            <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-bold">
                              ⚠️ Kritis / Re-stock
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold">
                              ✅ Stok Aman
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-center whitespace-nowrap">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition"
                          >
                            ⚙️ Atur Limit
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL EDIT MINIMUM STOK */}
      {editingStock && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Atur Batas Stok & Penyesuaian</h3>
              <button
                onClick={() => setEditingStock(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateStock} className="space-y-4">
              <div>
                <p className="text-xs font-bold text-slate-800">{editingStock.products?.name}</p>
                <p className="text-[11px] text-blue-600 font-semibold">{editingStock.outlets?.name}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Jumlah Stok Fisik Sekarang</label>
                <input
                  type="number"
                  min="0"
                  value={editQty}
                  onChange={(e) => setEditQty(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Batas Minimum Stok (Alert Safety)</label>
                <input
                  type="number"
                  min="1"
                  value={editMinStock}
                  onChange={(e) => setEditMinStock(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Sistem akan memberikan peringatan jika stok di cabang ini jatuh di bawah angka ini.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-500 transition shadow-md shadow-blue-600/20 disabled:opacity-50"
                >
                  {updating ? 'Menyimpan...' : 'Simpan Perubahan'}
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