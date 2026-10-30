'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface BranchRevenue {
  outletName: string
  totalRevenue: number
  totalTransactions: number
}

interface LowStockAlert {
  outletName: string
  productName: string
  stock: number
  minStock: number
}

interface TopProduct {
  name: string
  qty: number
  revenue: number
}

// Palette Warna Khusus untuk Setiap Cabang
const BRANCH_COLORS = [
  '#3b82f6', // Biru
  '#f97316', // Oranye
  '#10b981', // Hijau
  '#8b5cf6', // Ungu
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
]

export default function OwnerDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalSalesCount, setTotalSalesCount] = useState(0)
  const [branchRevenues, setBranchRevenues] = useState<BranchRevenue[]>([])
  const [lowStockList, setLowStockList] = useState<LowStockAlert[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])

  // State untuk Data Grafik Bulanan Per Cabang
  const [monthlyChartData, setMonthlyChartData] = useState<any[]>([])
  const [outletsList, setOutletsList] = useState<string[]>([])

  useEffect(() => {
    loadOwnerAnalytics()
  }, [])

  const loadOwnerAnalytics = async () => {
    try {
      setLoading(true)

      // 1. Fetch Seluruh Transaksi Penjualan Global
      const { data: salesData, error: salesError } = await supabase
        .from('transactions')
        .select('created_at, total_amount, outlet_id, outlets(name)')

      if (salesError) throw salesError

      if (salesData) {
        const grandTotal = salesData.reduce((sum, s) => sum + Number(s.total_amount), 0)
        setTotalRevenue(grandTotal)
        setTotalSalesCount(salesData.length)

        // A. Grouping Omzet Total Per Cabang
        const revenueByBranch: { [key: string]: { name: string; sum: number; count: number } } = {}
        salesData.forEach((s: any) => {
          const outletId = s.outlet_id || 'unassigned'
          const name = s.outlets?.name || 'Pusat/Lainnya'
          if (!revenueByBranch[outletId]) {
            revenueByBranch[outletId] = { name, sum: 0, count: 0 }
          }
          revenueByBranch[outletId].sum += Number(s.total_amount)
          revenueByBranch[outletId].count += 1
        })

        setBranchRevenues(
          Object.values(revenueByBranch).map((b) => ({
            outletName: b.name,
            totalRevenue: b.sum,
            totalTransactions: b.count,
          }))
        )

        // B. Olah Data untuk Grafik Batang Bulanan Per Cabang
        const monthNames = [
          'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
          'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
        ]

        const uniqueOutlets = Array.from(
          new Set(salesData.map((s: any) => s.outlets?.name || 'Cabang Lain'))
        )
        setOutletsList(uniqueOutlets)

        // Inisialisasi struktur bulan
        const chartMap: { [key: number]: any } = {}
        for (let i = 0; i < 12; i++) {
          chartMap[i] = { bulan: monthNames[i] }
          uniqueOutlets.forEach((outletName) => {
            chartMap[i][outletName] = 0
          })
        }

        // Isi data nominal per bulan per cabang
        salesData.forEach((s: any) => {
          const date = new Date(s.created_at)
          const monthIdx = date.getMonth()
          const outletName = s.outlets?.name || 'Cabang Lain'
          chartMap[monthIdx][outletName] = (chartMap[monthIdx][outletName] || 0) + Number(s.total_amount)
        })

        setMonthlyChartData(Object.values(chartMap))
      }

      // 2. Fetch Alert Stok Menipis Lintas Cabang
      const { data: stocksData } = await supabase
        .from('outlet_stocks')
        .select('stock, min_stock, outlets(name), products(name)')

      if (stocksData) {
        const alerts: LowStockAlert[] = stocksData
          .filter((item: any) => item.stock <= item.min_stock)
          .map((item: any) => ({
            outletName: item.outlets?.name || 'Cabang',
            productName: item.products?.name || 'Produk',
            stock: item.stock,
            minStock: item.min_stock,
          }))

        setLowStockList(alerts)
      }

      // 3. Fetch 5 Produk Terlaku (Top 5 Best Seller)
      const { data: itemsData } = await supabase
        .from('transaction_items')
        .select('qty, subtotal, products(name)')

      if (itemsData) {
        const productMap: { [key: string]: { name: string; qty: number; revenue: number } } = {}

        itemsData.forEach((item: any) => {
          const prodName = item.products?.name || 'Produk'
          if (!productMap[prodName]) {
            productMap[prodName] = { name: prodName, qty: 0, revenue: 0 }
          }
          productMap[prodName].qty += Number(item.qty || 0)
          productMap[prodName].revenue += Number(item.subtotal || 0)
        })

        const sortedTopProducts = Object.values(productMap)
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 5)

        setTopProducts(sortedTopProducts)
      }

    } catch (err) {
      console.error('Gagal memuat analitik owner:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      {/* HEADER PAGE */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Executive Dashboard Owner</h1>
        <p className="text-xs text-slate-500 mt-1">
          Ringkasan performa finansial & operasional seluruh cabang Toko Cat.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-20 text-xs text-slate-400">Memproses analitik bisnis...</div>
      ) : (
        <>
          {/* TOP METRIC CARDS - RESPONSIVE GRID (1 col di HP, 3 col di tablet/desktop) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Omzet Global</p>
              <h2 className="text-xl sm:text-2xl font-extrabold text-blue-600 mt-2">
                Rp {totalRevenue.toLocaleString('id-ID')}
              </h2>
              <p className="text-[11px] text-slate-400 mt-1.5">Akumulasi dari seluruh cabang</p>
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Transaksi</p>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-2">{totalSalesCount} Transaksi</h2>
              <p className="text-[11px] text-slate-400 mt-1.5">Struk berhasil terproses</p>
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm sm:col-span-2 md:col-span-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Peringatan Stok Menipis</p>
              <h2 className="text-xl sm:text-2xl font-extrabold text-amber-600 mt-2">{lowStockList.length} Item</h2>
              <p className="text-[11px] text-slate-400 mt-1.5">Butuh restock / transfer barang</p>
            </div>
          </div>

          {/* GRAFIK OMZET BULANAN PER CABANG */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-3 gap-1">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Grafik Penjualan Bulanan Per Cabang</h2>
                <p className="text-xs text-slate-400 mt-0.5">Perbandingan omzet bulanan antar lokasi cabang toko</p>
              </div>
            </div>

            {/* Container grafik dinamis h-64 di HP, h-80 di Laptop */}
            <div className="h-64 sm:h-80 w-full pt-2 sm:pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="bulan" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis
                    domain={[0, 'auto']}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => val >= 1000000 ? `${(val / 1000000).toFixed(0)}Jt` : val}
                  />
                  <Tooltip
                    formatter={(value: any) => [`Rp ${Number(value).toLocaleString('id-ID')}`, 'Omzet']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  {outletsList.map((outletName, idx) => (
                    <Bar
                      key={outletName}
                      dataKey={outletName}
                      name={outletName}
                      fill={BRANCH_COLORS[idx % BRANCH_COLORS.length]}
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* GRID SECTION: RINGKASAN CABANG, TOP 5 PRODUK, & STOK MENIPIS (1 col di HP, 3 col di Desktop) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            
            {/* 1. Omzet Per Cabang */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
                Omzet Penjualan Per Cabang
              </h2>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {branchRevenues.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Belum ada transaksi.</p>
                ) : (
                  branchRevenues.map((b, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                      <div className="pr-2">
                        <p className="font-semibold text-xs text-slate-800">{b.outletName}</p>
                        <p className="text-[10px] text-slate-400">{b.totalTransactions} Transaksi</p>
                      </div>
                      <span className="font-bold text-xs text-blue-600 whitespace-nowrap">
                        Rp {b.totalRevenue.toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 2. Top 5 Produk Terlaku */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
                🏆 5 Produk Terlaku (Best Seller)
              </h2>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {topProducts.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Belum ada data barang terjual.</p>
                ) : (
                  topProducts.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl text-xs gap-2">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <span className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center font-bold text-[10px] ${
                          idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{p.name}</p>
                          <p className="text-[10px] text-slate-400">Terjual: <span className="font-bold text-slate-700">{p.qty} unit</span></p>
                        </div>
                      </div>
                      <span className="font-bold text-emerald-600 text-xs whitespace-nowrap">
                        Rp {p.revenue.toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 3. Status Stok Menipis */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 md:col-span-2 lg:col-span-1">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
                ⚠️ Stok Menipis Lintas Cabang
              </h2>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {lowStockList.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Seluruh stok cabang dalam kondisi aman.</p>
                ) : (
                  lowStockList.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 border border-amber-100 bg-amber-50/50 rounded-xl text-xs gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{item.productName}</p>
                        <p className="text-slate-500">Cabang: <span className="font-medium text-slate-700">{item.outletName}</span></p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[11px]">
                          Sisa: {item.stock}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-1">Min: {item.minStock}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  )
}