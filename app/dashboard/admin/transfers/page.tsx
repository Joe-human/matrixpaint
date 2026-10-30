'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface TransferRequest {
  id: string
  created_at: string
  status: string
  qty: number
  from_outlet_id: string
  to_outlet_id: string
  product_id: string
  from_outlet: { name: string }
  to_outlet: { name: string }
  products: { name: string; sku: string }
}

export default function AdminTransferApprovalPage() {
  const [requests, setRequests] = useState<TransferRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTransferRequests()
  }, [])

  const fetchTransferRequests = async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('stock_transfers')
        .select(`
          id,
          created_at,
          status,
          qty,
          from_outlet_id,
          to_outlet_id,
          product_id,
          from_outlet:outlets!from_outlet_id(name),
          to_outlet:outlets!to_outlet_id(name),
          products(name, sku)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      if (data) setRequests(data as any)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (req: TransferRequest) => {
    try {
      const { error: rpcError } = await supabase.rpc('process_stock_transfer', {
        p_from_outlet_id: req.from_outlet_id,
        p_to_outlet_id: req.to_outlet_id,
        p_product_id: req.product_id,
        p_qty: req.qty,
      })

      if (rpcError) {
        alert(`GAGAL SETUJU: ${rpcError.message}`)
        return
      }

      await supabase
        .from('stock_transfers')
        .update({ status: 'approved' })
        .eq('id', req.id)

      alert('BERHASIL: Permintaan mutasi disetujui! Stok cabang pengirim berkurang dan cabang penerima bertambah.')
      fetchTransferRequests()
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Persetujuan Mutasi Stok Antar Cabang</h1>
        <p className="text-xs text-slate-500 mt-1">
          Pantau dan berikan persetujuan (approval) permintaan transfer barang yang diajukan oleh staf gudang antar cabang.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 font-semibold text-sm text-slate-800">
          Daftar Pengajuan Mutasi Barang
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Memuat data permintaan mutasi...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <th className="py-3.5 px-4 sm:px-6">Tanggal</th>
                  <th className="py-3.5 px-4 sm:px-6">Produk Cat</th>
                  <th className="py-3.5 px-4 sm:px-6">Minta Dari Cabang</th>
                  <th className="py-3.5 px-4 sm:px-6">Untuk Cabang</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">Qty</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">Status</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">Aksi Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      Tidak ada pengajuan mutasi barang.
                    </td>
                  </tr>
                ) : (
                  requests.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 sm:px-6 text-slate-500 whitespace-nowrap">
                        {new Date(item.created_at).toLocaleDateString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 font-semibold text-slate-900 whitespace-nowrap">{item.products?.name}</td>
                      <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">{item.from_outlet?.name}</td>
                      <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">{item.to_outlet?.name}</td>
                      <td className="py-3.5 px-4 sm:px-6 text-center font-bold text-blue-600">{item.qty}</td>
                      <td className="py-3.5 px-4 sm:px-6 text-center whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                          item.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-center whitespace-nowrap">
                        {item.status === 'pending' ? (
                          <button
                            onClick={() => handleApprove(item)}
                            className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-500 transition shadow-sm shadow-blue-600/20"
                          >
                            Setujui (Approve)
                          </button>
                        ) : (
                          <span className="text-slate-400 font-medium text-xs">Selesai</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}