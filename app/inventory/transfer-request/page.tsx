'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Outlet {
  id: string
  name: string
}

interface ProductMaster {
  id: string
  sku: string
  name: string
  brand: string
}

interface TransferRecord {
  id: string
  qty: number
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  from_outlet: { name: string } | null
  products: { name: string; sku: string } | null
}

export default function TransferRequestPage() {
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [products, setProducts] = useState<ProductMaster[]>([])
  const [history, setHistory] = useState<TransferRecord[]>([])
  const [loading, setLoading] = useState(true)

  const [staffInfo, setStaffInfo] = useState<{ id: string; companyId: string; outletId: string; outletName: string } | null>(null)
  const [targetOutlet, setTargetOutlet] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [qty, setQty] = useState('')
  
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    initForm()
  }, [])

  const initForm = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Fetch Profil User & Cabang Tempat Tugas
      const { data: userData } = await supabase
        .from('users')
        .select('id, company_id, outlet_id, outlets(name)')
        .eq('email', session.user.email)
        .single()

      if (userData && userData.outlet_id) {
        const info = {
          id: userData.id,
          companyId: userData.company_id,
          outletId: userData.outlet_id,
          outletName: (userData.outlets as any)?.name || 'Cabang Store',
        }
        setStaffInfo(info)

        // Fetch Cabang Lain (Tujuan Permintaan Transfer)
        const { data: outletsData } = await supabase
          .from('outlets')
          .select('id, name')
          .neq('id', userData.outlet_id)

        if (outletsData) setOutlets(outletsData)

        // Fetch Produk Master
        const { data: productsData } = await supabase.from('products').select('id, sku, name, brand')
        if (productsData) setProducts(productsData as any)

        // Fetch Histori Pengajuan Transfer Cabang Ini
        fetchTransferHistory(userData.outlet_id)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchTransferHistory = async (outletId: string) => {
    const { data } = await supabase
      .from('stock_transfers')
      .select(`
        id,
        qty,
        status,
        created_at,
        from_outlet:outlets!stock_transfers_from_outlet_id_fkey(name),
        products(name, sku)
      `)
      .eq('to_outlet_id', outletId)
      .order('created_at', { ascending: false })

    if (data) setHistory(data as any)
  }

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!staffInfo) return alert('Sesi pengguna tidak valid.')

    setSubmitting(true)
    setMessage('')

    try {
      const { error } = await supabase.from('stock_transfers').insert([
        {
          company_id: staffInfo.companyId,
          from_outlet_id: targetOutlet, // Minta dikirim dari cabang ini
          to_outlet_id: staffInfo.outletId, // Masuk ke cabang user saat ini
          product_id: selectedProduct,
          qty: Number(qty),
          status: 'pending',
          requested_by: staffInfo.id,
        },
      ])

      if (error) throw error

      setMessage('Pengajuan permintaan barang berhasil dikirim! Menunggu persetujuan Admin Pusat.')
      setQty('')
      setSelectedProduct('')
      setTargetOutlet('')
      fetchTransferHistory(staffInfo.outletId)
    } catch (err: any) {
      setMessage(`Gagal mengirim pengajuan: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Form & Histori Pengajuan Transfer Stok</h1>
        <p className="text-xs text-slate-500 mt-1">
          Cabang Pemohon: <span className="font-semibold text-blue-600">{staffInfo?.outletName || '...'}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel Form Pengajuan (Kiri) */}
        <div className="bg-white p-5 sm:p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4 h-fit">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">Buat Pengajuan Baru</h2>

          {message && (
            <div className={`p-3 rounded-xl text-xs font-semibold ${
              message.startsWith('Gagal') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              {message}
            </div>
          )}

          <form onSubmit={handleCreateRequest} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Minta Kiriman Dari Cabang</label>
              <select
                required
                value={targetOutlet}
                onChange={(e) => setTargetOutlet(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Pilih Cabang Pengirim --</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Produk Cat Yang Dibutuhkan</label>
              <select
                required
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Pilih Produk Cat --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>[{p.sku}] {p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Jumlah Item (Qty)</label>
              <input
                type="number"
                required
                min="1"
                placeholder="Contoh: 10"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/20 disabled:opacity-50"
            >
              {submitting ? 'Mengirim Pengajuan...' : 'Kirim Pengajuan Ke Pusat'}
            </button>
          </form>
        </div>

        {/* Panel Histori Status Transfer (Kanan) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-900">Histori Pengajuan Transfer</h2>
            <button
              onClick={() => staffInfo && fetchTransferHistory(staffInfo.outletId)}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
            >
              Refresh Status
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[500px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <th className="py-3.5 px-4 sm:px-6">Produk</th>
                  <th className="py-3.5 px-4 sm:px-6">Dari Cabang</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">Qty</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">Status</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-xs sm:text-sm">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400 text-xs">
                      Belum ada pengajuan transfer barang.
                    </td>
                  </tr>
                ) : (
                  history.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60">
                      <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900 whitespace-nowrap">
                        {item.products?.name || 'Produk'}
                        <span className="block text-[10px] text-slate-400 font-mono">{item.products?.sku}</span>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-slate-600 whitespace-nowrap">
                        {item.from_outlet?.name || '-'}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-center font-bold text-slate-900 whitespace-nowrap">
                        {item.qty}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-center whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                          item.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : item.status === 'rejected'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {item.status === 'approved' ? 'DISETUJUI' : item.status === 'rejected' ? 'DITOLAK' : 'MENUNGGU (PENDING)'}
                        </span>
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