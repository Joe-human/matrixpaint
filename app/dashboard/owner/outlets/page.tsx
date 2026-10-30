'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Outlet {
  id: string
  name: string
  address: string
  phone: string
  created_at: string
}

export default function OwnerOutletsPage() {
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [loading, setLoading] = useState(true)

  // State Form Tambah Cabang
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // State Modal Edit Cabang
  const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null)
  const [editName, setEditName] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetchOutlets()
  }, [])

  const fetchOutlets = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('outlets')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      if (data) setOutlets(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // 1. TAMBAH CABANG BARU
  const handleCreateOutlet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name) return alert('Nama cabang wajib diisi!')

    try {
      setSubmitting(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User tidak terautentikasi')

      const { data: profile } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) throw new Error('Company ID tidak ditemukan')

      const { error } = await supabase.from('outlets').insert([
        {
          company_id: profile.company_id,
          name,
          address,
          phone,
        },
      ])

      if (error) throw error

      alert('Berhasil! Cabang baru telah ditambahkan.')
      setName('')
      setAddress('')
      setPhone('')
      fetchOutlets()
    } catch (err: any) {
      alert('Gagal menambah cabang: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // 2. BUKA MODAL EDIT
  const handleOpenEdit = (outlet: Outlet) => {
    setEditingOutlet(outlet)
    setEditName(outlet.name || '')
    setEditAddress(outlet.address || '')
    setEditPhone(outlet.phone || '')
  }

  // 3. SIMPAN PERUBAHAN EDIT
  const handleUpdateOutlet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingOutlet) return
    if (!editName) return alert('Nama cabang tidak boleh kosong!')

    try {
      setUpdating(true)
      const { error } = await supabase
        .from('outlets')
        .update({
          name: editName,
          address: editAddress,
          phone: editPhone,
        })
        .eq('id', editingOutlet.id)

      if (error) throw error

      alert('Data cabang berhasil diperbarui!')
      setEditingOutlet(null)
      fetchOutlets()
    } catch (err: any) {
      alert('Gagal memperbarui cabang: ' + err.message)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Manajemen Cabang Toko</h1>
        <p className="text-xs text-slate-500 mt-1">Tambah, edit, dan kelola lokasi seluruh cabang usaha MatrixPaint.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* FORM TAMBAH CABANG */}
        <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-2xl shadow-sm space-y-4 h-fit">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">Tambah Cabang Baru</h2>
          <form onSubmit={handleCreateOutlet} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Cabang / Outlet *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Cabang Bintaro"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Alamat Lengkap</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Jl. Utama No. 12, Bintaro"
                rows={3}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nomor Telepon Toko</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0812xxxxxxxx"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition shadow-md shadow-blue-600/20 disabled:opacity-50"
            >
              {submitting ? 'Simpan Data...' : '+ Simpan Cabang Baru'}
            </button>
          </form>
        </div>

        {/* TABEL DAFTAR CABANG */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 font-semibold text-sm text-slate-800">
            Daftar Cabang Aktif
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Memuat data cabang...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm min-w-[500px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                    <th className="py-3.5 px-4 sm:px-6">Nama Cabang</th>
                    <th className="py-3.5 px-4 sm:px-6">Alamat</th>
                    <th className="py-3.5 px-4 sm:px-6">Telepon</th>
                    <th className="py-3.5 px-4 sm:px-6 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                  {outlets.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-slate-400">
                        Belum ada cabang terdaftar.
                      </td>
                    </tr>
                  ) : (
                    outlets.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="py-3.5 px-4 sm:px-6 font-bold text-slate-900 whitespace-nowrap">{item.name}</td>
                        <td className="py-3.5 px-4 sm:px-6 text-slate-500">{item.address || '-'}</td>
                        <td className="py-3.5 px-4 sm:px-6 font-mono text-slate-600 whitespace-nowrap">{item.phone || '-'}</td>
                        <td className="py-3.5 px-4 sm:px-6 text-center whitespace-nowrap">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-semibold text-xs hover:bg-amber-100 transition"
                          >
                            ✏️ Edit
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

      {/* MODAL EDIT DATA CABANG */}
      {editingOutlet && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Edit Data Cabang</h3>
              <button
                onClick={() => setEditingOutlet(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateOutlet} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Cabang / Outlet *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Alamat Lengkap</label>
                <textarea
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nomor Telepon Toko</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="0812xxxxxxxx"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                />
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
                  onClick={() => setEditingOutlet(null)}
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