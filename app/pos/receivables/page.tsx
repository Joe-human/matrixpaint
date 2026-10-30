'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface ReceivableItem {
  id: string
  invoice_number: string
  total_amount: number
  customer_name: string
  customer_phone: string
  payment_status: 'unpaid' | 'paid'
  created_at: string
}

export default function POSReceivablesPage() {
  const [receivables, setReceivables] = useState<ReceivableItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    fetchReceivables()
  }, [])

  const fetchReceivables = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: userData } = await supabase
        .from('users')
        .select('outlet_id')
        .eq('email', session.user.email)
        .single()

      if (userData?.outlet_id) {
        const { data, error } = await supabase
          .from('transactions')
          .select('id, invoice_number, total_amount, customer_name, customer_phone, payment_status, created_at')
          .eq('outlet_id', userData.outlet_id)
          .eq('payment_status', 'unpaid')
          .order('created_at', { ascending: false })

        if (error) throw error
        if (data) setReceivables(data as any)
      }
    } catch (err) {
      console.error('Gagal memuat data piutang:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSettle = async (tx: ReceivableItem) => {
    const confirmPay = confirm(`Konfirmasi pelunasan bon atas nama "${tx.customer_name || 'Pelanggan'}" sebesar Rp ${Number(tx.total_amount).toLocaleString('id-ID')}?`)
    if (!confirmPay) return

    try {
      setProcessingId(tx.id)

      // Memperbarui status ke Supabase dan meminta mengembalikan baris yang di-update (.select())
      const { data, error } = await supabase
        .from('transactions')
        .update({
          payment_status: 'paid',
          payment_method: 'cash',
        })
        .eq('id', tx.id)
        .select()

      if (error) throw error

      if (!data || data.length === 0) {
        throw new Error('Gagal memperbarui status. Pastikan izin RLS pada tabel transactions memperbolehkan UPDATE.')
      }

      // Update state lokal secara instan agar item langsung hilang dari daftar bon
      setReceivables((prev) => prev.filter((item) => item.id !== tx.id))

      alert('BERHASIL: Bon telah dilunasi dan tercatat masuk sebagai kas toko!')
    } catch (err: any) {
      console.error('Error pelunasan:', err)
      alert(`Gagal memproses pelunasan: ${err.message}`)
    } finally {
      setProcessingId(null)
    }
  }

  const filtered = receivables.filter(r => 
    (r.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.invoice_number || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.customer_phone || '').includes(search)
  )

  const totalUnpaidAmount = receivables.reduce((sum, r) => sum + Number(r.total_amount || 0), 0)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Pelunasan Bon & Piutang Pelanggan</h1>
          <p className="text-xs text-slate-500 mt-1">Daftar transaksi penangguhan pembayaran yang belum dilunasi.</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl text-right">
          <p className="text-[10px] font-bold text-amber-700 uppercase">Total Outstanding Piutang</p>
          <p className="text-base font-extrabold text-amber-900">Rp {totalUnpaidAmount.toLocaleString('id-ID')}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <input
            type="text"
            placeholder="🔍 Cari nama pelanggan, no. HP, atau invoice..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 w-full sm:w-72"
          />
          <button
            onClick={fetchReceivables}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Memuat catatan piutang...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[650px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <th className="py-3.5 px-4 sm:px-6">No. Invoice</th>
                  <th className="py-3.5 px-4 sm:px-6">Nama Pelanggan</th>
                  <th className="py-3.5 px-4 sm:px-6">No. HP</th>
                  <th className="py-3.5 px-4 sm:px-6">Tanggal Bon</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Total Tagihan</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">Aksi Pelunasan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      Tidak ada catatan bon/piutang aktif.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60">
                      <td className="py-3.5 px-4 sm:px-6 font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                        {item.invoice_number}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 font-semibold text-slate-800 whitespace-nowrap">
                        {item.customer_name || 'Tanpa Nama'}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-slate-500 whitespace-nowrap">
                        {item.customer_phone || '-'}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-slate-500 whitespace-nowrap">
                        {new Date(item.created_at).toLocaleDateString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-right font-bold text-amber-600 whitespace-nowrap">
                        Rp {Number(item.total_amount).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleSettle(item)}
                          disabled={processingId === item.id}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
                        >
                          {processingId === item.id ? 'Memproses...' : 'Terima Pelunasan'}
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
    </div>
  )
}