'use client'

import { useState, useEffect } from 'react'
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

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
  })

  useEffect(() => {
    fetchSuppliers()
  }, [])

  // Fetch data supplier dari Supabase
  const fetchSuppliers = async () => {
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
  }

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

    try {
      if (editingId) {
        // Update Supplier
        const { error } = await supabase
          .from('suppliers')
          .update(formData)
          .eq('id', editingId)

        if (error) throw error
      } else {
        // Insert Supplier Baru
        const { error } = await supabase.from('suppliers').insert([formData])
        if (error) throw error
      }

      setIsModalOpen(false)
      fetchSuppliers()
    } catch (err: any) {
      alert(`Gagal menyimpan data: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Hapus Supplier
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus supplier "${name}"?`)) return

    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id)
      if (error) throw error
      fetchSuppliers()
    } catch (err: any) {
      alert(`Gagal menghapus supplier: ${err.message}`)
    }
  }

  // Filter Search
  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.contact_person?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-wider flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-500" />
            MANAJEMEN SUPPLIER
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Kelola data distributor cat & vendor pabrikan bahan baku
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm rounded-xl transition flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/20 active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Supplier Baru</span>
        </button>
      </div>

      {/* Bar Search & Stats */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari kode, nama PT, atau kontak..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        <div className="text-xs text-slate-400 font-medium self-end sm:self-center">
          Total Supplier: <span className="text-blue-400 font-bold">{suppliers.length}</span> Vendor
        </div>
      </div>

      {/* Grid List Supplier */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-xs font-semibold">Memuat Data Supplier...</p>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="py-16 text-center bg-slate-900/50 border border-slate-800/80 rounded-2xl">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-300">Belum ada data supplier</p>
          <p className="text-xs text-slate-500 mt-1">
            {searchQuery ? 'Tidak ada supplier yang sesuai dengan pencarian.' : 'Klik tombol Tambah Supplier Baru untuk memulai.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="bg-slate-900/90 border border-slate-800/80 hover:border-slate-700/80 p-5 rounded-2xl transition flex flex-col justify-between space-y-4 group"
            >
              <div>
                {/* Header Card */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold rounded-lg uppercase">
                      {supplier.code}
                    </span>
                    <h3 className="text-base font-bold text-white mt-2 group-hover:text-blue-400 transition">
                      {supplier.name}
                    </h3>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleOpenModal(supplier)}
                      className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition"
                      title="Edit Supplier"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(supplier.id, supplier.name)}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
                      title="Hapus Supplier"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Detail Informasi Supplier */}
                <div className="mt-4 space-y-2 text-xs text-slate-400">
                  <div className="flex items-center space-x-2">
                    <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>PIC: <strong className="text-slate-200">{supplier.contact_person || '-'}</strong></span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{supplier.phone || '-'}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{supplier.email || '-'}</span>
                  </div>
                  <div className="flex items-start space-x-2 pt-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <span className="line-clamp-2 leading-relaxed">{supplier.address || '-'}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form Tambah / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-lg shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white">
                {editingId ? 'Edit Data Supplier' : 'Tambah Supplier Baru'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                    Kode Vendor
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                    Nama Supplier / PT
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: PT Dulux Indonesia"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                    Contact Person (PIC)
                  </label>
                  <input
                    type="text"
                    placeholder="Nama Sales / PIC"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                    No. Telepon / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="0812xxxxxxxx"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                  Email Vendor
                </label>
                <input
                  type="email"
                  placeholder="sales@ptdulux.co.id"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                  Alamat Lengkap Kantor / Gudang
                </label>
                <textarea
                  rows={3}
                  placeholder="Jl. Industri Cat No. 88, Cikarang..."
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingId ? 'Simpan Perubahan' : 'Tambah Vendor'}</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  )
}