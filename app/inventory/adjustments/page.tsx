'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface InventoryItem {
  id: string
  sku: string
  name: string
  stock: number
  unit: string
}

interface AdjustmentRecord {
  id: string
  type: 'damage' | 'loss' | 'found' | 'opname'
  qty_change: number
  reason: string
  created_at: string
  products: { name: string; sku: string } | null
  users: { name: string } | null
}

export default function StockAdjustmentsPage() {
  const [products, setProducts] = useState<InventoryItem[]>([])
  const [history, setHistory] = useState<AdjustmentRecord[]>([])
  const [loading, setLoading] = useState(true)

  const [staffInfo, setStaffInfo] = useState<{ id: string; companyId: string; outletId: string; outletName: string } | null>(null)
  const [selectedProduct, setSelectedProduct] = useState('')
  const [adjustmentType, setAdjustmentType] = useState<'damage' | 'loss' | 'found' | 'opname'>('damage')
  const [qtyChange, setQtyChange] = useState('')
  const [reason, setReason] = useState('')
  
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    initPage()
  }, [])

  const initPage = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: userData } = await supabase
        .from('users')
        .select('id, company_id, outlet_id, outlets(name)')
        .eq('email', session.user.email)
        .single()

      if (userData && userData.outlet_id) {
        setStaffInfo({
          id: userData.id,
          companyId: userData.company_id,
          outletId: userData.outlet_id,
          outletName: (userData.outlets as any)?.name || 'Cabang Store',
        })

        // Fetch Produk & Stok cabang
        fetchProducts(userData.outlet_id)
        // Fetch Histori Opname cabang ini
        fetchHistory(userData.outlet_id)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchProducts = async (outletId: string) => {
    const { data } = await supabase
      .from('outlet_stocks')
      .select('stock, products(id, sku, name, unit)')
      .eq('outlet_id', outletId)

    if (data) {
      const formatted = data.map((item: any) => ({
        id: item.products.id,
        sku: item.products.sku,
        name: item.products.name,
        stock: item.stock,
        unit: item.products.unit || 'kaleng',
      }))
      setProducts(formatted)
    }
  }

  const fetchHistory = async (outletId: string) => {
    const { data } = await supabase
      .from('stock_adjustments')
      .select(`
        id,
        type,
        qty_change,
        reason,
        created_at,
        products(name, sku),
        users(name)
      `)
      .eq('outlet_id', outletId)
      .order('created_at', { ascending: false })

    if (data) setHistory(data as any)
  }

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!staffInfo) return alert('Sesi pengguna tidak valid.')

    const changeNum = Number(qtyChange)
    if (!changeNum || changeNum === 0) return alert('Jumlah perubahan stok harus diisi!')

    // Tentukan nilai plus/minus berdasarkan tipe penyesuaian
    // damage & loss = pengurangan stok (-), found = penambahan (+), opname = sesuai selisih (+/-)
    let finalQty = changeNum
    if ((adjustmentType === 'damage' || adjustmentType === 'loss') && changeNum > 0) {
      finalQty = -changeNum
    }

    setSubmitting(true)
    setMessage('')

    try {
      // 1. Simpan catatan ke tabel stock_adjustments
      const { error: adjError } = await supabase.from('stock_adjustments').insert([
        {
          company_id: staffInfo.companyId,
          outlet_id: staffInfo.outletId,
          product_id: selectedProduct,
          user_id: staffInfo.id,
          type: adjustmentType,
          qty_change: finalQty,
          reason: reason,
        },
      ])

      if (adjError) throw adjError

      // 2. Update stok fisik barang di outlet_stocks
      const currentItem = products.find(p => p.id === selectedProduct)
      if (currentItem) {
        const newStock = Math.max(0, currentItem.stock + finalQty)
        const { error: stockError } = await supabase
          .from('outlet_stocks')
          .update({ stock: newStock })
          .eq('outlet_id', staffInfo.outletId)
          .eq('product_id', selectedProduct)

        if (stockError) throw stockError
      }

      setMessage('Penyesuaian stok opname berhasil dicatat dan stok fisik ter-update!')
      setSelectedProduct('')
      setQtyChange('')
      setReason('')
      fetchProducts(staffInfo.outletId)
      fetchHistory(staffInfo.outletId)
    } catch (err: any) {
      setMessage(`Gagal menyimpan penyesuaian: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const selectedProdObj = products.find(p => p.id === selectedProduct)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Stok Opname & Penyesuaian Barang</h1>
        <p className="text-xs text-slate-500 mt-1">
          Pencatatan barang rusak, kebocoran, atau penyesuaian selisih opname lokasi: <span className="font-semibold text-blue-600">{staffInfo?.outletName || '...'}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Penyesuaian (Kiri) */}
        <div className="bg-white p-5 sm:p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4 h-fit">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">Form Input Opname</h2>

          {message && (
            <div className={`p-3 rounded-xl text-xs font-semibold ${
              message.startsWith('Gagal') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              {message}
            </div>
          )}

          <form onSubmit={handleCreateAdjustment} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Pilih Produk Cat</label>
              <select
                required
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Pilih Barang --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>[{p.sku}] {p.name} (Sisa: {p.stock} {p.unit})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Kategori Penyesuaian</label>
              <select
                required
                value={adjustmentType}
                onChange={(e) => setAdjustmentType(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:outline-none focus:border-blue-500"
              >
                <option value="damage">Barang Rusak / Bocor (Kurangi Stok)</option>
                <option value="loss">Barang Hilang / Selisih Minus (Kurangi Stok)</option>
                <option value="found">Barang Ditemukan / Selisih Plus (Tambah Stok)</option>
                <option value="opname">Koreksi Rutin Opname</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Jumlah Fisik Perubahan (Qty)</label>
              <input
                type="number"
                required
                min="1"
                placeholder="Contoh: 2"
                value={qtyChange}
                onChange={(e) => setQtyChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:outline-none focus:border-blue-500"
              />
              {selectedProdObj && (
                <p className="text-[10px] text-slate-400 mt-1">
                  Stok saat ini: {selectedProdObj.stock} {selectedProdObj.unit}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Alasan / Catatan Kendala</label>
              <textarea
                required
                rows={3}
                placeholder="Contoh: Kaleng kemasan penyok dan bocor saat pemindahan rak..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/20 disabled:opacity-50"
            >
              {submitting ? 'Memproses...' : 'Simpan Penyesuaian Stok'}
            </button>
          </form>
        </div>

        {/* Tabel Histori Penyesuaian (Kanan) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-900">Riwayat Penyesuaian & Opname</h2>
            <button
              onClick={() => staffInfo && fetchHistory(staffInfo.outletId)}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
            >
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[550px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <th className="py-3.5 px-4 sm:px-6">Produk</th>
                  <th className="py-3.5 px-4 sm:px-6">Kategori</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">Qty Mutasi</th>
                  <th className="py-3.5 px-4 sm:px-6">Keterangan</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-xs sm:text-sm">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400 text-xs">
                      Belum ada riwayat penyesuaian opname.
                    </td>
                  </tr>
                ) : (
                  history.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60">
                      <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900 whitespace-nowrap">
                        {item.products?.name || 'Produk'}
                        <span className="block text-[10px] text-slate-400 font-mono">{item.products?.sku}</span>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.type === 'damage' ? 'bg-red-50 text-red-700 border border-red-200' :
                          item.type === 'loss' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {item.type === 'damage' ? 'RUSAK / BOCOR' : item.type === 'loss' ? 'HILANG' : 'OPNAME / LAINNYA'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-center font-bold whitespace-nowrap">
                        <span className={item.qty_change < 0 ? 'text-red-600' : 'text-emerald-600'}>
                          {item.qty_change > 0 ? `+${item.qty_change}` : item.qty_change}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-slate-600 max-w-xs truncate">
                        {item.reason}
                        <span className="block text-[10px] text-slate-400">Oleh: {item.users?.name || 'Staf'}</span>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-right text-slate-400 text-xs whitespace-nowrap">
                        {new Date(item.created_at).toLocaleDateString('id-ID')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}