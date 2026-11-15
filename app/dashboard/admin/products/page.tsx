'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
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

  // State Stok Awal per Cabang
  const [initialStocks, setInitialStocks] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)

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
  const [updating, setUpdating] = useState(false)

  // State Konfirmasi Hapus
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev))
    }, 4500)
  }

  const fetchMasterData = useCallback(async () => {
    try {
      setLoading(true)

      const { data: outletsData } = await supabase
        .from('outlets')
        .select('id, name')
        .order('name', { ascending: true })
      if (outletsData) setOutlets(outletsData)

      const { data: productsData, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      if (productsData) setProducts(productsData as ProductMaster[])
    } catch (err) {
      console.error('Gagal mengambil katalog master:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMasterData()
  }, [fetchMasterData])

  const handleStockChange = (outletId: string, value: string) => {
    setInitialStocks((prev) => ({
      ...prev,
      [outletId]: Math.max(0, Number(value) || 0),
    }))
  }

  const handleEditStockChange = (outletId: string, value: string) => {
    setEditStocks((prev) => ({
      ...prev,
      [outletId]: Math.max(0, Number(value) || 0),
    }))
  }

  // 1. TAMBAH PRODUK BARU
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setFeedback(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Sesi login tidak ditemukan, silakan login ulang.')

      // Cari company_id lewat ID user, fallback lewat email
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

      // Bulk insert stok awal untuk seluruh cabang sekaligus
      if (newProd && outlets.length > 0) {
        const stockRows = outlets.map((outlet) => ({
          outlet_id: outlet.id,
          product_id: newProd.id,
          stock: initialStocks[outlet.id] || 0,
          min_stock: 3,
        }))

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

    const { data: stockData } = await supabase
      .from('outlet_stocks')
      .select('outlet_id, stock')
      .eq('product_id', prod.id)

    const stockMap: Record<string, number> = {}
    if (stockData) {
      stockData.forEach((s: any) => {
        stockMap[s.outlet_id] = Number(s.stock || 0)
      })
    }
    setEditStocks(stockMap)
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

        const { data: existingStock } = await supabase
          .from('outlet_stocks')
          .select('id')
          .eq('outlet_id', outlet.id)
          .eq('product_id', editingProduct.id)
          .maybeSingle()

        if (existingStock) {
          await supabase
            .from('outlet_stocks')
            .update({ stock: newStockQty })
            .eq('id', existingStock.id)
        } else {
          await supabase.from('outlet_stocks').insert([
            {
              outlet_id: outlet.id,
              product_id: editingProduct.id,
              stock: newStockQty,
              min_stock: 3,
            },
          ])
        }
      }

      showFeedback('success', `Data produk "${editName.trim()}" & stok berhasil diperbarui!`)
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
      {/* HEADER */}
      <div>
        <h1 className="text-lg min-[375px]:text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Boxes className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 shrink-0" />
          <span>Katalog Produk Master & Alokasi Stok</span>
        </h1>
        <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
          Kelola katalog produk terpusat, ubah harga, kategori, dan atur distribusi stok fisik per cabang.
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
              placeholder="Kuas Cat Eterna 3 Inch / Nippon Paint 5L"
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
              Harga Jual (Rp) *
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
              Satuan Kemasan *
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

        {/* Input Alokasi Stok Awal Per Cabang */}
        {outlets.length > 0 && (
          <div className="bg-slate-50 border border-slate-200/70 p-3.5 sm:p-4 rounded-xl space-y-3">
            <p className="text-xs font-bold text-slate-700">Alokasi Stok Awal per Cabang:</p>
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 gap-3">
              {outlets.map((outlet) => (
                <div key={outlet.id}>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1 truncate">
                    Stok di {outlet.name}
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={initialStocks[outlet.id] || ''}
                    onChange={(e) => handleStockChange(outlet.id, e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 focus:outline-none focus:border-blue-500 transition"
                  />
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
                ? 'Tambahkan produk pertama Anda menggunakan formulir di atas.'
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
                        <span className="capitalize">{p.unit || 'pcs'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl text-[11px]">
                    <div>
                      <p className="text-[10px] text-slate-400">Harga Jual</p>
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
                      <span>Edit & Stok</span>
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
                    <th className="py-3.5 px-5 text-right">Harga Jual</th>
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
                        <span className="text-[10px] font-normal text-slate-400 capitalize">
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
                Edit Master Produk & Stok Cabang
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
                    Harga Jual Baru (Rp) *
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

              {/* Edit Stok fisik per cabang */}
              {outlets.length > 0 && (
                <div className="bg-slate-50 border border-slate-200/70 p-3.5 sm:p-4 rounded-xl space-y-3">
                  <p className="text-xs font-bold text-slate-700">
                    Penyesuaian Stok Fisik per Cabang:
                  </p>
                  <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 gap-3">
                    {outlets.map((outlet) => (
                      <div key={outlet.id}>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1 truncate">
                          Stok di {outlet.name}
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editStocks[outlet.id] ?? 0}
                          onChange={(e) => handleEditStockChange(outlet.id, e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 focus:outline-none focus:border-blue-500 transition"
                        />
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