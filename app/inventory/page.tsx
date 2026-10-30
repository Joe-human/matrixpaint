'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface InventoryItem {
  id: string
  sku: string
  name: string
  brand: string
  stock: number
  min_stock: number
  unit: string
}

export default function InventoryPage() {
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showLowStockOnly, setShowLowStockOnly] = useState(false)
  const [staffInfo, setStaffInfo] = useState<{ name: string; outletName: string; role: string } | null>(null)

  useEffect(() => {
    fetchInventory()
  }, [])

  const fetchInventory = async () => {
    try {
      setLoading(true)
      
      // 1. Cek sesi user
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // 2. Ambil profil staf dan nama cabangnya
      const { data: userData } = await supabase
        .from('users')
        .select('name, role, outlet_id, outlets(name)')
        .eq('email', session.user.email)
        .single()

      if (userData) {
        setStaffInfo({
          name: userData.name,
          role: userData.role,
          outletName: (userData.outlets as any)?.name || 'Semua Cabang (Pusat)',
        })

        // 3. Query stok barang cabang
        let query = supabase.from('outlet_stocks').select(`
          stock,
          min_stock,
          products (id, sku, name, brand, unit)
        `)

        if (userData.outlet_id) {
          query = query.eq('outlet_id', userData.outlet_id)
        }

        const { data, error } = await query

        if (error) throw error
        if (data) {
          const formatted = data.map((item: any) => ({
            id: item.products.id,
            sku: item.products.sku,
            name: item.products.name,
            brand: item.products.brand || '-',
            stock: item.stock,
            min_stock: item.min_stock || 3,
            unit: item.products.unit || 'kaleng',
          }))
          setInventoryList(formatted)
        }
      }
    } catch (error) {
      console.error('Gagal memuat inventory:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter pencarian & filter stok menipis
  const filteredInventory = inventoryList.filter((item) => {
    const matchSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase())
    const isLow = item.stock <= item.min_stock
    const matchLow = !showLowStockOnly || isLow

    return matchSearch && matchLow
  })

  // Perhitungan Ringkasan Metric Gudang
  const totalItems = inventoryList.length
  const totalPhysicalUnits = inventoryList.reduce((sum, item) => sum + Number(item.stock || 0), 0)
  const lowStockCount = inventoryList.filter((item) => item.stock <= item.min_stock).length

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Info */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Manajemen Stok & Gudang Cabang</h1>
          <p className="text-xs text-slate-500 mt-1">
            Petugas: <span className="font-semibold text-slate-700">{staffInfo?.name || '...'}</span> | 
            Lokasi: <span className="font-semibold text-blue-600">{staffInfo?.outletName || '...'}</span>
          </p>
        </div>
        <button
          onClick={fetchInventory}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition self-end sm:self-auto"
        >
          Refresh Stok
        </button>
      </div>

      {/* Metric Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Varian Barang</p>
          <h2 className="text-xl font-extrabold text-slate-900 mt-1">
            {totalItems} <span className="text-xs font-normal text-slate-500">SKU</span>
          </h2>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Stok Fisik Gudang</p>
          <h2 className="text-xl font-extrabold text-blue-600 mt-1">
            {totalPhysicalUnits.toLocaleString('id-ID')} <span className="text-xs font-normal text-slate-500">Unit</span>
          </h2>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Peringatan Restock</p>
          <h2 className="text-xl font-extrabold text-red-600 mt-1">
            {lowStockCount} <span className="text-xs font-normal text-slate-500">Item Menipis</span>
          </h2>
        </div>
      </div>

      {/* Bar Filter & Pencarian */}
      <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <input
          type="text"
          placeholder="🔍 Cari SKU atau Nama Cat..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 w-full sm:w-72"
        />

        <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer self-start sm:self-auto">
          <input
            type="checkbox"
            checked={showLowStockOnly}
            onChange={(e) => setShowLowStockOnly(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
          />
          <span>Tampilkan Hanya Stok Menipis (⚠️)</span>
        </label>
      </div>

      {/* Tabel Data Stok Gudang */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-slate-400 text-xs">Menyinkronkan data gudang...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <th className="py-3.5 px-4 sm:px-6">SKU</th>
                  <th className="py-3.5 px-4 sm:px-6">Nama Produk</th>
                  <th className="py-3.5 px-4 sm:px-6">Brand</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">Stok Sistem</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">Batas Min</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm text-slate-700">
                {filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 text-xs">
                      Tidak ada data stok yang sesuai.
                    </td>
                  </tr>
                ) : (
                  filteredInventory.map((item, index) => {
                    const isLowStock = item.stock <= item.min_stock
                    return (
                      <tr key={`${item.id}-${index}`} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4 sm:px-6 font-mono text-xs text-slate-500 whitespace-nowrap">
                          {item.sku}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900 whitespace-nowrap">
                          {item.name}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-slate-600 whitespace-nowrap">
                          {item.brand}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-center font-bold text-slate-900 whitespace-nowrap">
                          {item.stock} <span className="text-[10px] font-normal text-slate-500">{item.unit}</span>
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-center text-slate-500 font-semibold whitespace-nowrap">
                          {item.min_stock}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-center whitespace-nowrap">
                          {isLowStock ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-200">
                              ⚠️ STOK MENIPIS
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                              AMAN
                            </span>
                          )}
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
    </div>
  )
}