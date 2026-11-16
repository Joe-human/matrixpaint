'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import {
  Boxes,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  AlertTriangle,
  Package,
  FileSpreadsheet,
  Upload,
  Download,
} from 'lucide-react'

interface ProductMaster {
  id: string
  sku: string
  name: string
  brand: string
  category: string
  price: number
  cost_price: number
  unit: string
}

interface Outlet {
  id: string
  name: string
}

const CATEGORIES = [
  'Cat & Coating',
  'Perlengkapan & Alat Cat',
  'Thinner & Cairan Kimia',
  'Semen & Kompon',
  'Aksesoris & Keamanan',
  'Lain-lain',
]

const UNITS = [
  { value: 'pcs', label: 'Pcs / Buah' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'liter', label: 'Liter (L)' },
  { value: 'gram', label: 'Gram (gr)' },
  { value: 'ml', label: 'Mililiter (ml)' },
  { value: 'meter', label: 'Meter (m)' },
  { value: 'kaleng', label: 'Kaleng' },
  { value: 'galon', label: 'Galon' },
  { value: 'pail', label: 'Pail (20L)' },
  { value: 'sak', label: 'Sak (20kg)' },
  { value: 'botol', label: 'Botol' },
  { value: 'roll', label: 'Roll' },
]

export default function MasterProductsPage() {
  const [products, setProducts] = useState<ProductMaster[]>([])
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [loading, setLoading] = useState(true)

  // Filter & Pencarian Katalog
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('ALL')

  // Banner Notifikasi Non-Blocking
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  )

  // State Form Produk Baru
  const [sku, setSku] = useState('')
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState('Cat & Coating')
  const [price, setPrice] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [unit, setUnit] = useState('kaleng')

  // State Stok Awal & Harga Khusus per Cabang
  const [initialStocks, setInitialStocks] = useState<Record<string, number>>({})
  const [initialOutletPrices, setInitialOutletPrices] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // State Import Excel
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [importing, setImporting] = useState(false)

  // State Modal Edit Produk
  const [editingProduct, setEditingProduct] = useState<ProductMaster | null>(null)
  const [editSku, setEditSku] = useState('')
  const [editName, setEditName] = useState('')
  const [editBrand, setEditBrand] = useState('')
  const [editCategory, setEditCategory] = useState('Cat & Coating')
  const [editPrice, setEditPrice] = useState('')
  const [editCostPrice, setEditCostPrice] = useState('')
  const [editUnit, setEditUnit] = useState('kaleng')
  const [editStocks, setEditStocks] = useState<Record<string, number>>({})
  const [editOutletPrices, setEditOutletPrices] = useState<Record<string, string>>({})
  const [updating, setUpdating] = useState(false)

  // State Konfirmasi Hapus
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev))
    }, 5000)
  }

  const getAdminCompanyId = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Sesi login tidak ditemukan, silakan login ulang.')

    let companyId: string | null = null
    const { data: profileById } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profileById?.company_id) {
      companyId = profileById.company_id
    } else if (user.email) {
      const { data: profileByEmail } = await supabase
        .from('users')
        .select('company_id')
        .eq('email', user.email)
        .maybeSingle()
      companyId = profileByEmail?.company_id || null
    }

    if (!companyId) throw new Error('Company ID tidak ditemukan pada akun Admin ini.')
    return companyId
  }, [])

  const fetchMasterData = useCallback(async () => {
    try {
      setLoading(true)
      const companyId = await getAdminCompanyId()

      // Ambil daftar cabang HANYA milik perusahaan/toko admin yang sedang login
      const { data: outletsData, error: outletErr } = await supabase
        .from('outlets')
        .select('id, name')
        .eq('company_id', companyId)
        .order('name', { ascending: true })

      if (outletErr) throw outletErr
      setOutlets(outletsData || [])

      // Ambil produk master HANYA milik perusahaan/toko admin yang sedang login
      const { data: productsData, error: prodErr } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })

      if (prodErr) throw prodErr
      setProducts((productsData as ProductMaster[]) || [])
    } catch (err: any) {
      console.error('Gagal mengambil katalog master:', err)
      showFeedback('error', err.message || 'Gagal memuat data katalog perusahaan.')
    } finally {
      setLoading(false)
    }
  }, [getAdminCompanyId])

  useEffect(() => {
    fetchMasterData()
  }, [fetchMasterData])

  const handleStockChange = (outletId: string, value: string) => {
    setInitialStocks((prev) => ({
      ...prev,
      [outletId]: Math.max(0, Number(value) || 0),
    }))
  }

  const handleOutletPriceChange = (outletId: string, value: string) => {
    setInitialOutletPrices((prev) => ({
      ...prev,
      [outletId]: value,
    }))
  }

  const handleEditStockChange = (outletId: string, value: string) => {
    setEditStocks((prev) => ({
      ...prev,
      [outletId]: Math.max(0, Number(value) || 0),
    }))
  }

  const handleEditOutletPriceChange = (outletId: string, value: string) => {
    setEditOutletPrices((prev) => ({
      ...prev,
      [outletId]: value,
    }))
  }

  // DOWNLOAD TEMPLATE EXCEL (HANYA CABANG MILIK TOKO INI)
  const handleDownloadTemplate = () => {
    const sampleRow: Record<string, any> = {
      SKU: 'CAT-OPL-KG',
      Nama_Produk: 'Cat Tembok Oplosan Kiloan Putih',
      Kategori: 'Cat & Coating',
      Brand: 'Nippon Paint',
      Satuan: 'kg',
      Harga_Jual_Default: 35000,
      HPP_Modal: 24000,
    }
    outlets.forEach((o) => {
      sampleRow[`Stok_${o.name}`] = 25
      sampleRow[`Harga_${o.name}`] = ''
    })

    const worksheet = XLSX.utils.json_to_sheet([sampleRow])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template_Katalog')
    XLSX.writeFile(workbook, 'Template_Import_Katalog_MatrixPaint.xlsx')
  }

  // EXPORT KATALOG SAAT INI KE EXCEL (TERISOLASI PER COMPANY_ID)
  const handleExportExcel = async () => {
    try {
      const outletIds = outlets.map((o) => o.id)

      const { data: allStocks, error: stockErr } =
        outletIds.length > 0
          ? await supabase
              .from('outlet_stocks')
              .select('product_id, outlet_id, stock, selling_price')
              .in('outlet_id', outletIds)
          : { data: [], error: null }

      if (stockErr) throw stockErr

      const stockLookup: Record<string, { stock: number; selling_price: number | null }> = {}
      if (allStocks) {
        allStocks.forEach((s: any) => {
          stockLookup[`${s.product_id}_${s.outlet_id}`] = {
            stock: Number(s.stock || 0),
            selling_price: s.selling_price !== null ? Number(s.selling_price) : null,
          }
        })
      }

      const rows = products.map((p) => {
        const row: Record<string, any> = {
          SKU: p.sku,
          Nama_Produk: p.name,
          Kategori: p.category || 'Cat & Coating',
          Brand: p.brand || '',
          Satuan: p.unit || 'pcs',
          Harga_Jual_Default: Number(p.price || 0),
          HPP_Modal: Number(p.cost_price || 0),
        }
        outlets.forEach((o) => {
          const info = stockLookup[`${p.id}_${o.id}`]
          row[`Stok_${o.name}`] = info ? info.stock : 0
          row[`Harga_${o.name}`] = info?.selling_price ?? ''
        })
        return row
      })

      const worksheet = XLSX.utils.json_to_sheet(rows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Katalog_MatrixPaint')
      XLSX.writeFile(workbook, `Katalog_MatrixPaint_${new Date().toISOString().slice(0, 10)}.xlsx`)
      showFeedback('success', `Berhasil export ${products.length} produk ke file Excel!`)
    } catch (err: any) {
      showFeedback('error', `Gagal export Excel: ${err.message}`)
    }
  }

  // IMPORT KATALOG DARI FILE EXCEL
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setFeedback(null)

    try {
      const companyId = await getAdminCompanyId()
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[sheetName])

      if (!rawRows || rawRows.length === 0) {
        throw new Error('File Excel kosong atau tidak memiliki baris data.')
      }

      let successCount = 0

      for (const row of rawRows) {
        const rawSku = String(row.SKU || row.sku || '').trim().toUpperCase()
        const rawName = String(row.Nama_Produk || row.nama_produk || row.Name || row.name || '').trim()
        if (!rawSku || !rawName) continue

        const rawCategory = String(row.Kategori || row.category || 'Cat & Coating').trim()
        const rawBrand = String(row.Brand || row.brand || '').trim()
        const rawUnit = String(row.Satuan || row.unit || 'pcs').trim().toLowerCase()
        const rawPrice = Number(row.Harga_Jual_Default ?? row.Harga_Jual ?? row.price ?? 0) || 0
        const rawCost = Number(row.HPP_Modal ?? row.HPP ?? row.cost_price ?? 0) || 0

        // Cek apakah SKU sudah ada di perusahaan ini
        const { data: existingProd } = await supabase
          .from('products')
          .select('id')
          .eq('company_id', companyId)
          .eq('sku', rawSku)
          .maybeSingle()

        let productId = existingProd?.id

        if (productId) {
          await supabase
            .from('products')
            .update({
              name: rawName,
              category: rawCategory,
              brand: rawBrand,
              unit: rawUnit,
              price: rawPrice,
              cost_price: rawCost,
            })
            .eq('id', productId)
        } else {
          const { data: insertedProd, error: insErr } = await supabase
            .from('products')
            .insert([
              {
                company_id: companyId,
                sku: rawSku,
                name: rawName,
                category: rawCategory,
                brand: rawBrand,
                unit: rawUnit,
                price: rawPrice,
                cost_price: rawCost,
              },
            ])
            .select('id')
            .single()

          if (insErr) throw insErr
          productId = insertedProd.id
        }

        // Update stok & harga per cabang milik toko ini
        for (const outlet of outlets) {
          const stockColKey = Object.keys(row).find(
            (k) => k.toLowerCase() === `stok_${outlet.name.toLowerCase()}`
          )
          const priceColKey = Object.keys(row).find(
            (k) => k.toLowerCase() === `harga_${outlet.name.toLowerCase()}`
          )

          const parsedStock =
            stockColKey !== undefined && row[stockColKey] !== ''
              ? Math.max(0, Number(row[stockColKey]) || 0)
              : null
          const parsedOutletPrice =
            priceColKey !== undefined && row[priceColKey] !== '' && Number(row[priceColKey]) > 0
              ? Number(row[priceColKey])
              : null

          const { data: existingOutletStock } = await supabase
            .from('outlet_stocks')
            .select('id, stock, selling_price')
            .eq('outlet_id', outlet.id)
            .eq('product_id', productId)
            .maybeSingle()

          if (existingOutletStock) {
            await supabase
              .from('outlet_stocks')
              .update({
                stock: parsedStock !== null ? parsedStock : existingOutletStock.stock,
                selling_price:
                  priceColKey !== undefined ? parsedOutletPrice : existingOutletStock.selling_price,
              })
              .eq('id', existingOutletStock.id)
          } else {
            await supabase.from('outlet_stocks').insert([
              {
                outlet_id: outlet.id,
                product_id: productId,
                stock: parsedStock ?? 0,
                selling_price: parsedOutletPrice,
                min_stock: 3,
              },
            ])
          }
        }

        successCount++
      }

      showFeedback('success', `Import selesai! ${successCount} produk berhasil diproses dari Excel.`)
      fetchMasterData()
    } catch (err: any) {
      showFeedback('error', `Gagal import Excel: ${err.message || 'Format file tidak sesuai'}`)
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // 1. TAMBAH PRODUK BARU
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setFeedback(null)

    try {
      const companyId = await getAdminCompanyId()

      const { data: newProd, error: prodError } = await supabase
        .from('products')
        .insert([
          {
            company_id: companyId,
            sku: sku.trim().toUpperCase(),
            name: name.trim(),
            brand: brand.trim(),
            category,
            price: Number(price) || 0,
            cost_price: Number(costPrice) || 0,
            unit,
          },
        ])
        .select()
        .single()

      if (prodError) throw prodError

      // Bulk insert stok awal & harga khusus cabang
      if (newProd && outlets.length > 0) {
        const stockRows = outlets.map((outlet) => {
          const customPriceStr = initialOutletPrices[outlet.id]
          const customPriceVal =
            customPriceStr && Number(customPriceStr) > 0 ? Number(customPriceStr) : null

          return {
            outlet_id: outlet.id,
            product_id: newProd.id,
            stock: initialStocks[outlet.id] || 0,
            selling_price: customPriceVal,
            min_stock: 3,
          }
        })

        const { error: stockError } = await supabase.from('outlet_stocks').insert(stockRows)
        if (stockError) throw stockError
      }

      showFeedback('success', `Produk "${name.trim()}" & alokasi stok cabang berhasil ditambahkan!`)
      setSku('')
      setName('')
      setBrand('')
      setCategory('Cat & Coating')
      setPrice('')
      setCostPrice('')
      setUnit('kaleng')
      setInitialStocks({})
      setInitialOutletPrices({})
      fetchMasterData()
    } catch (err: any) {
      showFeedback('error', `Gagal menambah produk: ${err.message || 'Terjadi kesalahan'}`)
    } finally {
      setSubmitting(false)
    }
  }

  // 2. BUKA MODAL EDIT PRODUK
  const handleOpenEdit = async (prod: ProductMaster) => {
    setEditingProduct(prod)
    setEditSku(prod.sku || '')
    setEditName(prod.name || '')
    setEditBrand(prod.brand || '')
    setEditCategory(prod.category || 'Cat & Coating')
    setEditPrice(String(prod.price ?? 0))
    setEditCostPrice(String(prod.cost_price ?? 0))
    setEditUnit(prod.unit || 'kaleng')

    const outletIds = outlets.map((o) => o.id)
    const { data: stockData } =
      outletIds.length > 0
        ? await supabase
            .from('outlet_stocks')
            .select('outlet_id, stock, selling_price')
            .eq('product_id', prod.id)
            .in('outlet_id', outletIds)
        : { data: [] }

    const stockMap: Record<string, number> = {}
    const priceMap: Record<string, string> = {}
    if (stockData) {
      stockData.forEach((s: any) => {
        stockMap[s.outlet_id] = Number(s.stock || 0)
        priceMap[s.outlet_id] =
          s.selling_price !== null && s.selling_price !== undefined ? String(s.selling_price) : ''
      })
    }
    setEditStocks(stockMap)
    setEditOutletPrices(priceMap)
  }

  // 3. SIMPAN UPDATE PRODUK
  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProduct) return

    try {
      setUpdating(true)

      const { error: updateError } = await supabase
        .from('products')
        .update({
          sku: editSku.trim().toUpperCase(),
          name: editName.trim(),
          brand: editBrand.trim(),
          category: editCategory,
          price: Number(editPrice) || 0,
          cost_price: Number(editCostPrice) || 0,
          unit: editUnit,
        })
        .eq('id', editingProduct.id)

      if (updateError) throw updateError

      for (const outlet of outlets) {
        const newStockQty = editStocks[outlet.id] ?? 0
        const customPriceStr = editOutletPrices[outlet.id]
        const customPriceVal =
          customPriceStr && Number(customPriceStr) > 0 ? Number(customPriceStr) : null

        const { data: existingStock } = await supabase
          .from('outlet_stocks')
          .select('id')
          .eq('outlet_id', outlet.id)
          .eq('product_id', editingProduct.id)
          .maybeSingle()

        if (existingStock) {
          await supabase
            .from('outlet_stocks')
            .update({ stock: newStockQty, selling_price: customPriceVal })
            .eq('id', existingStock.id)
        } else {
          await supabase.from('outlet_stocks').insert([
            {
              outlet_id: outlet.id,
              product_id: editingProduct.id,
              stock: newStockQty,
              selling_price: customPriceVal,
              min_stock: 3,
            },
          ])
        }
      }

      showFeedback('success', `Data produk "${editName.trim()}" & harga/stok cabang diperbarui!`)
      setEditingProduct(null)
      fetchMasterData()
    } catch (err: any) {
      showFeedback('error', `Gagal memperbarui produk: ${err.message || 'Terjadi kesalahan'}`)
    } finally {
      setUpdating(false)
    }
  }

  // 4. HAPUS PRODUK
  const executeDeleteProduct = async () => {
    if (!confirmDelete) return
    const { id: prodId, name: prodName } = confirmDelete

    setDeletingId(prodId)
    try {
      await supabase.from('outlet_stocks').delete().eq('product_id', prodId)

      const { error } = await supabase.from('products').delete().eq('id', prodId)

      if (error) {
        if (error.code === '23503') {
          throw new Error(
            'Produk tidak dapat dihapus karena sudah memiliki riwayat transaksi penjualan.'
          )
        }
        throw error
      }

      showFeedback('success', `Produk "${prodName}" berhasil dihapus dari katalog.`)
      setConfirmDelete(null)
      fetchMasterData()
    } catch (err: any) {
      showFeedback('error', `Gagal menghapus produk: ${err.message}`)
      setConfirmDelete(null)
    } finally {
      setDeletingId(null)
    }
  }

  const filteredProducts = products.filter((p) => {
    const matchesCat = filterCategory === 'ALL' || (p.category || 'Cat & Coating') === filterCategory
    const q = searchQuery.toLowerCase()
    const matchesQuery =
      (p.sku || '').toLowerCase().includes(q) ||
      (p.name || '').toLowerCase().includes(q) ||
      (p.brand || '').toLowerCase().includes(q)
    return matchesCat && matchesQuery
  })

  return (
    <div className="p-3 min-[375px]:p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 max-w-7xl mx-auto space-y-5 sm:space-y-7">
      {/* HEADER + EXCEL IMPORT/EXPORT ACTIONS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        <div>
          <h1 className="text-lg min-[375px]:text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Boxes className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 shrink-0" />
            <span>Katalog Produk Master & Alokasi Stok</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
            Kelola katalog terpusat, satuan kiloan/literan, harga khusus tiap cabang, dan import/export Excel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition inline-flex items-center gap-1.5 shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
            <span>Template Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3 py-2 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-semibold transition inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImportExcel}
            className="hidden"
          />
          <button
            type="button"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            {importing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            <span>{importing ? 'Mengimpor...' : 'Import Excel'}</span>
          </button>
        </div>
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

      {/* FORM TAMBAH PRODUK BARU */}
      <form
        onSubmit={handleAddProduct}
        className="bg-white p-4 sm:p-6 border border-slate-200/90 rounded-2xl shadow-sm space-y-5"
      >
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Plus className="w-4 h-4 text-blue-600 shrink-0" />
          <h2 className="text-sm font-bold text-slate-900">Tambah Produk Baru</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Kode SKU *</label>
            <input
              type="text"
              required
              placeholder="DW-NPP-01"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 uppercase placeholder:normal-case placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Produk *</label>
            <input
              type="text"
              required
              placeholder="Cat Tembok Oplosan / Thinner A Special"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Kategori Produk *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Brand / Merek</label>
            <input
              type="text"
              placeholder="Eterna / Nippon Paint"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Harga Jual Default (Rp) *
            </label>
            <input
              type="number"
              min="0"
              required
              placeholder="25000"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Harga Pokok / HPP (Rp) *
            </label>
            <input
              type="number"
              min="0"
              required
              placeholder="18000"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Satuan Jual / Kemasan *
            </label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition"
            >
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Input Alokasi Stok Awal & Harga Khusus Per Cabang */}
        {outlets.length > 0 && (
          <div className="bg-slate-50 border border-slate-200/70 p-3.5 sm:p-4 rounded-xl space-y-3">
            <div>
              <p className="text-xs font-bold text-slate-700">
                Alokasi Stok Awal & Harga Khusus per Cabang:
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Kosongkan kolom harga cabang jika ingin mengikuti Harga Jual Default di atas.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {outlets.map((outlet) => (
                <div
                  key={outlet.id}
                  className="bg-white border border-slate-200/80 p-3 rounded-xl space-y-2"
                >
                  <p className="text-xs font-bold text-slate-800 truncate">{outlet.name}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-medium text-slate-500 mb-1">
                        Stok Awal ({unit})
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0"
                        value={initialStocks[outlet.id] || ''}
                        onChange={(e) => handleStockChange(outlet.id, e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-slate-500 mb-1">
                        Harga Cabang (Rp)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Ikut default"
                        value={initialOutletPrices[outlet.id] || ''}
                        onChange={(e) => handleOutletPriceChange(outlet.id, e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-500 active:scale-[0.99] transition disabled:opacity-50 shadow-md shadow-blue-600/20 inline-flex items-center justify-center gap-1.5"
        >
          {submitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Menyimpan...</span>
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" />
              <span>Simpan Produk & Distribusi Stok</span>
            </>
          )}
        </button>
      </form>

      {/* FILTER & SEARCH BAR KATALOG */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari kode SKU, nama produk, atau merek..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
          />
        </div>

        <select
          aria-label="Filter Kategori"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:bg-white focus:border-blue-500 transition"
        >
          <option value="ALL">Semua Kategori</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* DAFTAR KATALOG MASTER */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between gap-2">
          <span className="font-bold text-xs sm:text-sm text-slate-800">
            Daftar Master Produk Perusahaan
          </span>
          <span className="text-[11px] font-semibold text-slate-400 shrink-0">
            {filteredProducts.length} produk
          </span>
        </div>

        {loading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-16 bg-slate-100 rounded-xl" />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-14 px-4 space-y-1.5">
            <Package className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs sm:text-sm font-semibold text-slate-600">
              {products.length === 0 ? 'Belum ada produk terdaftar' : 'Produk tidak ditemukan'}
            </p>
            <p className="text-[11px] text-slate-400">
              {products.length === 0
                ? 'Tambahkan produk pertama Anda menggunakan formulir di atas atau Import Excel.'
                : 'Coba ubah kata kunci pencarian atau pilih kategori lain.'}
            </p>
          </div>
        ) : (
          <>
            {/* TAMPILAN MOBILE (< 768px): CARD LIST */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredProducts.map((p) => (
                <div key={p.id} className="p-3.5 min-[375px]:p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {p.sku}
                        </span>
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-semibold">
                          {p.category || 'Cat & Coating'}
                        </span>
                      </div>
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 mt-1.5 break-words">
                        {p.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Brand: <span className="font-medium text-slate-700">{p.brand || '-'}</span> •{' '}
                        <span className="uppercase font-semibold">{p.unit || 'pcs'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl text-[11px]">
                    <div>
                      <p className="text-[10px] text-slate-400">Harga Default</p>
                      <p className="font-bold text-slate-900 mt-0.5">
                        Rp {Number(p.price).toLocaleString('id-ID')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400">Modal HPP</p>
                      <p className="font-semibold text-slate-600 mt-0.5">
                        Rp {Number(p.cost_price).toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      onClick={() => handleOpenEdit(p)}
                      className="flex-1 inline-flex items-center justify-center gap-1 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl font-semibold text-xs hover:bg-amber-100 active:scale-[0.98] transition"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit Harga & Stok</span>
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ id: p.id, name: p.name })}
                      className="inline-flex items-center justify-center gap-1 px-3.5 py-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl font-semibold text-xs hover:bg-rose-100 active:scale-[0.98] transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* TAMPILAN DESKTOP / TABLET (>= 768px): TABEL */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                    <th className="py-3.5 px-5">SKU</th>
                    <th className="py-3.5 px-5">Nama Produk</th>
                    <th className="py-3.5 px-5">Kategori</th>
                    <th className="py-3.5 px-5">Brand</th>
                    <th className="py-3.5 px-5 text-right">Harga Default</th>
                    <th className="py-3.5 px-5 text-right">HPP</th>
                    <th className="py-3.5 px-5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-5 font-mono text-slate-500 whitespace-nowrap">
                        {p.sku}
                      </td>
                      <td className="py-3.5 px-5 font-bold text-slate-900">
                        <div>{p.name}</div>
                        <span className="text-[10px] font-medium text-slate-400 uppercase">
                          Satuan: {p.unit || 'pcs'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-[11px] font-semibold border border-slate-200">
                          {p.category || 'Cat & Coating'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-600 whitespace-nowrap">
                        {p.brand || '-'}
                      </td>
                      <td className="py-3.5 px-5 text-right font-bold text-slate-900 whitespace-nowrap">
                        Rp {Number(p.price).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-5 text-right text-slate-500 whitespace-nowrap">
                        Rp {Number(p.cost_price).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-5 text-center space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-semibold text-xs hover:bg-amber-100 transition"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ id: p.id, name: p.name })}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg font-semibold text-xs hover:bg-rose-100 transition"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Hapus</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* MODAL EDIT PRODUK */}
      {editingProduct && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 min-[375px]:p-4 z-50">
          <div className="bg-white rounded-2xl p-4 min-[375px]:p-5 sm:p-6 max-w-2xl w-full space-y-4 shadow-xl max-h-[90dvh] overflow-y-auto border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Edit Master Produk, Harga & Stok Cabang
              </h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition"
                aria-label="Tutup modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateProduct} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Kode SKU *
                  </label>
                  <input
                    type="text"
                    value={editSku}
                    onChange={(e) => setEditSku(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 uppercase focus:outline-none focus:bg-white focus:border-blue-500 transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Nama Produk *
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Kategori *
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Brand / Merek
                  </label>
                  <input
                    type="text"
                    value={editBrand}
                    onChange={(e) => setEditBrand(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Satuan Kemasan *
                  </label>
                  <select
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition"
                  >
                    {UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Harga Jual Default (Rp) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Harga Pokok / HPP Baru (Rp) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editCostPrice}
                    onChange={(e) => setEditCostPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition"
                    required
                  />
                </div>
              </div>

              {/* Edit Stok & Harga Khusus per cabang */}
              {outlets.length > 0 && (
                <div className="bg-slate-50 border border-slate-200/70 p-3.5 sm:p-4 rounded-xl space-y-3">
                  <div>
                    <p className="text-xs font-bold text-slate-700">
                      Penyesuaian Stok & Harga Jual per Cabang:
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Kosongkan harga cabang jika ingin mengikuti Harga Jual Default.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {outlets.map((outlet) => (
                      <div
                        key={outlet.id}
                        className="bg-white border border-slate-200/80 p-3 rounded-xl space-y-2"
                      >
                        <p className="text-xs font-bold text-slate-800 truncate">{outlet.name}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 mb-1">
                              Stok ({editUnit})
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={editStocks[outlet.id] ?? 0}
                              onChange={(e) => handleEditStockChange(outlet.id, e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 mb-1">
                              Harga Cabang
                            </label>
                            <input
                              type="number"
                              min="0"
                              placeholder="Default"
                              value={editOutletPrices[outlet.id] ?? ''}
                              onChange={(e) =>
                                handleEditOutletPriceChange(outlet.id, e.target.value)
                              }
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-200 transition"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS PRODUK */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 min-[375px]:p-4 z-50">
          <div className="bg-white rounded-2xl p-4 min-[375px]:p-5 sm:p-6 max-w-sm w-full space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900">Hapus Produk dari Katalog?</h3>
                <p className="text-xs text-slate-500 mt-1 break-words">
                  Produk <span className="font-bold text-slate-800">{confirmDelete.name}</span> dan
                  alokasi stoknya di semua cabang akan dihapus permanen.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={executeDeleteProduct}
                disabled={deletingId === confirmDelete.id}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-[0.99] text-white rounded-xl text-xs font-semibold transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {deletingId === confirmDelete.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{deletingId === confirmDelete.id ? 'Menghapus...' : 'Ya, Hapus Produk'}</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={deletingId === confirmDelete.id}
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