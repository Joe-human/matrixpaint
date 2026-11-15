'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Building2,
  Plus,
  MapPin,
  Phone,
  Pencil,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Store,
} from 'lucide-react'

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

  // Banner Notifikasi Non-Blocking
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  )

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

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev))
    }, 4000)
  }

  const fetchOutlets = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('outlets')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      if (data) setOutlets(data)
    } catch (err) {
      console.error('Gagal memuat data cabang:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOutlets()
  }, [fetchOutlets])

  // 1. TAMBAH CABANG BARU
  const handleCreateOutlet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      showFeedback('error', 'Nama cabang wajib diisi!')
      return
    }

    try {
      setSubmitting(true)
      setFeedback(null)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Sesi login tidak ditemukan, silakan login ulang.')

      // Cari company_id lewat ID user, jika tidak ketemu fallback lewat email
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

      if (!companyId) throw new Error('Company ID tidak ditemukan pada akun Owner ini.')

      const { error } = await supabase.from('outlets').insert([
        {
          company_id: companyId,
          name: name.trim(),
          address: address.trim(),
          phone: phone.trim(),
        },
      ])

      if (error) throw error

      showFeedback('success', `Cabang "${name.trim()}" berhasil ditambahkan!`)
      setName('')
      setAddress('')
      setPhone('')
      fetchOutlets()
    } catch (err: any) {
      showFeedback('error', 'Gagal menambah cabang: ' + (err.message || 'Terjadi kesalahan'))
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
    if (!editName.trim()) {
      showFeedback('error', 'Nama cabang tidak boleh kosong!')
      return
    }

    try {
      setUpdating(true)
      const { error } = await supabase
        .from('outlets')
        .update({
          name: editName.trim(),
          address: editAddress.trim(),
          phone: editPhone.trim(),
        })
        .eq('id', editingOutlet.id)

      if (error) throw error

      showFeedback('success', `Data cabang "${editName.trim()}" berhasil diperbarui!`)
      setEditingOutlet(null)
      fetchOutlets()
    } catch (err: any) {
      showFeedback('error', 'Gagal memperbarui cabang: ' + (err.message || 'Terjadi kesalahan'))
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="p-3 min-[375px]:p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 max-w-7xl mx-auto space-y-5 sm:space-y-7">
      {/* HEADER PAGE */}
      <div>
        <h1 className="text-lg min-[375px]:text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 shrink-0" />
          <span>Manajemen Cabang Toko</span>
        </h1>
        <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
          Tambah, edit, dan kelola lokasi seluruh cabang usaha MatrixPaint.
        </p>
      </div>

      {/* FEEDBACK BANNER */}
      {feedback && (
        <div
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border text-xs font-medium transition-all ${
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-7 items-start">
        {/* FORM TAMBAH CABANG */}
        <div className="bg-white border border-slate-200/90 p-4 sm:p-6 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Plus className="w-4 h-4 text-blue-600 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900">Tambah Cabang Baru</h2>
          </div>

          <form onSubmit={handleCreateOutlet} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Nama Cabang / Outlet *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Cabang Bintaro"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Alamat Lengkap
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Jl. Utama No. 12, Bintaro"
                rows={3}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Nomor Telepon Toko
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0812xxxxxxxx"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white text-xs font-semibold rounded-xl transition shadow-md shadow-blue-600/20 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Simpan Cabang Baru</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* DAFTAR CABANG AKTIF */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between gap-2">
            <span className="font-bold text-xs sm:text-sm text-slate-800">Daftar Cabang Aktif</span>
            <span className="text-[11px] font-semibold text-slate-400">
              {outlets.length} cabang
            </span>
          </div>

          {loading ? (
            <div className="p-5 space-y-3 animate-pulse">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-16 bg-slate-100 rounded-xl" />
              ))}
            </div>
          ) : outlets.length === 0 ? (
            <div className="text-center py-14 px-4 space-y-1.5">
              <Store className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs sm:text-sm font-semibold text-slate-600">
                Belum ada cabang terdaftar
              </p>
              <p className="text-[11px] text-slate-400">
                Gunakan formulir di samping untuk menambahkan cabang toko pertama Anda.
              </p>
            </div>
          ) : (
            <>
              {/* TAMPILAN MOBILE (< 768px): CARD LIST */}
              <div className="md:hidden divide-y divide-slate-100">
                {outlets.map((item) => (
                  <div key={item.id} className="p-3.5 min-[375px]:p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 break-words">
                        {item.name}
                      </h3>
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-semibold text-[11px] hover:bg-amber-100 active:scale-95 transition shrink-0"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                    </div>

                    <div className="space-y-1 text-[11px] text-slate-500">
                      <p className="flex items-start gap-1.5 break-words">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span>{item.address || 'Alamat belum diisi'}</span>
                      </p>
                      <p className="flex items-center gap-1.5 font-mono text-slate-600">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{item.phone || '-'}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* TAMPILAN DESKTOP / TABLET (>= 768px): TABEL */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                      <th className="py-3.5 px-5">Nama Cabang</th>
                      <th className="py-3.5 px-5">Alamat</th>
                      <th className="py-3.5 px-5">Telepon</th>
                      <th className="py-3.5 px-5 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                    {outlets.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-5 font-bold text-slate-900 whitespace-nowrap">
                          {item.name}
                        </td>
                        <td className="py-3.5 px-5 text-slate-500 max-w-xs">
                          {item.address || '-'}
                        </td>
                        <td className="py-3.5 px-5 font-mono text-slate-600 whitespace-nowrap">
                          {item.phone || '-'}
                        </td>
                        <td className="py-3.5 px-5 text-center whitespace-nowrap">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-semibold text-xs hover:bg-amber-100 transition"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Edit</span>
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
      </div>

      {/* MODAL EDIT DATA CABANG */}
      {editingOutlet && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 min-[375px]:p-4 z-50">
          <div className="bg-white rounded-2xl p-4 min-[375px]:p-5 sm:p-6 max-w-md w-full space-y-4 shadow-xl max-h-[90dvh] overflow-y-auto border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Edit Data Cabang</h3>
              <button
                onClick={() => setEditingOutlet(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition"
                aria-label="Tutup modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateOutlet} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nama Cabang / Outlet *
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
                  Alamat Lengkap
                </label>
                <textarea
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nomor Telepon Toko
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="0812xxxxxxxx"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition"
                />
              </div>

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