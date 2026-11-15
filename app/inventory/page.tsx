'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Warehouse,
  RefreshCw,
  Package,
  Boxes,
  AlertTriangle,
  Search,
  CheckCircle2,
  User,
  MapPin,
} from 'lucide-react'

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
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showLowStockOnly, setShowLowStockOnly] = useState(false)
  const [staffInfo, setStaffInfo] = useState<{
    name: string
    outletName: string
    role: string
  } | null>(null)

  const fetchInventory = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      // 1. Cek sesi user
      const {
        data: { session },
      } = await supabase.auth.getSession()
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
        let query = supabase
          .from('outlet_stocks')
          .select(`
            stock,
            min_stock,
            products (id, sku, name, brand, unit)
          `)
          .order('stock', { ascending: true })

        if (userData.outlet_id) {
          query = query.eq('outlet_id', userData.outlet_id)
        }

        const { data, error } = await query

        if (error) throw error
        if (data) {
          const formatted = data
            .filter((item: any) => item.products)
            .map((item: any) => ({
              id: item.products.id,
              sku: item.products.sku,
              name: item.products.name,
              brand: item.products.brand || '-',
              stock: Number(item.stock || 0),
              min_stock: Number(item.min_stock || 3),
              unit: item.products.unit || 'kaleng',
            }))
          setInventoryList(formatted)
        }
      }
    } catch (error) {
      console.error('Gagal memuat inventory:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchInventory()
  }, [fetchInventory])

  // Filter pencarian & filter stok menipis
  const filteredInventory = inventoryList.filter((item) => {
    const q = searchTerm.toLowerCase()
    const matchSearch =
      (item.name || '').toLowerCase().includes(q) ||
      (item.sku || '').toLowerCase().includes(q) ||
      (item.brand || '').toLowerCase().includes(q)
    const isLow = item.stock <= item.min_stock
    const matchLow = !showLowStockOnly || isLow

    return matchSearch && matchLow
  })

  // Perhitungan Ringkasan Metric Gudang
  const totalItems = inventoryList.length
  const totalPhysicalUnits = inventoryList.reduce((sum, item) => sum + Number(item.stock || 0), 0)
  const lowStockCount = inventoryList.filter((item) => item.stock <= item.min_stock).length

  return (
    <div className="p-3 min-[375px]:p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 max-w-7xl mx-auto space-y-5 sm:space-y-6">
      {/* Header Info */}
      <div className="bg-white p-4 min-[375px]:p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5">
        <div className="min-w-0">
          <h1 className="text-lg min-[375px]:text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Warehouse className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 shrink-0" />
            <span>Manajemen Stok & Gudang Cabang</span>
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] sm:text-xs text-slate-500 mt-1.5">
            <span className="inline-flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Petugas:</span>
              <strong className="font-semibold text-slate-700">{staffInfo?.name || '...'}</strong>
            </span>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>Lokasi:</span>
              <strong className="font-semibold text-blue-600">
                {staffInfo?.outletName || '...'}
              </strong>
            </span>
          </div>
        </div>

        <button
          onClick={() => fetchInventory(true)}
          disabled={refreshing || loading}
          className="w-full sm:w-auto px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 rounded-xl text-xs font-semibold transition inline-flex items-center justify-center gap-1.5 disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Menyinkronkan...' : 'Refresh Stok'}</span>
        </button>
      </div>

      {/* Metric Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <div className="bg-white p-4 min-[375px]:p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Total Varian Barang
            </p>
            <h2 className="text-lg min-[375px]:text-xl font-extrabold text-slate-900 mt-1">
              {totalItems} <span className="text-xs font-normal text-slate-500">SKU</span>
            </h2>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Package className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-4 min-[375px]:p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Total Stok Fisik Gudang
            </p>
            <h2 className="text-lg min-[375px]:text-xl font-extrabold text-blue-600 mt-1">
              {totalPhysicalUnits.toLocaleString('id-ID')}{' '}
              <span className="text-xs font-normal text-slate-500">Unit</span>
            </h2>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Boxes className="w-4 h-4" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowLowStockOnly((prev) => !prev)}
          className={`text-left p-4 min-[375px]:p-5 rounded-2xl border shadow-sm flex items-start justify-between gap-3 transition ${
            showLowStockOnly
              ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-500/20'
              : 'bg-white border-slate-200/90 hover:border-rose-200'
          }`}
        >
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Peringatan Restock
            </p>
            <h2 className="text-lg min-[375px]:text-xl font-extrabold text-rose-600 mt-1">
              {lowStockCount} <span className="text-xs font-normal text-slate-500">Item Menipis</span>
            </h2>
            <p className="text-[10px] font-semibold text-rose-600 mt-1">
              {showLowStockOnly ? 'Filter aktif (klik untuk reset)' : 'Klik untuk filter item menipis'}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </button>
      </div>

      {/* Bar Filter & Pencarian */}
      <div className="bg-white p-3.5 sm:p-4 border border-slate-200/90 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari SKU, nama cat, atau merek..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
          />
        </div>

        <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showLowStockOnly}
            onChange={(e) => setShowLowStockOnly(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
          />
          <span className="inline-flex items-center gap-1">
            <span>Tampilkan Hanya Stok Menipis</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          </span>
        </label>
      </div>

      {/* Daftar / Tabel Data Stok Gudang */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between gap-2">
          <span className="font-bold text-xs sm:text-sm text-slate-800">
            Daftar Stok Fisik Cabang
          </span>
          <span className="text-[11px] font-semibold text-slate-400 shrink-0">
            {filteredInventory.length} item
          </span>
        </div>

        {loading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-16 bg-slate-100 rounded-xl" />
            ))}
          </div>
        ) : filteredInventory.length === 0 ? (
          <div className="text-center py-14 px-4 space-y-1.5">
            <Package className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs sm:text-sm font-semibold text-slate-600">
              Tidak ada data stok yang sesuai
            </p>
            <p className="text-[11px] text-slate-400">
              Coba ubah kata kunci pencarian atau reset filter stok menipis.
            </p>
          </div>
        ) : (
          <>
            {/* TAMPILAN MOBILE (< 768px): CARD LIST */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredInventory.map((item, index) => {
                const isLowStock = item.stock <= item.min_stock
                return (
                  <div key={`${item.id}-${index}`} className="p-3.5 min-[375px]:p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {item.sku}
                          </span>
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            {item.brand}
                          </span>
                        </div>
                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 mt-1.5 break-words">
                          {item.name}
                        </h3>
                      </div>

                      {isLowStock ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 inline-flex items-center gap-1 shrink-0">
                          <AlertTriangle className="w-3 h-3" /> Menipis
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 inline-flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-3 h-3" /> Aman
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl text-[11px]">
                      <div>
                        <p className="text-[10px] text-slate-400">Stok Sistem</p>
                        <p
                          className={`font-extrabold text-xs mt-0.5 ${
                            isLowStock ? 'text-rose-600' : 'text-slate-900'
                          }`}
                        >
                          {item.stock}{' '}
                          <span className="font-normal text-slate-500">{item.unit}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400">Batas Minimum</p>
                        <p className="font-bold text-slate-700 mt-0.5">
                          {item.min_stock} {item.unit}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* TAMPILAN DESKTOP / TABLET (>= 768px): TABEL */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                    <th className="py-3.5 px-5">SKU</th>
                    <th className="py-3.5 px-5">Nama Produk</th>
                    <th className="py-3.5 px-5">Brand</th>
                    <th className="py-3.5 px-5 text-center">Stok Sistem</th>
                    <th className="py-3.5 px-5 text-center">Batas Min</th>
                    <th className="py-3.5 px-5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm text-slate-700">
                  {filteredInventory.map((item, index) => {
                    const isLowStock = item.stock <= item.min_stock
                    return (
                      <tr key={`${item.id}-${index}`} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-5 font-mono text-xs text-slate-500 whitespace-nowrap">
                          {item.sku}
                        </td>
                        <td className="py-3.5 px-5 font-medium text-slate-900">{item.name}</td>
                        <td className="py-3.5 px-5 text-slate-600 whitespace-nowrap">
                          {item.brand}
                        </td>
                        <td className="py-3.5 px-5 text-center font-bold text-slate-900 whitespace-nowrap">
                          {item.stock}{' '}
                          <span className="text-[11px] font-normal text-slate-500">
                            {item.unit}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-center text-slate-500 font-semibold whitespace-nowrap">
                          {item.min_stock}
                        </td>
                        <td className="py-3.5 px-5 text-center whitespace-nowrap">
                          {isLowStock ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> STOK MENIPIS
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> AMAN
                            </span>
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