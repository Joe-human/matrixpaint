'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Building2,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  AlertTriangle,
} from 'lucide-react'

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
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState('cashier')
  const [selectedOutlet, setSelectedOutlet] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // State Konfirmasi Hapus & Feedback
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  )

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev))
    }, 4500)
  }

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch Daftar Outlet Perusahaan
      const { data: outletsData } = await supabase
        .from('outlets')
        .select('id, name')
        .order('name', { ascending: true })
      if (outletsData) setOutlets(outletsData)

      // Fetch Daftar Staf Karyawan
      const { data: usersData } = await supabase
        .from('users')
        .select('id, name, email, role, outlets(name)')
        .order('created_at', { ascending: false })

      if (usersData) setStaffList(usersData as unknown as StaffUser[])
    } catch (err) {
      console.error('Gagal memuat data staf:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      showFeedback('error', 'Password minimal harus 6 karakter.')
      return
    }

    setSubmitting(true)
    setFeedback(null)

    try {
      // 1. Simpan sesi aktif Owner agar tidak tertimpa saat signUp user baru
      const {
        data: { session: ownerSession },
      } = await supabase.auth.getSession()

      if (!ownerSession?.user) {
        throw new Error('Sesi Owner tidak terdeteksi. Silakan login kembali.')
      }

      // Ambil company_id milik Owner (cek by id, fallback by email)
      let companyId: string | null = null
      const { data: profileById } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', ownerSession.user.id)
        .maybeSingle()

      if (profileById?.company_id) {
        companyId = profileById.company_id
      } else if (ownerSession.user.email) {
        const { data: profileByEmail } = await supabase
          .from('users')
          .select('company_id')
          .eq('email', ownerSession.user.email)
          .maybeSingle()
        companyId = profileByEmail?.company_id || null
      }

      if (!companyId) throw new Error('Company ID owner tidak ditemukan.')

      // 2. Daftarkan Akun ke Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            name: name.trim(),
            role,
          },
        },
      })

      if (authError) throw authError

      // Kembalikan sesi Owner jika signUp otomatis mengganti sesi aktif
      if (ownerSession.access_token && ownerSession.refresh_token) {
        await supabase.auth.setSession({
          access_token: ownerSession.access_token,
          refresh_token: ownerSession.refresh_token,
        })
      }

      if (authData.user) {
        // 3. Memasukkan Profil Staf ke Tabel public.users
        const { error: dbError } = await supabase.from('users').insert([
          {
            id: authData.user.id,
            company_id: companyId,
            outlet_id: role === 'admin' ? null : selectedOutlet || null,
            name: name.trim(),
            email: email.trim().toLowerCase(),
            role,
          },
        ])

        if (dbError) throw dbError

        showFeedback('success', `Karyawan "${name.trim()}" berhasil didaftarkan!`)
        setName('')
        setEmail('')
        setPassword('')
        setSelectedOutlet('')
        fetchData()
      }
    } catch (err: any) {
      showFeedback('error', `Gagal: ${err.message || 'Terjadi kesalahan saat mendaftarkan staf'}`)
    } finally {
      setSubmitting(false)
    }
  }

  // FUNGSI UTAMA: HAPUS AKUN KARYAWAN
  const executeDeleteStaff = async () => {
    if (!confirmDelete) return
    const { id: staffId, name: staffName } = confirmDelete

    setDeletingId(staffId)
    try {
      const { error } = await supabase.from('users').delete().eq('id', staffId)
      if (error) throw error

      showFeedback('success', `Akun karyawan "${staffName}" berhasil dihapus.`)
      setConfirmDelete(null)
      fetchData()
    } catch (err: any) {
      showFeedback('error', `Gagal menghapus karyawan: ${err.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  const getRoleBadge = (r: string) => {
    const normalized = r?.toLowerCase()
    if (normalized === 'owner') return 'bg-indigo-50 text-indigo-700 border-indigo-200'
    if (normalized === 'admin') return 'bg-blue-50 text-blue-700 border-blue-200'
    if (normalized === 'inventory') return 'bg-amber-50 text-amber-700 border-amber-200'
    return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }

  const formatRoleLabel = (r: string) => {
    const normalized = r?.toLowerCase()
    if (normalized === 'cashier' || normalized === 'kasir') return 'Kasir'
    if (normalized === 'inventory') return 'Gudang'
    if (normalized === 'admin') return 'Admin Pusat'
    if (normalized === 'owner') return 'Owner'
    return r
  }

  return (
    <div className="p-3 min-[375px]:p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 max-w-6xl mx-auto space-y-5 sm:space-y-7">
      {/* HEADER */}
      <div>
        <h1 className="text-lg min-[375px]:text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 shrink-0" />
          <span>Manajemen Staf & Karyawan</span>
        </h1>
        <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
          Daftarkan atau hapus akun kasir, admin operasional, atau staf gudang per cabang.
        </p>
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

      {/* FORM TAMBAH KARYAWAN */}
      <form
        onSubmit={handleAddStaff}
        className="bg-white p-4 sm:p-6 border border-slate-200/90 rounded-2xl shadow-sm space-y-4"
      >
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <UserPlus className="w-4 h-4 text-blue-600 shrink-0" />
          <h2 className="text-sm font-bold text-slate-900">Tambah Karyawan Baru</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Nama Lengkap *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Budi Santoso"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Email Akses Login *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="budi@duniawarna.com"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Password Awal (Min. 6 Karakter) *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Role / Jabatan *
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition"
            >
              <option value="cashier">Kasir Toko (Cashier)</option>
              <option value="inventory">Staf Gudang (Inventory)</option>
              <option value="admin">Admin Operasional Pusat</option>
            </select>
          </div>

          {role !== 'admin' && (
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Penempatan Cabang Outlet *
              </label>
              <select
                value={selectedOutlet}
                onChange={(e) => setSelectedOutlet(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition"
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
          className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-500 active:scale-[0.99] transition disabled:opacity-50 shadow-md shadow-blue-600/20 inline-flex items-center justify-center gap-1.5"
        >
          {submitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Mendaftarkan...</span>
            </>
          ) : (
            <>
              <UserPlus className="w-3.5 h-3.5" />
              <span>Simpan & Daftarkan Karyawan</span>
            </>
          )}
        </button>
      </form>

      {/* DAFTAR KARYAWAN AKTIF */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between gap-2">
          <span className="font-bold text-xs sm:text-sm text-slate-800">Daftar Karyawan Aktif</span>
          <span className="text-[11px] font-semibold text-slate-400">
            {staffList.length} akun
          </span>
        </div>

        {loading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-16 bg-slate-100 rounded-xl" />
            ))}
          </div>
        ) : staffList.length === 0 ? (
          <div className="text-center py-14 px-4 space-y-1.5">
            <Users className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs sm:text-sm font-semibold text-slate-600">
              Belum ada akun karyawan terdaftar
            </p>
          </div>
        ) : (
          <>
            {/* TAMPILAN MOBILE (< 768px): CARD LIST */}
            <div className="md:hidden divide-y divide-slate-100">
              {staffList.map((staf) => (
                <div key={staf.id} className="p-3.5 min-[375px]:p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                        {staf.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 truncate mt-0.5">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{staf.email}</span>
                      </p>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase shrink-0 ${getRoleBadge(
                        staf.role
                      )}`}
                    >
                      {formatRoleLabel(staf.role)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-slate-500 flex items-center gap-1 min-w-0">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">
                        {staf.outlets?.name || 'Pusat (Semua Cabang)'}
                      </span>
                    </span>

                    {staf.role !== 'owner' ? (
                      <button
                        onClick={() => setConfirmDelete({ id: staf.id, name: staf.name })}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-[11px] font-semibold hover:bg-rose-100 active:scale-95 transition shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Hapus</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic shrink-0">Akun Utama</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* TAMPILAN DESKTOP / TABLET (>= 768px): TABEL */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                    <th className="py-3.5 px-5">Nama</th>
                    <th className="py-3.5 px-5">Email</th>
                    <th className="py-3.5 px-5">Role</th>
                    <th className="py-3.5 px-5">Cabang Penempatan</th>
                    <th className="py-3.5 px-5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                  {staffList.map((staf) => (
                    <tr key={staf.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-5 font-bold text-slate-900 whitespace-nowrap">
                        {staf.name}
                      </td>
                      <td className="py-3.5 px-5 text-slate-500 whitespace-nowrap">{staf.email}</td>
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${getRoleBadge(
                            staf.role
                          )}`}
                        >
                          <Shield className="w-3 h-3" />
                          {formatRoleLabel(staf.role)}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-600 whitespace-nowrap">
                        {staf.outlets?.name || 'Pusat (Semua Cabang)'}
                      </td>
                      <td className="py-3.5 px-5 text-center whitespace-nowrap">
                        {staf.role !== 'owner' ? (
                          <button
                            onClick={() => setConfirmDelete({ id: staf.id, name: staf.name })}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-semibold hover:bg-rose-100 transition"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Hapus</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Owner</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* MODAL KONFIRMASI HAPUS STAF */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 min-[375px]:p-4 z-50">
          <div className="bg-white rounded-2xl p-4 min-[375px]:p-5 sm:p-6 max-w-sm w-full space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900">Hapus Akun Karyawan?</h3>
                <p className="text-xs text-slate-500 mt-1 break-words">
                  Akun akses milik <span className="font-bold text-slate-800">{confirmDelete.name}</span>{' '}
                  akan dicabut dari sistem dan tidak dapat digunakan lagi.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={executeDeleteStaff}
                disabled={deletingId === confirmDelete.id}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-[0.99] text-white rounded-xl text-xs font-semibold transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {deletingId === confirmDelete.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{deletingId === confirmDelete.id ? 'Menghapus...' : 'Ya, Hapus Akun'}</span>
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