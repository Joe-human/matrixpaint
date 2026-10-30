'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

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

export default function MasterProductsPage() {
  const [products, setProducts] = useState<ProductMaster[]>([])
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [loading, setLoading] = useState(true)

  // State Form Produk Baru
  const [sku, setSku] = useState('')
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState('Cat & Coating')
  const [price, setPrice] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [unit, setUnit] = useState('kaleng')
  
  // State Stok Awal per Cabang
  const [initialStocks, setInitialStocks] = useState<{ [key: string]: number }>({})
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  // State Modal Edit Produk
  const [editingProduct, setEditingProduct] = useState<ProductMaster | null>(null)
  const [editSku, setEditSku] = useState('')
  const [editName, setEditName] = useState('')
  const [editBrand, setEditBrand] = useState('')
  const [editCategory, setEditCategory] = useState('Cat & Coating')
  const [editPrice, setEditPrice] = useState('')
  const [editCostPrice, setEditCostPrice] = useState('')
  const [editUnit, setEditUnit] = useState('kaleng')
  const [editStocks, setEditStocks] = useState<{ [key: string]: number }>({})
  const [updating, setUpdating] = useState(false)

  // State Hapus
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetchMasterData()
  }, [])

  const fetchMasterData = async () => {
    try {
      setLoading(true)

      const { data: outletsData } = await supabase.from('outlets').select('id, name')
      if (outletsData) setOutlets(outletsData)

      const { data: productsData, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      if (productsData) setProducts(productsData as any)
    } catch (err) {
      console.error('Gagal mengambil katalog master:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleStockChange = (outletId: string, value: string) => {
    setInitialStocks((prev) => ({
      ...prev,
      [outletId]: Number(value) || 0,
    }))
  }

  const handleEditStockChange = (outletId: string, value: string) => {
    setEditStocks((prev) => ({
      ...prev,
      [outletId]: Number(value) || 0,
    }))
  }

  // 1. TAMBAH PRODUK BARU
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User tidak terautentikasi')

      const { data: profile } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) throw new Error('Company ID tidak ditemukan')

      const { data: newProd, error: prodError } = await supabase
        .from('products')
        .insert([
          {
            company_id: profile.company_id,
            sku,
            name,
            brand,
            category,
            price: Number(price),
            cost_price: Number(costPrice),
            unit,
          },
        ])
        .select()
        .single()

      if (prodError) throw prodError

      if (newProd) {
        for (const outlet of outlets) {
          const qty = initialStocks[outlet.id] || 0
          await supabase.from('outlet_stocks').insert([
            {
              outlet_id: outlet.id,
              product_id: newProd.id,
              stock: qty,
              min_stock: 3,
            },
          ])
        }
      }

      setMessage('Produk baru & alokasi stok cabang berhasil ditambahkan!')
      setSku('')
      setName('')
      setBrand('')
      setCategory('Cat & Coating')
      setPrice('')
      setCostPrice('')
      setInitialStocks({})
      fetchMasterData()
    } catch (err: any) {
      setMessage(`Gagal menambah produk: ${err.message}`)
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
    setEditPrice(String(prod.price || '0'))
    setEditCostPrice(String(prod.cost_price || '0'))
    setEditUnit(prod.unit || 'kaleng')

    const { data: stockData } = await supabase
      .from('outlet_stocks')
      .select('outlet_id, stock')
      .eq('product_id', prod.id)

    const stockMap: { [key: string]: number } = {}
    if (stockData) {
      stockData.forEach((s: any) => {
        stockMap[s.outlet_id] = s.stock
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
          sku: editSku,
          name: editName,
          brand: editBrand,
          category: editCategory,
          price: Number(editPrice),
          cost_price: Number(editCostPrice),
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
          .single()

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

      alert('Data produk & stok berhasil diperbarui!')
      setEditingProduct(null)
      fetchMasterData()
    } catch (err: any) {
      alert(`Gagal memperbarui produk: ${err.message}`)
    } finally {
      setUpdating(false)
    }
  }

  // 4. HAPUS PRODUK
  const handleDeleteProduct = async (prodId: string, prodName: string) => {
    const confirmDelete = confirm(`Apakah Anda yakin ingin menghapus produk "${prodName}"?`)
    if (!confirmDelete) return

    setDeletingId(prodId)
    try {
      await supabase.from('outlet_stocks').delete().eq('product_id', prodId)

      const { error } = await supabase.from('products').delete().eq('id', prodId)

      if (error) {
        if (error.code === '23503') {
          throw new Error('Produk tidak dapat dihapus karena sudah memiliki riwayat transaksi penjualan.')
        }
        throw error
      }

      alert(`Produk "${prodName}" berhasil dihapus.`)
      fetchMasterData()
    } catch (err: any) {
      alert(`Gagal menghapus produk: ${err.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Katalog Produk Master & Alokasi Stok</h1>
        <p className="text-xs text-slate-500 mt-1">Kelola katalog produk terpusat, ubah harga, kategori, dan atur distribusi stok fisik per cabang.</p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-xs font-medium border ${
          message.startsWith('Gagal') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
        }`}>
          {message}
        </div>
      )}

      {/* Form Tambah Produk Baru */}
      <form onSubmit={handleAddProduct} className="bg-white p-5 sm:p-6 border border-slate-200 rounded-2xl shadow-sm space-y-6">
        <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3">Tambah Produk Baru</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Kode SKU</label>
            <input
              type="text"
              required
              placeholder="DW-NPP-01"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Nama Produk</label>
            <input
              type="text"
              required
              placeholder="Kuas Cat Eterna 3 Inch / Nippon Paint 5L"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Kategori Produk</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Brand / Merek</label>
            <input
              type="text"
              placeholder="Eterna / Nippon Paint"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Harga Jual (Rp)</label>
            <input
              type="number"
              required
              placeholder="25000"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Harga Pokok / HPP (Rp)</label>
            <input
              type="number"
              required
              placeholder="18000"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Satuan Kemasan</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-500"
            >
              <option value="pcs">Pcs / Buah</option>
              <option value="kaleng">Kaleng</option>
              <option value="galon">Galon</option>
              <option value="pail">Pail (20L)</option>
              <option value="sak">Sak (20kg)</option>
              <option value="botol">Botol</option>
              <option value="roll">Roll</option>
            </select>
          </div>
        </div>

        {/* Input Alokasi Stok Awal Per Cabang */}
        <div className="bg-slate-50 p-4 rounded-xl space-y-3">
          <p className="text-xs font-bold text-slate-700">Alokasi Stok Awal per Cabang:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {outlets.map((outlet) => (
              <div key={outlet.id}>
                <label className="block text-[11px] text-slate-500 mb-1">Stok di {outlet.name}</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={initialStocks[outlet.id] || ''}
                  onChange={(e) => handleStockChange(outlet.id, e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-500"
                />
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-500 transition disabled:opacity-50 shadow-md shadow-blue-600/20"
        >
          {submitting ? 'Menyimpan...' : 'Simpan Produk & Distribusi Stok'}
        </button>
      </form>

      {/* Tabel Katalog Master */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 font-semibold text-sm text-slate-800">
          Daftar Master Produk Perusahaan
        </div>
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Memuat katalog master...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm min-w-[750px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <th className="py-3.5 px-4 sm:px-6">SKU</th>
                  <th className="py-3.5 px-4 sm:px-6">Nama Produk</th>
                  <th className="py-3.5 px-4 sm:px-6">Kategori</th>
                  <th className="py-3.5 px-4 sm:px-6">Brand</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Harga Jual</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">HPP</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      Belum ada produk terdaftar.
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="py-3.5 px-4 sm:px-6 font-mono text-xs text-slate-500 whitespace-nowrap">{p.sku}</td>
                      <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900 whitespace-nowrap">{p.name}</td>
                      <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-[11px] font-semibold border border-slate-200">
                          {p.category || 'Cat & Coating'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-slate-600 whitespace-nowrap">{p.brand}</td>
                      <td className="py-3.5 px-4 sm:px-6 text-right font-bold text-slate-900 whitespace-nowrap">
                        Rp {Number(p.price).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-right text-slate-500 whitespace-nowrap">
                        Rp {Number(p.cost_price).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-center space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-semibold text-xs hover:bg-amber-100 transition"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p.id, p.name)}
                          disabled={deletingId === p.id}
                          className="px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg font-semibold text-xs hover:bg-red-100 transition disabled:opacity-50"
                        >
                          {deletingId === p.id ? 'Menghapus...' : 'Hapus'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL EDIT PRODUK */}
      {editingProduct && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-2xl w-full space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Edit Master Produk & Stok Cabang</h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateProduct} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Kode SKU</label>
                  <input
                    type="text"
                    value={editSku}
                    onChange={(e) => setEditSku(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Produk</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Kategori</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Brand / Merek</label>
                  <input
                    type="text"
                    value={editBrand}
                    onChange={(e) => setEditBrand(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Satuan Kemasan</label>
                  <select
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="pcs">Pcs / Buah</option>
                    <option value="kaleng">Kaleng</option>
                    <option value="galon">Galon</option>
                    <option value="pail">Pail (20L)</option>
                    <option value="sak">Sak (20kg)</option>
                    <option value="botol">Botol</option>
                    <option value="roll">Roll</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Harga Jual Baru (Rp)</label>
                  <input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Harga Pokok / HPP Baru (Rp)</label>
                  <input
                    type="number"
                    value={editCostPrice}
                    onChange={(e) => setEditCostPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Edit Stok fisik per cabang */}
              <div className="bg-slate-50 p-4 rounded-xl space-y-3">
                <p className="text-xs font-bold text-slate-700">Penyesuaian Stok Fisik per Cabang:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {outlets.map((outlet) => (
                    <div key={outlet.id}>
                      <label className="block text-[11px] text-slate-500 mb-1">Stok di {outlet.name}</label>
                      <input
                        type="number"
                        min="0"
                        value={editStocks[outlet.id] ?? 0}
                        onChange={(e) => handleEditStockChange(outlet.id, e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  ))}
                </div>
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
    </div>
  )
}