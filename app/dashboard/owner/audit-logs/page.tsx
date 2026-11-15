'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ShieldCheck,
  Search,
  RefreshCw,
  Clock,
  UserCheck,
  ShoppingCart,
  FileText,
} from 'lucide-react'

interface AuditLog {
  id: string
  created_at: string
  action: string
  category: 'USER' | 'TRANSACTION' | 'SYSTEM'
  details: string
  actor_name: string
  actor_email: string
  actor_role: string
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<'ALL' | 'USER' | 'TRANSACTION' | 'SYSTEM'>('ALL')

  const fetchLogs = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true)
      else setLoading(true)

      const combinedLogs: AuditLog[] = []

      // 1. Cek jika tabel audit_logs tersedia di database
      const { data: dbLogs, error: dbLogsError } = await supabase
        .from('audit_logs')
        .select('id, created_at, action, details, users(name, email, role)')
        .order('created_at', { ascending: false })
        .limit(50)

      if (!dbLogsError && dbLogs && dbLogs.length > 0) {
        dbLogs.forEach((l: any) => {
          combinedLogs.push({
            id: String(l.id),
            created_at: l.created_at || new Date().toISOString(),
            action: l.action || 'AKTIVITAS_SISTEM',
            category: 'SYSTEM',
            details: l.details || '-',
            actor_name: l.users?.name || 'Sistem',
            actor_email: l.users?.email || '-',
            actor_role: l.users?.role || 'system',
          })
        })
      }

      // 2. Ambil histori pembuatan akun karyawan dari tabel users
      const { data: usersData } = await supabase
        .from('users')
        .select('id, name, email, role, created_at')
        .order('created_at', { ascending: false })
        .limit(30)

      if (usersData) {
        usersData.forEach((u: any, i: number) => {
          combinedLogs.push({
            id: `user-${u.id || i}`,
            created_at: u.created_at || new Date().toISOString(),
            action: 'REGISTRASI_KARYAWAN',
            category: 'USER',
            details: `Pembuatan akun staf baru: ${u.name || 'Tanpa Nama'} (${(u.role || 'staf').toUpperCase()})`,
            actor_name: u.name || 'Admin / Sistem',
            actor_email: u.email || '-',
            actor_role: u.role || '-',
          })
        })
      }

      // 3. Ambil histori aktivitas transaksi penjualan terbaru
      const { data: trxData } = await supabase
        .from('transactions')
        .select('id, receipt_number, total_amount, status, customer_name, created_at, outlets(name)')
        .order('created_at', { ascending: false })
        .limit(30)

      if (trxData) {
        trxData.forEach((t: any) => {
          const isUnpaid = t.status === 'unpaid' || t.status === 'partial'
          combinedLogs.push({
            id: `trx-${t.id}`,
            created_at: t.created_at || new Date().toISOString(),
            action: isUnpaid ? 'TRANSAKSI_PIUTANG' : 'TRANSAKSI_POS',
            category: 'TRANSACTION',
            details: `Nota ${t.receipt_number || t.id.slice(0, 6)} • Rp ${Number(
              t.total_amount || 0
            ).toLocaleString('id-ID')} (${t.outlets?.name || 'Cabang'}) — Pelanggan: ${
              t.customer_name || 'Umum'
            }`,
            actor_name: t.outlets?.name || 'Kasir Cabang',
            actor_email: isUnpaid ? 'Status: Belum Lunas' : 'Status: Lunas',
            actor_role: 'cashier',
          })
        })
      }

      // Urutkan semua log dari yang paling baru
      combinedLogs.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      setLogs(combinedLogs)
    } catch (err) {
      console.error('Gagal mengambil audit logs:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const filteredLogs = logs.filter((item) => {
    const matchesCategory = filterCategory === 'ALL' || item.category === filterCategory
    const q = searchQuery.toLowerCase()
    const matchesQuery =
      item.actor_name.toLowerCase().includes(q) ||
      item.actor_email.toLowerCase().includes(q) ||
      item.action.toLowerCase().includes(q) ||
      item.details.toLowerCase().includes(q)
    return matchesCategory && matchesQuery
  })

  const formatDate = (dateStr: string) => {
    const parsed = new Date(dateStr)
    if (isNaN(parsed.getTime())) return '-'
    return parsed.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getBadgeStyle = (action: string) => {
    if (action.includes('PIUTANG')) {
      return 'bg-amber-50 text-amber-700 border-amber-200'
    }
    if (action.includes('TRANSAKSI')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    }
    return 'bg-blue-50 text-blue-700 border-blue-200'
  }

  return (
    <div className="p-3 min-[375px]:p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 max-w-7xl mx-auto space-y-5 sm:space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg min-[375px]:text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 shrink-0" />
            <span>Audit Trail & Log Aktivitas</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
            Pemantauan riwayat aktivitas operasional dan keamanan seluruh cabang.
          </p>
        </div>

        <button
          onClick={() => fetchLogs(true)}
          disabled={refreshing || loading}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 active:scale-[0.98] border border-slate-200 text-slate-700 text-xs font-semibold px-3.5 py-2 rounded-xl shadow-sm transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh Log</span>
        </button>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama staf, aksi, nomor nota, atau detail..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {(
            [
              { key: 'ALL', label: 'Semua' },
              { key: 'TRANSACTION', label: 'Transaksi' },
              { key: 'USER', label: 'Akun Staf' },
              { key: 'SYSTEM', label: 'Sistem' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterCategory(tab.key)}
              className={`px-3 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap transition ${
                filterCategory === tab.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* CONTAINER LIST / TABLE */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2">
          <span className="font-bold text-xs sm:text-sm text-slate-800">
            Riwayat Aktivitas & Keamanan
          </span>
          <span className="text-[11px] font-semibold text-slate-400">
            {filteredLogs.length} catatan
          </span>
        </div>

        {loading ? (
          <div className="p-6 space-y-3 animate-pulse">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-14 bg-slate-100 rounded-xl" />
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-14 px-4 space-y-1.5">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs sm:text-sm font-semibold text-slate-600">
              Tidak ada aktivitas ditemukan
            </p>
            <p className="text-[11px] text-slate-400">
              Coba ubah kata kunci pencarian atau filter kategori di atas.
            </p>
          </div>
        ) : (
          <>
            {/* TAMPILAN MOBILE (< 768px): CARD LIST TANPA SCROLL HORIZONTAL */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredLogs.map((item) => (
                <div key={item.id} className="p-3.5 min-[375px]:p-4 space-y-2 hover:bg-slate-50/70">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 font-bold rounded-md text-[10px] border ${getBadgeStyle(
                        item.action
                      )}`}
                    >
                      {item.action}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3 shrink-0" />
                      {formatDate(item.created_at)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed break-words">
                    {item.details}
                  </p>

                  <div className="pt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                    {item.category === 'TRANSACTION' ? (
                      <ShoppingCart className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    )}
                    <span className="font-semibold text-slate-800 truncate">{item.actor_name}</span>
                    <span className="text-slate-400 truncate">• {item.actor_email}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* TAMPILAN DESKTOP / TABLET (>= 768px): TABEL PENUH */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                    <th className="py-3.5 px-5">Waktu Kejadian</th>
                    <th className="py-3.5 px-5">Pengguna / Sumber</th>
                    <th className="py-3.5 px-5">Aksi Operasional</th>
                    <th className="py-3.5 px-5">Rincian Aktivitas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredLogs.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-5 text-slate-500 font-mono text-xs whitespace-nowrap">
                        {formatDate(item.created_at)}
                      </td>
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <p className="font-bold text-slate-900 text-xs">{item.actor_name}</p>
                        <p className="text-[11px] text-slate-400">{item.actor_email}</p>
                      </td>
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 font-bold rounded-lg text-[10px] border ${getBadgeStyle(
                            item.action
                          )}`}
                        >
                          {item.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-xs text-slate-600 max-w-md">
                        {item.details}
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
  )
}