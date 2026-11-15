'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Truck,
  Plus,
  Search,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  Edit2,
  Trash2,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react'

interface Supplier {
  id: string
  code: string
  name: string
  contact_person: string
  phone: string
  email: string
  address: string
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Banner Notifikasi Non-Blocking
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  )

  // State Konfirmasi Hapus
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
  })

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev))
    }, 4500)
  }

  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setSuppliers(data || [])
    } catch (err: any) {
      console.error('Error fetching suppliers:', err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  // Open Modal (Tambah / Edit)
  const handleOpenModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingId(supplier.id)
      setFormData({
        code: supplier.code,
        name: supplier.name,
        contact_person: supplier.contact_person || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        address: supplier.address || '',
      })
    } else {
      setEditingId(null)
      setFormData({
        code: `SUP-${Math.floor(1000 + Math.random() * 9000)}`,
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
      })
    }
    setIsModalOpen(true)
  }

  // Submit Form (Insert / Update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const payload = {
      code: formData.code.trim().toUpperCase(),
      name: formData.name.trim(),
      contact_person: formData.contact_person.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      address: formData.address.trim(),
    }

    try {
      if (editingId) {
        const { error } = await supabase.from('suppliers').update(payload).eq('id', editingId)
        if (error) throw error
        showFeedback('success', `Data supplier "${payload.name}" berhasil diperbarui.`)
      } else {
        const { error } = await supabase.from('suppliers').insert([payload])
        if (error) throw error
        showFeedback('success', `Vendor "${payload.name}" berhasil ditambahkan.`)
      }

      setIsModalOpen(false)
      fetchSuppliers()
    } catch (err: any) {
      showFeedback('error', `Gagal menyimpan data: ${err.message || 'Terjadi kesalahan'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Eksekusi Hapus Supplier
  const executeDeleteSupplier = async () => {
    if (!confirmDelete) return
    const { id, name } = confirmDelete

    setDeletingId(id)
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id)
      if (error) {
        if (error.code === '23503') {
          throw new Error(
            'Supplier tidak dapat dihapus karena sudah terhubung dengan dokumen Purchase Order.'
          )
        }
        throw error
      }

      showFeedback('success', `Supplier "${name}" berhasil dihapus.`)
      setConfirmDelete(null)
      fetchSuppliers()
    } catch (err: any) {
      showFeedback('error', `Gagal menghapus supplier: ${err.message}`)
      setConfirmDelete(null)
    } finally {
      setDeletingId(null)
    }
  }

  // Filter Search
  const filteredSuppliers = suppliers.filter((s) => {
    const q = searchQuery.toLowerCase()
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.code || '').toLowerCase().includes(q) ||
      (s.contact_person || '').toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="p-3 min-[375px]:p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 max-w-7xl mx-auto space-y-5 sm:space-y-7">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg min-[375px]:text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 shrink-0" />
            <span>Manajemen Supplier & Vendor</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
            Kelola data distributor cat & vendor pabrikan bahan baku untuk pengadaan stok.
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-semibold text-xs rounded-xl transition inline-flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Supplier Baru</span>
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

      {/* BAR SEARCH & STATS */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari kode, nama PT, atau kontak PIC..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
          />
        </div>

        <div className="text-[11px] font-semibold text-slate-500 shrink-0">
          Total Terdaftar: <span className="text-blue-600 font-bold">{filteredSuppliers.length}</span>{' '}
          Vendor
        </div>
      </div>

      {/* GRID LIST SUPPLIER */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="bg-white h-48 rounded-2xl border border-slate-200 p-5" />
          ))}
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="py-14 px-4 text-center bg-white border border-slate-200/90 rounded-2xl shadow-sm space-y-1.5">
          <Building2 className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs sm:text-sm font-semibold text-slate-600">
            {suppliers.length === 0 ? 'Belum ada data supplier' : 'Supplier tidak ditemukan'}
          </p>
          <p className="text-[11px] text-slate-400">
            {searchQuery
              ? 'Tidak ada supplier yang sesuai dengan kata kunci pencarian.'
              : 'Klik tombol "Tambah Supplier Baru" untuk menambahkan vendor.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
          {filteredSuppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="bg-white border border-slate-200/90 hover:border-blue-300 p-4 min-[375px]:p-5 rounded-2xl shadow-sm transition flex flex-col justify-between space-y-4 group"
            >
              <div>
                {/* Header Card */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="inline-block px-2.5 py-0.5 bg-blue-50 border border-blue-200/80 text-blue-700 font-mono text-[10px] font-bold rounded-md uppercase">
                      {supplier.code}
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-2 group-hover:text-blue-600 transition break-words">
                      {supplier.name}
                    </h3>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenModal(supplier)}
                      className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                      title="Edit Supplier"
                      aria-label={`Edit ${supplier.name}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ id: supplier.id, name: supplier.name })}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Hapus Supplier"
                      aria-label={`Hapus ${supplier.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Detail Informasi Supplier */}
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-500">
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">
                      PIC:{' '}
                      <strong className="text-slate-800 font-semibold">
                        {supplier.contact_person || '-'}
                      </strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{supplier.phone || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{supplier.email || '-'}</span>
                  </div>
                  <div className="flex items-start gap-2 pt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2 leading-relaxed break-words">
                      {supplier.address || '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL FORM TAMBAH / EDIT */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 min-[375px]:p-4">
          <div className="bg-white border border-slate-200 p-4 min-[375px]:p-5 sm:p-6 rounded-2xl w-full max-w-lg shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                {editingId ? 'Edit Data Supplier' : 'Tambah Supplier Baru'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
                aria-label="Tutup modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Kode Vendor *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 uppercase focus:outline-none focus:bg-white focus:border-blue-500 transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Nama Supplier / PT *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: PT Dulux Indonesia"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Contact Person (PIC)
                  </label>
                  <input
                    type="text"
                    placeholder="Nama Sales / PIC"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    No. Telepon / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="0812xxxxxxxx"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Email Vendor
                </label>
                <input
                  type="email"
                  placeholder="sales@ptdulux.co.id"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Alamat Lengkap Kantor / Gudang
                </label>
                <textarea
                  rows={3}
                  placeholder="Jl. Industri Cat No. 88, Cikarang..."
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
                />
              </div>

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
                  <span>{editingId ? 'Simpan Perubahan' : 'Tambah Vendor'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS SUPPLIER */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 min-[375px]:p-4 z-50">
          <div className="bg-white rounded-2xl p-4 min-[375px]:p-5 sm:p-6 max-w-sm w-full space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900">Hapus Data Supplier?</h3>
                <p className="text-xs text-slate-500 mt-1 break-words">
                  Vendor <span className="font-bold text-slate-800">{confirmDelete.name}</span> akan
                  dihapus dari daftar supplier perusahaan.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={executeDeleteSupplier}
                disabled={deletingId === confirmDelete.id}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-[0.99] text-white rounded-xl text-xs font-semibold transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {deletingId === confirmDelete.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{deletingId === confirmDelete.id ? 'Menghapus...' : 'Ya, Hapus'}</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={deletingId === confirmDelete.id}
                className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-200 transition"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}