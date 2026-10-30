'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  PackageCheck,
  Truck,
  Building2,
  CheckCircle2,
  Clock,
  RefreshCw,
  Loader2,
  Boxes,
} from 'lucide-react'

interface IncomingTransfer {
  id: string
  reference_no: string
  qty: number
  status: string
  created_at: string
  source_name: string
  type: 'interbranch' | 'supplier'
  products: { id: string; name: string; sku: string; unit: string } | null
}

export default function GoodsReceiptPage() {
  const [activeTab, setActiveTab] = useState<'interbranch' | 'supplier'>('interbranch')
  const [incomingList, setIncomingList] = useState<IncomingTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [staffInfo, setStaffInfo] = useState<{ id: string; outletId: string; outletName: string } | null>(null)

  useEffect(() => {
    initPage()
  }, [])

  useEffect(() => {
    if (staffInfo) {
      fetchIncomingItems(staffInfo.outletId)
    }
  }, [activeTab])

  const initPage = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: userData } = await supabase
        .from('users')
        .select('id, outlet_id, outlets(name)')
        .eq('email', session.user.email)
        .single()

      if (userData && userData.outlet_id) {
        const outletData = {
          id: userData.id,
          outletId: userData.outlet_id,
          outletName: (userData.outlets as any)?.name || 'Cabang Store',
        }
        setStaffInfo(outletData)
        fetchIncomingItems(outletData.outletId)
      }
    } catch (err) {
      console.error('Error init page:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchIncomingItems = async (outletId: string) => {
    setLoading(true)
    try {
      if (activeTab === 'interbranch') {
        // Fetch Transfer Antar Cabang (Kode Asli Kamu)
        const { data } = await supabase
          .from('stock_transfers')
          .select(`
            id,
            qty,
            status,
            created_at,
            from_outlet:outlets!stock_transfers_from_outlet_id_fkey(name),
            products(id, name, sku, unit)
          `)
          .eq('to_outlet_id', outletId)
          .in('status', ['approved', 'completed'])
          .order('created_at', { ascending: false })

        if (data) {
          const formatted: IncomingTransfer[] = data.map((item: any) => ({
            id: item.id,
            reference_no: `TRF-${item.id.slice(0, 6).toUpperCase()}`,
            qty: item.qty,
            status: item.status,
            created_at: item.created_at,
            source_name: item.from_outlet?.name || 'Pusat/Cabang',
            type: 'interbranch',
            products: item.products,
          }))
          setIncomingList(formatted)
        }
      } else {
        // Fetch Barang Masuk dari Supplier (Purchase Order)
        const { data } = await supabase
          .from('po_items')
          .select(`
            id,
            quantity,
            purchase_orders!inner(
              id,
              po_number,
              status,
              created_at,
              outlet_id,
              suppliers(name)
            ),
            products(id, name, sku, unit)
          `)
          .eq('purchase_orders.outlet_id', outletId)
          .order('created_at', { ascending: false })

        if (data) {
          const formatted: IncomingTransfer[] = data.map((item: any) => ({
            id: item.id,
            reference_no: item.purchase_orders?.po_number || 'PO-VENDOR',
            qty: item.quantity,
            status: item.purchase_orders?.status || 'pending',
            created_at: item.purchase_orders?.created_at,
            source_name: item.purchase_orders?.suppliers?.name || 'Vendor Luar',
            type: 'supplier',
            products: item.products,
          }))
          setIncomingList(formatted)
        }
      }
    } catch (err) {
      console.error('Error fetching items:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmReceipt = async (item: IncomingTransfer) => {
    if (!staffInfo || !item.products) return
    const confirmReceive = confirm(
      `Konfirmasi penerimaan "${item.products.name}" sebanyak ${item.qty} ${item.products.unit || 'unit'}? Stok gudang akan otomatis bertambah.`
    )
    if (!confirmReceive) return

    try {
      setProcessingId(item.id)

      // 1. Tambahkan stok barang ke outlet_stocks cabang tujuan
      const { data: existingStock } = await supabase
        .from('outlet_stocks')
        .select('stock')
        .eq('outlet_id', staffInfo.outletId)
        .eq('product_id', item.products.id)
        .maybeSingle()

      if (existingStock) {
        const newStock = Number(existingStock.stock || 0) + Number(item.qty)
        await supabase
          .from('outlet_stocks')
          .update({ stock: newStock })
          .eq('outlet_id', staffInfo.outletId)
          .eq('product_id', item.products.id)
      } else {
        await supabase.from('outlet_stocks').insert([
          {
            outlet_id: staffInfo.outletId,
            product_id: item.products.id,
            stock: item.qty,
            min_stock: 3,
          },
        ])
      }

      // 2. Ubah status transaksi (Transfer -> completed | PO -> received)
      if (item.type === 'interbranch') {
        const { error: updateError } = await supabase
          .from('stock_transfers')
          .update({ status: 'completed' })
          .eq('id', item.id)

        if (updateError) throw updateError
      } else {
        const { error: updateError } = await supabase
          .from('purchase_orders')
          .update({ status: 'received' })
          .eq('po_number', item.reference_no)

        if (updateError) throw updateError
      }

      alert('BERHASIL: Barang telah diterima dan stok gudang resmi diperbarui!')
      fetchIncomingItems(staffInfo.outletId)
    } catch (err: any) {
      alert(`Gagal mengonfirmasi penerimaan: ${err.message}`)
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      
      {/* Header Info Outlet */}
      <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-black text-white tracking-wider flex items-center gap-2">
            <PackageCheck className="w-6 h-6 text-blue-500" />
            PENERIMAAN BARANG MASUK
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Konfirmasi fisik barang masuk ke gudang: <span className="font-semibold text-blue-400">{staffInfo?.outletName || '...'}</span>
          </p>
        </div>
        <button
          onClick={() => staffInfo && fetchIncomingItems(staffInfo.outletId)}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition flex items-center space-x-2 border border-slate-700 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Tabs Menu (Transfer Cabang vs PO Supplier) */}
      <div className="flex border-b border-slate-800 space-x-2">
        <button
          onClick={() => setActiveTab('interbranch')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold transition flex items-center space-x-2 border-b-2 cursor-pointer ${
            activeTab === 'interbranch'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Transfer Antar Cabang</span>
        </button>

        <button
          onClick={() => setActiveTab('supplier')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold transition flex items-center space-x-2 border-b-2 cursor-pointer ${
            activeTab === 'supplier'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Dari Supplier (Purchase Order)</span>
        </button>
      </div>

      {/* Data Table Container */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            <span>Memuat daftar barang masuk...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[650px] text-slate-300">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6">Produk</th>
                  <th className="py-3.5 px-4 sm:px-6">
                    {activeTab === 'interbranch' ? 'Cabang Pengirim' : 'Vendor Supplier'}
                  </th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">Jumlah (Qty)</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">Status Kiriman</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">Aksi Konfirmasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {incomingList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-500 text-xs">
                      <Boxes className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                      Tidak ada antrean kiriman barang masuk yang perlu dikonfirmasi.
                    </td>
                  </tr>
                ) : (
                  incomingList.map((item) => {
                    const isDone = item.status === 'completed' || item.status === 'received'
                    return (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4 sm:px-6 font-semibold text-white whitespace-nowrap">
                          {item.products?.name || 'Produk Cat'}
                          <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                            {item.products?.sku} ({item.reference_no})
                          </span>
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-slate-300 whitespace-nowrap font-medium">
                          {item.source_name}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-center font-extrabold text-blue-400 whitespace-nowrap">
                          {item.qty} {item.products?.unit || 'kaleng'}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-center whitespace-nowrap">
                          {isDone ? (
                            <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-lg inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Selesai (Diterima)
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold rounded-lg inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Siap Diterima
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-center whitespace-nowrap">
                          {isDone ? (
                            <span className="text-xs text-emerald-400 font-semibold">✓ Terkonfirmasi</span>
                          ) : (
                            <button
                              onClick={() => handleConfirmReceipt(item)}
                              disabled={processingId === item.id}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                              {processingId === item.id ? 'Memproses...' : 'Konfirmasi Terima Barang'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}