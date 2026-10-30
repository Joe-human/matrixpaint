'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface AuditLog {
  id: string
  created_at: string
  action: string
  details: string
  users?: { name: string; role: string; email: string }
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      // Mengambil histori aktivitas dari tabel audit_logs atau simulasi dari transaksi & user
      const { data: usersData } = await supabase
        .from('users')
        .select('name, email, role, created_at')
        .order('created_at', { ascending: false })

      if (usersData) {
        const mockLogs: AuditLog[] = usersData.map((u, i) => ({
          id: `log-${i}`,
          created_at: u.created_at,
          action: 'REGISTRASI_KARYAWAN',
          details: `Pembuatan akun karyawan baru: ${u.name} (${u.role})`,
          users: { name: u.name, role: u.role, email: u.email }
        }))
        setLogs(mockLogs)
      }
    } catch (err) {
      console.error('Gagal mengambil audit logs:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Audit Trail & Log Aktivitas Sistem</h1>
        <p className="text-xs text-slate-500 mt-1">Pemantauan riwayat aktivitas sensitif yang dilakukan oleh Admin dan Staf.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-800">
          Riwayat Aktivitas & Keamanan
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Memuat log aktivitas...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                  <th className="py-3.5 px-4 sm:px-6">Waktu Kejadian</th>
                  <th className="py-3.5 px-4 sm:px-6">Pengguna</th>
                  <th className="py-3.5 px-4 sm:px-6">Aksi Operasional</th>
                  <th className="py-3.5 px-4 sm:px-6">Rincian Aktivitas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-slate-400">Belum ada riwayat aktivitas tercatat.</td>
                  </tr>
                ) : (
                  logs.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-3.5 px-4 sm:px-6 text-slate-500 font-mono text-xs whitespace-nowrap">
                        {new Date(item.created_at).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">
                        <p className="font-bold text-slate-900">{item.users?.name || 'Sistem'}</p>
                        <p className="text-[10px] text-slate-400">{item.users?.email || '-'}</p>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-bold rounded-lg text-[10px] border border-blue-200">
                          {item.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-slate-600">{item.details}</td>
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