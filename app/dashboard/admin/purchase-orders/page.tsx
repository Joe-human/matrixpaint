'use client'

import { useState, useEffect } from 'react'
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
  Package,
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
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form State PO Baru
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [selectedOutlet, setSelectedOutlet] = useState('')
  const [poNotes, setPoNotes] = useState('')
  const [poItems, setPoItems] = useState<POItemInput[]>([
    { product_id: '', quantity: 1, unit_cost: 0 },
  ])

  useEffect(() => {
    initData()
  }, [])

  const initData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchPurchaseOrders(),
        fetchSuppliers(),
        fetchOutlets(),
        fetchProducts(),
      ])
    } catch (err) {
      console.error('Error init PO page:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchPurchaseOrders = async () => {
    const { data } = await supabase
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

    if (data) setPurchaseOrders(data as any)
  }

  const fetchSuppliers = async () => {
    const { data } = await supabase.from('suppliers').select('id, name').order('name')
    if (data) setSuppliers(data)
  }

  const fetchOutlets = async () => {
    const { data } = await supabase.from('outlets').select('id, name').order('name')
    if (data) setOutlets(data)
  }

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('id, name, sku, unit').order('name')
    if (data) setProducts(data)
  }

  // Handle Tambah Row Produk di Form PO
  const handleAddItemRow = () => {
    setPoItems([...poItems, { product_id: '', quantity: 1, unit_cost: 0 }])
  }

  // Handle Hapus Row Produk
  const handleRemoveItemRow = (index: number) => {
    if (poItems.length === 1) return
    setPoItems(poItems.filter((_, i) => i !== index))
  }

  // Handle Change Item Field
  const handleItemChange = (index: number, field: keyof POItemInput, value: any) => {
    const updated = [...poItems]
    updated[index] = { ...updated[index], [field]: value }
    setPoItems(updated)
  }

  // Hitung Total Estimasi PO
  const calculateTotal = () => {
    return poItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_cost || 0), 0)
  }

  // Submit Buat PO Baru
  const handleSubmitPO = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSupplier || !selectedOutlet) {
      alert('Pilih Supplier dan Cabang Tujuan terlebih dahulu.')
      return
    }

    if (poItems.some((item) => !item.product_id || item.quantity <= 0)) {
      alert('Pastikan semua item produk telah dipilih dan jumlahnya lebih dari 0.')
      return
    }

    setIsSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const poNumber = `PO-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`
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
            notes: poNotes,
            created_by: session?.user.id,
          },
        ])
        .select('id')
        .single()

      if (poError || !poData) throw poError

      // 2. Insert PO Items
      const itemsToInsert = poItems.map((item) => ({
        po_id: poData.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
      }))

      const { error: itemsError } = await supabase.from('po_items').insert(itemsToInsert)
      if (itemsError) throw itemsError

      alert(`BERHASIL: Dokumen ${poNumber} telah dibuat! Dokumen kini diteruskan ke menu Penerimaan Gudang.`)
      setIsModalOpen(false)
      resetForm()
      fetchPurchaseOrders()
    } catch (err: any) {
      alert(`Gagal membuat PO: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setSelectedSupplier('')
    setSelectedOutlet('')
    setPoNotes('')
    setPoItems([{ product_id: '', quantity: 1, unit_cost: 0 }])
  }

  const filteredPOs = purchaseOrders.filter(
    (po) =>
      po.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.suppliers?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.outlets?.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-wider flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-500" />
            PURCHASE ORDER (PO)
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Buat & pantau dokumen pemesanan stok produk ke Supplier
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm rounded-xl transition flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/20 active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Buat PO Baru</span>
        </button>
      </div>

      {/* Bar Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari No. PO, Supplier, atau Outlet..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Total Dokumen: <strong className="text-blue-400">{filteredPOs.length}</strong> PO
        </div>
      </div>

      {/* Table List PO */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-xs font-semibold">Memuat Data Purchase Order...</p>
        </div>
      ) : filteredPOs.length === 0 ? (
        <div className="py-16 text-center bg-slate-900/50 border border-slate-800/80 rounded-2xl">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-300">Belum Ada Dokumen Purchase Order</p>
          <p className="text-xs text-slate-500 mt-1">
            Klik tombol Buat PO Baru untuk memesan barang dari Vendor.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-slate-300">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-4">No. PO</th>
                  <th className="p-4">Supplier / Vendor</th>
                  <th className="p-4">Cabang Tujuan</th>
                  <th className="p-4">Total Biaya</th>
                  <th className="p-4">Status PO</th>
                  <th className="p-4">Tanggal Buat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredPOs.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-4 font-bold text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                      {po.po_number}
                    </td>
                    <td className="p-4 text-slate-200 font-medium">
                      <span className="flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-slate-500" />
                        {po.suppliers?.name || 'Vendor Luar'}
                      </span>
                    </td>
                    <td className="p-4 text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-500" />
                        {po.outlets?.name || 'Gudang Utama'}
                      </span>
                    </td>
                    <td className="p-4 font-extrabold text-blue-400">
                      Rp {Number(po.total_amount || 0).toLocaleString('id-ID')}
                    </td>
                    <td className="p-4">
                      {po.status === 'received' ? (
                        <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-lg inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Selesai (Diterima)
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold rounded-lg inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Dikirim ke Gudang
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-slate-500 text-xs">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-600" />
                        {new Date(po.created_at).toLocaleDateString('id-ID')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Form Buat PO Baru */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-3xl shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                Buat Purchase Order (PO) Baru
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPO} className="space-y-4">
              
              {/* Dropdown Supplier & Outlet */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                    Pilih Vendor Supplier
                  </label>
                  <select
                    required
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
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
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                    Cabang / Gudang Tujuan
                  </label>
                  <select
                    required
                    value={selectedOutlet}
                    onChange={(e) => setSelectedOutlet(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
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

              {/* Dynamic Product Rows */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Daftar Produk Cat yang Dipesan
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Produk
                  </button>
                </div>

                {poItems.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-12 gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 items-center"
                  >
                    <div className="col-span-5">
                      <select
                        required
                        value={item.product_id}
                        onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                        className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="">-- Pilih Produk Cat --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-3">
                      <input
                        type="number"
                        min="1"
                        required
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                        className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="col-span-3">
                      <input
                        type="number"
                        min="0"
                        required
                        placeholder="Harga Beli (Rp)"
                        value={item.unit_cost}
                        onChange={(e) => handleItemChange(index, 'unit_cost', Number(e.target.value))}
                        className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="col-span-1 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(index)}
                        className="p-1.5 text-slate-500 hover:text-red-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Summary & Notes */}
              <div className="pt-2">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                  Catatan Tambahan
                </label>
                <textarea
                  rows={2}
                  placeholder="Keterangan pengiriman, spesifikasi warna, dll..."
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-between text-xs font-bold text-blue-400">
                <span>TOTAL ESTIMASI PEMBELIAN:</span>
                <span className="text-sm text-white">
                  Rp {calculateTotal().toLocaleString('id-ID')}
                </span>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
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