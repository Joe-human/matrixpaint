'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface StaffUser {
  id: string
  name: string
  email: string
  role: string
  outlets?: { name: string } | null
}

interface Outlet {
  id: string
  name: string
}

export default function StaffManagementPage() {
  const [staffList, setStaffList] = useState<StaffUser[]>([])
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [loading, setLoading] = useState(true)

  // State Form Tambah Staf
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('cashier')
  const [selectedOutlet, setSelectedOutlet] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch Daftar Outlet Perusahaan
      const { data: outletsData } = await supabase.from('outlets').select('id, name')
      if (outletsData) setOutlets(outletsData)

      // Fetch Daftar Staf Karyawan
      const { data: usersData } = await supabase
        .from('users')
        .select('id, name, email, role, outlets(name)')
        .order('created_at', { ascending: false })

      if (usersData) setStaffList(usersData as any)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage('')

    try {
      // 1. Ambil company_id milik Owner yang sedang login
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) throw new Error('Sesi Owner tidak terdeteksi. Silakan login kembali.')

      const { data: ownerProfile } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', currentUser.id)
        .single()

      if (!ownerProfile?.company_id) throw new Error('Company ID owner tidak ditemukan.')

      // 2. Mendaftarkan Akun ke Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) throw authError

      if (authData.user) {
        // 3. Memasukkan Profil Staf ke Tabel public.users
        const { error: dbError } = await supabase.from('users').insert([
          {
            id: authData.user.id,
            company_id: ownerProfile.company_id,
            outlet_id: role === 'admin' ? null : selectedOutlet || null,
            name,
            email,
            role,
          },
        ])

        if (dbError) throw dbError

        setMessage('Karyawan baru berhasil didaftarkan!')
        setName('')
        setEmail('')
        setPassword('')
        setSelectedOutlet('')
        fetchData()
      }
    } catch (err: any) {
      setMessage(`Gagal: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  // FUNGSI UTAMA: HAPUS AKUN KARYAWAN
  const handleDeleteStaff = async (staffId: string, staffName: string) => {
    const confirmed = confirm(`Apakah Anda yakin ingin menghapus akun karyawan "${staffName}"?`)
    if (!confirmed) return

    setDeletingId(staffId)
    try {
      // Hapus profil user dari tabel public.users
      const { error } = await supabase.from('users').delete().eq('id', staffId)

      if (error) throw error

      alert(`Akun karyawan "${staffName}" berhasil dihapus.`)
      fetchData()
    } catch (err: any) {
      alert(`Gagal menghapus karyawan: ${err.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Manajemen Staf & Karyawan</h1>
        <p className="text-xs text-slate-500 mt-1">Daftarkan atau hapus akun kasir, admin operasional, atau staf gudang per cabang.</p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-xs font-medium border ${
          message.startsWith('Gagal') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
        }`}>
          {message}
        </div>
      )}

      {/* Form Tambah Karyawan */}
      <form onSubmit={handleAddStaff} className="bg-white p-5 sm:p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-slate-800">Tambah Karyawan Baru</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nama Lengkap</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Budi Santoso"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email Akses Login</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="budi@duniawarna.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Password Awal</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Role / Jabatan</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-500"
            >
              <option value="cashier">Kasir Toko (Cashier)</option>
              <option value="inventory">Staf Gudang (Inventory)</option>
              <option value="admin">Admin Operasional Pusat</option>
            </select>
          </div>

          {role !== 'admin' && (
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Penempatan Cabang Outlet</label>
              <select
                value={selectedOutlet}
                onChange={(e) => setSelectedOutlet(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Pilih Cabang --</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-500 transition disabled:opacity-50 shadow-md shadow-blue-600/20"
        >
          {submitting ? 'Mendaftarkan...' : 'Simpan & Daftarkan Karyawan'}
        </button>
      </form>

      {/* Tabel Daftar Karyawan */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 font-semibold text-sm text-slate-800">
          Daftar Karyawan Aktif
        </div>
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Memuat data staf...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase">
                  <th className="py-3 px-4 sm:px-6">Nama</th>
                  <th className="py-3 px-4 sm:px-6">Email</th>
                  <th className="py-3 px-4 sm:px-6">Role</th>
                  <th className="py-3 px-4 sm:px-6">Cabang Penempatan</th>
                  <th className="py-3 px-4 sm:px-6 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {staffList.map((staf) => (
                  <tr key={staf.id} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900 whitespace-nowrap">{staf.name}</td>
                    <td className="py-3.5 px-4 sm:px-6 text-slate-500 whitespace-nowrap">{staf.email}</td>
                    <td className="py-3.5 px-4 sm:px-6 capitalize whitespace-nowrap">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold">
                        {staf.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-slate-600 whitespace-nowrap">
                      {staf.outlets?.name || 'Pusat (Semua Cabang)'}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-center whitespace-nowrap">
                      {staf.role !== 'owner' ? (
                        <button
                          onClick={() => handleDeleteStaff(staf.id, staf.name)}
                          disabled={deletingId === staf.id}
                          className="px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-100 transition disabled:opacity-50"
                        >
                          {deletingId === staf.id ? 'Menghapus...' : 'Hapus'}
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Owner</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}