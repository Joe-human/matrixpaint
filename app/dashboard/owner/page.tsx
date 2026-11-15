'use client'

import { useState, useEffect, useCallback } from 'react'
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
import {
  TrendingUp,
  ShoppingBag,
  AlertTriangle,
  RefreshCw,
  Building2,
  Trophy,
} from 'lucide-react'

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
  '#2563eb', // Blue 600
  '#f97316', // Orange 500
  '#10b981', // Emerald 500
  '#8b5cf6', // Violet 500
  '#ec4899', // Pink 500
  '#f59e0b', // Amber 500
  '#06b6d4', // Cyan 500
]

export default function OwnerDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()])

  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalSalesCount, setTotalSalesCount] = useState(0)
  const [branchRevenues, setBranchRevenues] = useState<BranchRevenue[]>([])
  const [lowStockList, setLowStockList] = useState<LowStockAlert[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])

  // State untuk Data Grafik Bulanan Per Cabang
  const [monthlyChartData, setMonthlyChartData] = useState<Record<string, string | number>[]>([])
  const [outletsList, setOutletsList] = useState<string[]>([])

  const loadOwnerAnalytics = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      // 1. Fetch Seluruh Transaksi Penjualan Global
      const { data: salesData, error: salesError } = await supabase
        .from('transactions')
        .select('created_at, total_amount, outlet_id, outlets(name)')

      if (salesError) throw salesError

      if (salesData) {
        // Kumpulkan daftar tahun unik dari transaksi
        const yearsSet = new Set<number>([new Date().getFullYear()])
        salesData.forEach((s: any) => {
          if (s.created_at) {
            yearsSet.add(new Date(s.created_at).getFullYear())
          }
        })
        setAvailableYears(Array.from(yearsSet).sort((a, b) => b - a))

        const grandTotal = salesData.reduce((sum, s) => sum + Number(s.total_amount || 0), 0)
        setTotalRevenue(grandTotal)
        setTotalSalesCount(salesData.length)

        // A. Grouping Omzet Total Per Cabang
        const revenueByBranch: Record<string, { name: string; sum: number; count: number }> = {}
        salesData.forEach((s: any) => {
          const outletId = s.outlet_id || 'unassigned'
          const name = s.outlets?.name || 'Pusat/Lainnya'
          if (!revenueByBranch[outletId]) {
            revenueByBranch[outletId] = { name, sum: 0, count: 0 }
          }
          revenueByBranch[outletId].sum += Number(s.total_amount || 0)
          revenueByBranch[outletId].count += 1
        })

        setBranchRevenues(
          Object.values(revenueByBranch)
            .map((b) => ({
              outletName: b.name,
              totalRevenue: b.sum,
              totalTransactions: b.count,
            }))
            .sort((a, b) => b.totalRevenue - a.totalRevenue)
        )

        // B. Olah Data untuk Grafik Batang Bulanan Per Cabang (Sesuai Tahun Terpilih)
        const monthNames = [
          'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
          'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
        ]

        const uniqueOutlets = Array.from(
          new Set(salesData.map((s: any) => s.outlets?.name || 'Cabang Lain'))
        )
        setOutletsList(uniqueOutlets)

        const chartMap: Record<number, Record<string, string | number>> = {}
        for (let i = 0; i < 12; i++) {
          chartMap[i] = { bulan: monthNames[i] }
          uniqueOutlets.forEach((outletName) => {
            chartMap[i][outletName] = 0
          })
        }

        salesData.forEach((s: any) => {
          const date = new Date(s.created_at)
          if (date.getFullYear() === selectedYear) {
            const monthIdx = date.getMonth()
            const outletName = s.outlets?.name || 'Cabang Lain'
            chartMap[monthIdx][outletName] =
              Number(chartMap[monthIdx][outletName] || 0) + Number(s.total_amount || 0)
          }
        })

        setMonthlyChartData(Object.values(chartMap))
      }

      // 2. Fetch Alert Stok Menipis Lintas Cabang
      const { data: stocksData, error: stocksError } = await supabase
        .from('outlet_stocks')
        .select('stock, min_stock, outlets(name), products(name)')

      if (stocksError) throw stocksError

      if (stocksData) {
        const alerts: LowStockAlert[] = stocksData
          .filter((item: any) => Number(item.stock) <= Number(item.min_stock))
          .map((item: any) => ({
            outletName: item.outlets?.name || 'Cabang',
            productName: item.products?.name || 'Produk',
            stock: Number(item.stock),
            minStock: Number(item.min_stock),
          }))
          .sort((a, b) => a.stock - b.stock)

        setLowStockList(alerts)
      }

      // 3. Fetch 5 Produk Terlaku (Top 5 Best Seller)
      const { data: itemsData, error: itemsError } = await supabase
        .from('transaction_items')
        .select('qty, subtotal, products(name)')

      if (itemsError) throw itemsError

      if (itemsData) {
        const productMap: Record<string, { name: string; qty: number; revenue: number }> = {}

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
      setRefreshing(false)
    }
  }, [selectedYear])

  useEffect(() => {
    loadOwnerAnalytics()
  }, [loadOwnerAnalytics])

  return (
    <div className="p-3 min-[375px]:p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 max-w-7xl mx-auto space-y-5 sm:space-y-7">
      {/* HEADER PAGE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg min-[375px]:text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Executive Dashboard Owner
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
            Ringkasan performa finansial & operasional seluruh cabang Toko Cat.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <select
            aria-label="Filter Tahun"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                Tahun {yr}
              </option>
            ))}
          </select>

          <button
            onClick={() => loadOwnerAnalytics(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 active:scale-[0.98] border border-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl shadow-sm transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden min-[360px]:inline">Refresh</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white h-28 rounded-2xl border border-slate-200 p-5" />
            ))}
          </div>
          <div className="bg-white h-72 sm:h-80 rounded-2xl border border-slate-200 p-5" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white h-64 rounded-2xl border border-slate-200 p-5" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* TOP METRIC CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
            {/* Card 1: Total Omzet */}
            <div className="bg-white p-4 min-[375px]:p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Total Omzet Global
                </p>
                <h2 className="text-lg min-[375px]:text-xl sm:text-2xl font-extrabold text-blue-600 mt-1.5 break-words">
                  Rp {totalRevenue.toLocaleString('id-ID')}
                </h2>
                <p className="text-[11px] text-slate-400 mt-1">Akumulasi dari seluruh cabang</p>
              </div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>

            {/* Card 2: Total Transaksi */}
            <div className="bg-white p-4 min-[375px]:p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Total Transaksi
                </p>
                <h2 className="text-lg min-[375px]:text-xl sm:text-2xl font-extrabold text-slate-900 mt-1.5">
                  {totalSalesCount.toLocaleString('id-ID')} Transaksi
                </h2>
                <p className="text-[11px] text-slate-400 mt-1">Struk berhasil terproses</p>
              </div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>

            {/* Card 3: Peringatan Stok */}
            <div className="bg-white p-4 min-[375px]:p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm flex items-start justify-between gap-3 sm:col-span-2 lg:col-span-1">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Peringatan Stok Menipis
                </p>
                <h2 className="text-lg min-[375px]:text-xl sm:text-2xl font-extrabold text-amber-600 mt-1.5">
                  {lowStockList.length} Item
                </h2>
                <p className="text-[11px] text-slate-400 mt-1">Butuh restock / transfer barang</p>
              </div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
          </div>

          {/* GRAFIK OMZET BULANAN PER CABANG */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-3 gap-1">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Grafik Penjualan Bulanan Per Cabang ({selectedYear})
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                  Perbandingan omzet bulanan antar lokasi cabang toko
                </p>
              </div>
            </div>

            <div className="h-60 min-[375px]:h-64 sm:h-80 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyChartData}
                  margin={{ top: 8, right: 6, left: -18, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="bulan"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis
                    domain={[0, 'auto']}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) =>
                      val >= 1000000
                        ? `${(val / 1000000).toFixed(0)}Jt`
                        : val >= 1000
                        ? `${(val / 1000).toFixed(0)}Rb`
                        : String(val)
                    }
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      `Rp ${Number(value).toLocaleString('id-ID')}`,
                      String(name),
                    ]}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  {outletsList.map((outletName, idx) => (
                    <Bar
                      key={outletName}
                      dataKey={outletName}
                      name={outletName}
                      fill={BRANCH_COLORS[idx % BRANCH_COLORS.length]}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={36}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* GRID SECTION: RINGKASAN CABANG, TOP 5 PRODUK, & STOK MENIPIS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* 1. Omzet Per Cabang */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3.5">
                <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                <h2 className="text-sm font-bold text-slate-900 truncate">
                  Omzet Penjualan Per Cabang
                </h2>
              </div>
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-0.5">
                {branchRevenues.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">Belum ada transaksi.</p>
                ) : (
                  branchRevenues.map((b, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center p-3 bg-slate-50/90 hover:bg-slate-100/80 transition rounded-xl gap-2"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-xs text-slate-800 truncate">
                          {b.outletName}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {b.totalTransactions} Transaksi
                        </p>
                      </div>
                      <span className="font-bold text-xs text-blue-600 whitespace-nowrap shrink-0">
                        Rp {b.totalRevenue.toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 2. Top 5 Produk Terlaku */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3.5">
                <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                <h2 className="text-sm font-bold text-slate-900 truncate">
                  5 Produk Terlaku (Best Seller)
                </h2>
              </div>
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-0.5">
                {topProducts.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">
                    Belum ada data barang terjual.
                  </p>
                ) : (
                  topProducts.map((p, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center p-3 bg-slate-50/90 hover:bg-slate-100/80 transition rounded-xl text-xs gap-2"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <span
                          className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center font-bold text-[10px] ${
                            idx === 0
                              ? 'bg-amber-100 text-amber-700'
                              : idx === 1
                              ? 'bg-slate-200 text-slate-700'
                              : idx === 2
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{p.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Terjual: <span className="font-bold text-slate-700">{p.qty} unit</span>
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-emerald-600 text-xs whitespace-nowrap shrink-0">
                        Rp {p.revenue.toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 3. Status Stok Menipis */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col md:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <h2 className="text-sm font-bold text-slate-900 truncate">
                  Stok Menipis Lintas Cabang
                </h2>
              </div>
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-0.5">
                {lowStockList.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">
                    Seluruh stok cabang dalam kondisi aman.
                  </p>
                ) : (
                  lowStockList.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center p-3 border border-amber-100 bg-amber-50/50 rounded-xl text-xs gap-2"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{item.productName}</p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          Cabang: <span className="font-medium text-slate-700">{item.outletName}</span>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[11px] inline-block">
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