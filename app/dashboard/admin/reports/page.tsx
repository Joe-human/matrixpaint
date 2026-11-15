'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  Printer,
  Search,
  Building2,
  ChevronDown,
  Package,
} from 'lucide-react'

interface ReportRow {
  outletId: string
  outletName: string
  sku: string
  name: string
  unit: string
  costPrice: number
  price: number
  totalQtySold: number
  totalStock: number
  totalRevenue: number
  totalCost: number
}

interface OutletOption {
  id: string
  name: string
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<'daily' | 'monthly' | 'yearly'>('daily')
  const [reportData, setReportData] = useState<ReportRow[]>([])
  const [outlets, setOutlets] = useState<OutletOption[]>([])
  const [selectedOutletId, setSelectedOutletId] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [printDate, setPrintDate] = useState<string>('')
  const exportMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true)
      const startDate = new Date()

      if (period === 'daily') startDate.setHours(0, 0, 0, 0)
      else if (period === 'monthly') {
        startDate.setDate(1)
        startDate.setHours(0, 0, 0, 0)
      } else if (period === 'yearly') {
        startDate.setMonth(0, 1)
        startDate.setHours(0, 0, 0, 0)
      }

      const [outletsRes, productsRes, txItemsRes] = await Promise.all([
        supabase.from('outlets').select('id, name').order('name', { ascending: true }),
        supabase.from('products').select(`
          id, sku, name, unit, price, cost_price, outlet_stocks(outlet_id, stock)
        `),
        supabase
          .from('transaction_items')
          .select(`
            product_id, qty, subtotal, transactions!inner(created_at, outlet_id)
          `)
          .gte('transactions.created_at', startDate.toISOString()),
      ])

      const outletsData = outletsRes.data || []
      const productsData = productsRes.data || []
      const transactionItemsData = txItemsRes.data || []

      setOutlets(outletsData)

      const rows: ReportRow[] = []

      outletsData.forEach((outlet: any) => {
        productsData.forEach((prod: any) => {
          const stocksArr = Array.isArray(prod.outlet_stocks) ? prod.outlet_stocks : []
          const stockObj = stocksArr.find((s: any) => s.outlet_id === outlet.id)
          const branchStock = stockObj ? Number(stockObj.stock || 0) : 0

          const itemsForBranchAndProd = transactionItemsData.filter(
            (item: any) =>
              item.product_id === prod.id && item.transactions?.outlet_id === outlet.id
          )

          const totalQtySold = itemsForBranchAndProd.reduce(
            (s: number, item: any) => s + Number(item.qty || 0),
            0
          )
          const totalRevenue = itemsForBranchAndProd.reduce(
            (s: number, item: any) => s + Number(item.subtotal || 0),
            0
          )
          const totalCost = totalQtySold * Number(prod.cost_price || 0)

          if (branchStock > 0 || totalQtySold > 0) {
            rows.push({
              outletId: outlet.id,
              outletName: outlet.name,
              sku: prod.sku,
              name: prod.name,
              unit: prod.unit || 'kaleng',
              costPrice: Number(prod.cost_price || 0),
              price: Number(prod.price || 0),
              totalQtySold,
              totalStock: branchStock,
              totalRevenue,
              totalCost,
            })
          }
        })
      })

      setReportData(rows)
    } catch (err) {
      console.error('Gagal memuat rekap:', err)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    const now = new Date()
    const formattedDate =
      now.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }) + ' WIB'
    setPrintDate(formattedDate)

    fetchReport()
  }, [fetchReport])

  const filteredData = reportData.filter((row) => {
    const matchesOutlet = selectedOutletId === 'ALL' || row.outletId === selectedOutletId
    const q = searchQuery.toLowerCase()
    const matchesQuery =
      (row.sku || '').toLowerCase().includes(q) ||
      (row.name || '').toLowerCase().includes(q) ||
      (row.outletName || '').toLowerCase().includes(q)
    return matchesOutlet && matchesQuery
  })

  const grandTotalQtySold = filteredData.reduce((sum, r) => sum + r.totalQtySold, 0)
  const grandTotalStock = filteredData.reduce((sum, r) => sum + r.totalStock, 0)
  const grandTotalCost = filteredData.reduce((sum, r) => sum + r.totalCost, 0)
  const grandTotalRevenue = filteredData.reduce((sum, r) => sum + r.totalRevenue, 0)
  const grandTotalProfit = grandTotalRevenue - grandTotalCost

  const exportToExcel = () => {
    setShowExportMenu(false)
    const periodName =
      period === 'daily' ? 'HARIAN' : period === 'monthly' ? 'BULANAN' : 'TAHUNAN'
    const branchLabel =
      selectedOutletId === 'ALL'
        ? 'SEMUA CABANG'
        : outlets.find((o) => o.id === selectedOutletId)?.name.toUpperCase() || 'CABANG'

    const excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; }
          .title { font-size: 16pt; font-weight: bold; color: #0f172a; }
          .subtitle { font-size: 10pt; color: #64748b; margin-bottom: 15px; }
          .header { background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; }
          .total-row { background-color: #e2e8f0; font-weight: bold; }
          .num { text-align: right; }
          .center { text-align: center; }
        </style>
      </head>
      <body>
        <div class="title">MATRIXPAINT — LAPORAN REKAP ${branchLabel} (${periodName})</div>
        <div class="subtitle">Tanggal Ekspor: ${printDate} | Enterprise POS & Inventory Management</div>
        <br/>
        <table border="1" cellspacing="0" cellpadding="6">
          <thead>
            <tr class="header">
              <th>No</th>
              <th>Cabang Toko</th>
              <th>SKU / Kode</th>
              <th>Nama Barang</th>
              <th>Satuan</th>
              <th>Harga Beli (HPP)</th>
              <th>Harga Jual</th>
              <th>Terjual (Qty)</th>
              <th>Sisa Stok</th>
              <th>Total Modal (HPP)</th>
              <th>Total Omzet</th>
              <th>Estimasi Laba Kotor</th>
            </tr>
          </thead>
          <tbody>
            ${filteredData
              .map(
                (r, i) => `
              <tr>
                <td class="center">${i + 1}</td>
                <td><b>${r.outletName}</b></td>
                <td>${r.sku}</td>
                <td>${r.name}</td>
                <td class="center">${r.unit}</td>
                <td class="num">Rp ${r.costPrice.toLocaleString('id-ID')}</td>
                <td class="num">Rp ${r.price.toLocaleString('id-ID')}</td>
                <td class="center">${r.totalQtySold}</td>
                <td class="center">${r.totalStock}</td>
                <td class="num">Rp ${r.totalCost.toLocaleString('id-ID')}</td>
                <td class="num">Rp ${r.totalRevenue.toLocaleString('id-ID')}</td>
                <td class="num">Rp ${(r.totalRevenue - r.totalCost).toLocaleString('id-ID')}</td>
              </tr>`
              )
              .join('')}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="7" align="right">TOTAL AKUMULASI PERIODE (${periodName}):</td>
              <td class="center">${grandTotalQtySold}</td>
              <td class="center">${grandTotalStock}</td>
              <td class="num">Rp ${grandTotalCost.toLocaleString('id-ID')}</td>
              <td class="num">Rp ${grandTotalRevenue.toLocaleString('id-ID')}</td>
              <td class="num">Rp ${grandTotalProfit.toLocaleString('id-ID')}</td>
            </tr>
          </tfoot>
        </table>
      </body>
      </html>`

    const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Laporan_Rekap_PerCabang_${periodName}_${Date.now()}.xls`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportToPDF = () => {
    setShowExportMenu(false)
    setTimeout(() => {
      window.print()
    }, 150)
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            margin: 12mm;
            size: A4 landscape;
          }
          aside,
          header,
          .print\\:hidden {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
            font-family: Arial, sans-serif !important;
          }
          .print-full-width {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>

      <div className="p-3 min-[375px]:p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 max-w-7xl mx-auto space-y-5 sm:space-y-6 print-full-width print:p-0 print:m-0 print:bg-white">
        {/* HEADER WEBSITE */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 print:hidden">
          <div>
            <h1 className="text-lg min-[375px]:text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 shrink-0" />
              <span>Laporan & Rekap Operasional Per Cabang</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
              Rekapitulasi rincian barang, cabang, HPP, omzet, dan sisa stok fisik.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end">
            <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex space-x-1 text-xs">
              {(['daily', 'monthly', 'yearly'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                    period === p
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {p === 'daily' ? 'Harian' : p === 'monthly' ? 'Bulanan' : 'Tahunan'}
                </button>
              ))}
            </div>

            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setShowExportMenu((prev) => !prev)}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 transition inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 py-1 text-xs divide-y divide-slate-100">
                  <button
                    onClick={exportToExcel}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 font-semibold text-slate-700 flex items-center gap-2.5 transition"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Export Excel (.xls)</span>
                  </button>
                  <button
                    onClick={exportToPDF}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 font-semibold text-slate-700 flex items-center gap-2.5 transition"
                  >
                    <Printer className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Cetak PDF / Print</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FILTER CABANG & CARI PRODUK */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row gap-3 print:hidden">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari kode SKU atau nama barang..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
            />
          </div>

          <select
            aria-label="Filter Cabang"
            value={selectedOutletId}
            onChange={(e) => setSelectedOutletId(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:bg-white focus:border-blue-500 transition"
          >
            <option value="ALL">Semua Cabang ({outlets.length})</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        {/* KOP PDF */}
        <div className="hidden print:block mb-6 border-b-2 border-slate-900 pb-3">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-black tracking-wider text-slate-900">
                MATRIX<span className="text-blue-600">PAINT</span>
              </h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                Enterprise POS & Inventory Management System
              </p>
            </div>
            <div className="text-right">
              <h2 className="text-sm font-bold uppercase text-slate-900 tracking-wider">
                LAPORAN REKAP PER CABANG ({period.toUpperCase()})
              </h2>
              <p className="text-[10px] font-medium text-slate-600 mt-1">
                Tanggal Cetak: <span className="font-bold text-slate-900">{printDate}</span>
              </p>
            </div>
          </div>
        </div>

        {/* CARDS STATISTIK */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 print:grid-cols-4 print:gap-2 print:mb-4">
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/90 shadow-sm print:p-2.5 print:border-slate-300">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Total Terjual</p>
            <p className="text-sm min-[375px]:text-base sm:text-lg font-extrabold text-slate-900 mt-1">
              {grandTotalQtySold.toLocaleString('id-ID')} Item
            </p>
          </div>
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/90 shadow-sm print:p-2.5 print:border-slate-300">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Total Sisa Stok</p>
            <p className="text-sm min-[375px]:text-base sm:text-lg font-extrabold text-blue-600 mt-1">
              {grandTotalStock.toLocaleString('id-ID')} Unit
            </p>
          </div>
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/90 shadow-sm print:p-2.5 print:border-slate-300">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Total Omzet</p>
            <p className="text-sm min-[375px]:text-base sm:text-lg font-extrabold text-emerald-600 mt-1 break-words">
              Rp {grandTotalRevenue.toLocaleString('id-ID')}
            </p>
          </div>
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/90 shadow-sm print:p-2.5 print:border-slate-300">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Estimasi Laba Kotor</p>
            <p className="text-sm min-[375px]:text-base sm:text-lg font-extrabold text-indigo-600 mt-1 break-words">
              Rp {grandTotalProfit.toLocaleString('id-ID')}
            </p>
          </div>
        </div>

        {/* HASIL LAPORAN PER CABANG */}
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden print:border print:border-slate-300 print:shadow-none">
          {loading ? (
            <div className="p-5 space-y-3 animate-pulse">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-16 bg-slate-100 rounded-xl" />
              ))}
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-14 px-4 space-y-1.5">
              <Package className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs sm:text-sm font-semibold text-slate-600">
                Belum ada data stok atau transaksi pada periode ini
              </p>
              <p className="text-[11px] text-slate-400">
                Coba pilih rentang periode lain atau reset filter pencarian.
              </p>
            </div>
          ) : (
            <>
              {/* TAMPILAN MOBILE (< 768px): CARD LIST (Disembunyikan saat Print PDF) */}
              <div className="md:hidden divide-y divide-slate-100 print:hidden">
                {filteredData.map((row) => (
                  <div
                    key={`${row.outletId}-${row.sku}`}
                    className="p-3.5 min-[375px]:p-4 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                          <Building2 className="w-3 h-3 shrink-0" />
                          <span className="truncate">{row.outletName}</span>
                        </span>
                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 mt-1.5 break-words">
                          {row.name}
                        </h3>
                        <p className="font-mono text-[10px] text-slate-400 mt-0.5">
                          SKU: {row.sku} • Satuan: <span className="capitalize">{row.unit}</span>
                        </p>
                      </div>

                      <div className="text-right shrink-0 space-y-1">
                        <span className="block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                          Terjual: {row.totalQtySold}
                        </span>
                        <span className="block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">
                          Sisa: {row.totalStock}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl text-[11px]">
                      <div>
                        <p className="text-[10px] text-slate-400">Modal / HPP</p>
                        <p className="font-semibold text-slate-700 mt-0.5">
                          Rp {row.totalCost.toLocaleString('id-ID')}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          (@Rp {row.costPrice.toLocaleString('id-ID')})
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400">Total Omzet</p>
                        <p className="font-extrabold text-emerald-600 mt-0.5">
                          Rp {row.totalRevenue.toLocaleString('id-ID')}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          (@Rp {row.price.toLocaleString('id-ID')})
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* TAMPILAN DESKTOP / TABLET (>= 768px) & MODE PRINT PDF */}
              <div className="hidden md:block print:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs print:text-[10px] min-w-[850px] print:min-w-0">
                  <thead>
                    <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider print:bg-slate-900 print:text-white">
                      <th className="py-3.5 px-4 print:py-2 print:px-2">Cabang Toko</th>
                      <th className="py-3.5 px-4 print:py-2 print:px-2">SKU / Kode</th>
                      <th className="py-3.5 px-4 print:py-2 print:px-2">Nama Barang</th>
                      <th className="py-3.5 px-4 print:py-2 print:px-2">Satuan</th>
                      <th className="py-3.5 px-4 text-right print:py-2 print:px-2">Harga Beli</th>
                      <th className="py-3.5 px-4 text-right print:py-2 print:px-2">Harga Jual</th>
                      <th className="py-3.5 px-4 text-center print:py-2 print:px-2">Terjual</th>
                      <th className="py-3.5 px-4 text-center print:py-2 print:px-2">Stok</th>
                      <th className="py-3.5 px-4 text-right print:py-2 print:px-2">Total Modal</th>
                      <th className="py-3.5 px-4 text-right print:py-2 print:px-2">Total Omzet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 print:divide-slate-200 text-slate-700">
                    {filteredData.map((row, idx) => (
                      <tr
                        key={`${row.outletId}-${row.sku}`}
                        className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60 print:bg-slate-50'}
                      >
                        <td className="py-3 px-4 print:py-1.5 print:px-2 font-bold text-blue-600 whitespace-nowrap">
                          {row.outletName}
                        </td>
                        <td className="py-3 px-4 print:py-1.5 print:px-2 font-mono font-semibold text-slate-900 whitespace-nowrap">
                          {row.sku}
                        </td>
                        <td className="py-3 px-4 print:py-1.5 print:px-2 font-medium text-slate-800 whitespace-nowrap">
                          {row.name}
                        </td>
                        <td className="py-3 px-4 print:py-1.5 print:px-2 text-slate-500 capitalize whitespace-nowrap">
                          {row.unit}
                        </td>
                        <td className="py-3 px-4 print:py-1.5 print:px-2 text-right text-slate-600 whitespace-nowrap">
                          Rp {row.costPrice.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 print:py-1.5 print:px-2 text-right font-medium text-slate-800 whitespace-nowrap">
                          Rp {row.price.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 print:py-1.5 print:px-2 text-center font-bold text-slate-900">
                          {row.totalQtySold}
                        </td>
                        <td className="py-3 px-4 print:py-1.5 print:px-2 text-center font-semibold text-blue-600">
                          {row.totalStock}
                        </td>
                        <td className="py-3 px-4 print:py-1.5 print:px-2 text-right text-slate-500 whitespace-nowrap">
                          Rp {row.totalCost.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 print:py-1.5 print:px-2 text-right font-bold text-emerald-600 print:text-slate-900 whitespace-nowrap">
                          Rp {row.totalRevenue.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  <tfoot>
                    <tr className="bg-slate-100 print:bg-slate-200 font-black text-slate-900 border-t-2 border-slate-400">
                      <td
                        colSpan={6}
                        className="py-3.5 px-4 print:py-2 print:px-2 text-right uppercase text-xs print:text-[10px]"
                      >
                        TOTAL AKUMULASI PERIODE ({period.toUpperCase()}):
                      </td>
                      <td className="py-3.5 px-4 print:py-2 print:px-2 text-center text-sm print:text-xs">
                        {grandTotalQtySold}
                      </td>
                      <td className="py-3.5 px-4 print:py-2 print:px-2 text-center text-sm print:text-xs text-blue-700">
                        {grandTotalStock}
                      </td>
                      <td className="py-3.5 px-4 print:py-2 print:px-2 text-right text-xs print:text-[10px] text-slate-700 whitespace-nowrap">
                        Rp {grandTotalCost.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 print:py-2 print:px-2 text-right text-sm print:text-xs text-emerald-700 print:text-slate-900 whitespace-nowrap">
                        Rp {grandTotalRevenue.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}