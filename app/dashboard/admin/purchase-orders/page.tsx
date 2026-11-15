'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  FileText,
  Plus,
  Search,
  Building2,
  Truck,
  Calendar,
  CheckCircle2,
  Clock,
  X,
  Loader2,
  Trash2,
  AlertCircle,
} from 'lucide-react'

interface Supplier {
  id: string
  name: string
}

interface Outlet {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  sku: string
  unit: string
  cost_price?: number
}

interface POItemInput {
  product_id: string
  quantity: number
  unit_cost: number
}

interface PurchaseOrder {
  id: string
  po_number: string
  status: string
  total_amount: number
  created_at: string
  suppliers: { name: string } | null
  outlets: { name: string } | null
}

export default function PurchaseOrdersPage() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [products, setProducts] = useState<Product[]>([])

  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ordered' | 'received'>('ALL')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Feedback Banner Non-Blocking
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  )

  // Form State PO Baru
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [selectedOutlet, setSelectedOutlet] = useState('')
  const [poNotes, setPoNotes] = useState('')
  const [poItems, setPoItems] = useState<POItemInput[]>([
    { product_id: '', quantity: 1, unit_cost: 0 },
  ])

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev))
    }, 5000)
  }

  const fetchPurchaseOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select(`
        id,
        po_number,
        status,
        total_amount,
        created_at,
        suppliers (name),
        outlets (name)
      `)
      .order('created_at', { ascending: false })

    if (!error && data) setPurchaseOrders(data as unknown as PurchaseOrder[])
  }, [])

  const initData = useCallback(async () => {
    setLoading(true)
    try {
      const [, supRes, outRes, prodRes] = await Promise.all([
        fetchPurchaseOrders(),
        supabase.from('suppliers').select('id, name').order('name'),
        supabase.from('outlets').select('id, name').order('name'),
        supabase.from('products').select('id, name, sku, unit, cost_price').order('name'),
      ])

      if (supRes.data) setSuppliers(supRes.data)
      if (outRes.data) setOutlets(outRes.data)
      if (prodRes.data) setProducts(prodRes.data)
    } catch (err) {
      console.error('Error init PO page:', err)
    } finally {
      setLoading(false)
    }
  }, [fetchPurchaseOrders])

  useEffect(() => {
    initData()
  }, [initData])

  // Handle Tambah Row Produk di Form PO
  const handleAddItemRow = () => {
    setPoItems((prev) => [...prev, { product_id: '', quantity: 1, unit_cost: 0 }])
  }

  // Handle Hapus Row Produk
  const handleRemoveItemRow = (index: number) => {
    if (poItems.length === 1) return
    setPoItems((prev) => prev.filter((_, i) => i !== index))
  }

  // Handle Change Item Field (otomatis isi harga beli default dari HPP produk jika dipilih)
  const handleItemChange = (index: number, field: keyof POItemInput, value: string | number) => {
    setPoItems((prev) => {
      const updated = [...prev]
      const current = { ...updated[index], [field]: value }

      if (field === 'product_id' && typeof value === 'string') {
        const selectedProd = products.find((p) => p.id === value)
        if (selectedProd && selectedProd.cost_price && current.unit_cost === 0) {
          current.unit_cost = Number(selectedProd.cost_price)
        }
      }

      updated[index] = current
      return updated
    })
  }

  // Hitung Total Estimasi PO
  const calculateTotal = () => {
    return poItems.reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_cost || 0),
      0
    )
  }

  const resetForm = () => {
    setSelectedSupplier('')
    setSelectedOutlet('')
    setPoNotes('')
    setPoItems([{ product_id: '', quantity: 1, unit_cost: 0 }])
  }

  // Submit Buat PO Baru
  const handleSubmitPO = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSupplier || !selectedOutlet) {
      showFeedback('error', 'Pilih Supplier dan Cabang Tujuan terlebih dahulu.')
      return
    }

    if (poItems.some((item) => !item.product_id || Number(item.quantity) <= 0)) {
      showFeedback('error', 'Pastikan semua item produk telah dipilih dan jumlahnya lebih dari 0.')
      return
    }

    setIsSubmitting(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const now = new Date()
      const poNumber = `PO-${now.getFullYear()}${(now.getMonth() + 1)
        .toString()
        .padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`
      const totalAmount = calculateTotal()

      // 1. Insert Master PO
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .insert([
          {
            po_number: poNumber,
            supplier_id: selectedSupplier,
            outlet_id: selectedOutlet,
            status: 'ordered',
            total_amount: totalAmount,
            notes: poNotes.trim(),
            created_by: session?.user.id,
          },
        ])
        .select('id')
        .single()

      if (poError || !poData) throw poError || new Error('Gagal menyimpan dokumen PO.')

      // 2. Insert PO Items
      const itemsToInsert = poItems.map((item) => ({
        po_id: poData.id,
        product_id: item.product_id,
        quantity: Number(item.quantity),
        unit_cost: Number(item.unit_cost),
      }))

      const { error: itemsError } = await supabase.from('po_items').insert(itemsToInsert)
      if (itemsError) throw itemsError

      showFeedback(
        'success',
        `Dokumen ${poNumber} berhasil diterbitkan dan diteruskan ke menu Penerimaan Gudang.`
      )
      setIsModalOpen(false)
      resetForm()
      fetchPurchaseOrders()
    } catch (err: any) {
      showFeedback('error', `Gagal membuat PO: ${err.message || 'Terjadi kesalahan'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredPOs = purchaseOrders.filter((po) => {
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'received' ? po.status === 'received' : po.status !== 'received')
    const q = searchQuery.toLowerCase()
    const matchesQuery =
      (po.po_number || '').toLowerCase().includes(q) ||
      (po.suppliers?.name || '').toLowerCase().includes(q) ||
      (po.outlets?.name || '').toLowerCase().includes(q)
    return matchesStatus && matchesQuery
  })

  return (
    <div className="p-3 min-[375px]:p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 max-w-7xl mx-auto space-y-5 sm:space-y-7">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg min-[375px]:text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 shrink-0" />
            <span>Purchase Order (PO)</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
            Buat & pantau dokumen pemesanan stok produk ke Supplier untuk setiap cabang.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-semibold text-xs rounded-xl transition inline-flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Buat PO Baru</span>
        </button>
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

      {/* SEARCH & STATUS FILTER BAR */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col min-[480px]:flex-row gap-2.5 flex-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari No. PO, Supplier, atau Cabang..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
            />
          </div>

          <select
            aria-label="Filter Status PO"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ordered' | 'received')}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:bg-white focus:border-blue-500 transition"
          >
            <option value="ALL">Semua Status</option>
            <option value="ordered">Dikirim ke Gudang</option>
            <option value="received">Selesai (Diterima)</option>
          </select>
        </div>

        <div className="text-[11px] font-semibold text-slate-500 shrink-0">
          Total: <span className="text-blue-600 font-bold">{filteredPOs.length}</span> dokumen
        </div>
      </div>

      {/* DAFTAR DOKUMEN PO */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-16 bg-slate-100 rounded-xl" />
            ))}
          </div>
        ) : filteredPOs.length === 0 ? (
          <div className="py-14 px-4 text-center space-y-1.5">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs sm:text-sm font-semibold text-slate-600">
              {purchaseOrders.length === 0
                ? 'Belum ada dokumen Purchase Order'
                : 'Dokumen PO tidak ditemukan'}
            </p>
            <p className="text-[11px] text-slate-400">
              {purchaseOrders.length === 0
                ? 'Klik tombol "Buat PO Baru" untuk memesan barang dari Supplier.'
                : 'Coba ubah kata kunci pencarian atau filter status.'}
            </p>
          </div>
        ) : (
          <>
            {/* TAMPILAN MOBILE (< 768px): CARD LIST */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredPOs.map((po) => (
                <div key={po.id} className="p-3.5 min-[375px]:p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900 flex items-center gap-1.5 truncate">
                      <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="truncate">{po.po_number}</span>
                    </span>

                    {po.status === 'received' ? (
                      <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold rounded-md inline-flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3 h-3" /> Selesai
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold rounded-md inline-flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" /> Proses Gudang
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 text-[11px] text-slate-600">
                    <p className="flex items-center gap-1.5 truncate">
                      <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-medium truncate">
                        {po.suppliers?.name || 'Vendor Luar'}
                      </span>
                    </p>
                    <p className="flex items-center gap-1.5 truncate">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{po.outlets?.name || 'Gudang Utama'}</span>
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100">
                    <span className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Calendar className="w-3 h-3 shrink-0" />
                      <span>
                        {new Date(po.created_at).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </span>

                    <span className="font-extrabold text-xs sm:text-sm text-blue-600 whitespace-nowrap">
                      Rp {Number(po.total_amount || 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* TAMPILAN DESKTOP / TABLET (>= 768px): TABEL */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                    <th className="py-3.5 px-5">No. PO</th>
                    <th className="py-3.5 px-5">Supplier / Vendor</th>
                    <th className="py-3.5 px-5">Cabang Tujuan</th>
                    <th className="py-3.5 px-5 text-right">Total Biaya</th>
                    <th className="py-3.5 px-5">Status PO</th>
                    <th className="py-3.5 px-5">Tanggal Buat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                  {filteredPOs.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-5 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <span className="inline-flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                          {po.po_number}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 font-medium text-slate-800 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-slate-400" />
                          {po.suppliers?.name || 'Vendor Luar'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-600 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {po.outlets?.name || 'Gudang Utama'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right font-bold text-blue-600 whitespace-nowrap">
                        Rp {Number(po.total_amount || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        {po.status === 'received' ? (
                          <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold rounded-lg inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Selesai (Diterima)
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold rounded-lg inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Dikirim ke Gudang
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-slate-500 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(po.created_at).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* MODAL FORM BUAT PO BARU */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 min-[375px]:p-4">
          <div className="bg-white border border-slate-200 p-4 min-[375px]:p-5 sm:p-6 rounded-2xl w-full max-w-3xl shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0" />
                <span>Buat Purchase Order (PO) Baru</span>
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
                aria-label="Tutup modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitPO} className="space-y-4">
              {/* Dropdown Supplier & Outlet */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Pilih Vendor Supplier *
                  </label>
                  <select
                    required
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition"
                  >
                    <option value="">-- Pilih Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Cabang / Gudang Tujuan *
                  </label>
                  <select
                    required
                    value={selectedOutlet}
                    onChange={(e) => setSelectedOutlet(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition"
                  >
                    <option value="">-- Pilih Cabang --</option>
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic Product Rows - Responsif di 320px hingga Desktop */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Daftar Produk yang Dipesan
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-xs text-blue-600 hover:text-blue-500 font-bold inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Baris
                  </button>
                </div>

                <div className="space-y-2.5">
                  {poItems.map((item, index) => (
                    <div
                      key={index}
                      className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 grid grid-cols-12 gap-2 items-center"
                    >
                      <div className="col-span-12 sm:col-span-5">
                        <label className="block sm:hidden text-[10px] font-semibold text-slate-500 mb-1">
                          Produk #{index + 1}
                        </label>
                        <select
                          required
                          value={item.product_id}
                          onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                        >
                          <option value="">-- Pilih Produk --</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-4 sm:col-span-3">
                        <label className="block sm:hidden text-[10px] font-semibold text-slate-500 mb-1">
                          Qty
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          placeholder="Qty"
                          value={item.quantity || ''}
                          onChange={(e) =>
                            handleItemChange(index, 'quantity', Number(e.target.value))
                          }
                          className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="col-span-6 sm:col-span-3">
                        <label className="block sm:hidden text-[10px] font-semibold text-slate-500 mb-1">
                          Harga Beli (Rp)
                        </label>
                        <input
                          type="number"
                          min="0"
                          required
                          placeholder="Harga Satuan"
                          value={item.unit_cost || ''}
                          onChange={(e) =>
                            handleItemChange(index, 'unit_cost', Number(e.target.value))
                          }
                          className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="col-span-2 sm:col-span-1 flex items-end sm:items-center justify-center pt-4 sm:pt-0">
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(index)}
                          disabled={poItems.length === 1}
                          className="p-2 text-slate-400 hover:text-rose-600 disabled:opacity-30 transition rounded-lg hover:bg-rose-50"
                          aria-label="Hapus baris produk"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Catatan Tambahan
                </label>
                <textarea
                  rows={2}
                  placeholder="Keterangan pengiriman, spesifikasi warna, termin pembayaran, dll..."
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
                />
              </div>

              {/* Total Summary */}
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-2 text-xs font-bold text-blue-700">
                <span>TOTAL ESTIMASI PEMBELIAN:</span>
                <span className="text-sm sm:text-base font-extrabold text-blue-900 whitespace-nowrap">
                  Rp {calculateTotal().toLocaleString('id-ID')}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white text-xs font-semibold rounded-xl transition inline-flex items-center gap-1.5 disabled:opacity-50 shadow-md shadow-blue-600/20"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Terbitkan Dokumen PO</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}