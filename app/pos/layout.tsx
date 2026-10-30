'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function POSLayout({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        window.location.href = '/login'
        return
      }

      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('email', session.user.email)
        .single()

      const role = userData?.role?.toLowerCase()

      // HANYA Kasir (Owner dilarang masuk ke sini)
      if (role !== 'cashier') {
        alert('Akses Ditolak! Terminal Kasir khusus untuk Staff Kasir.')
        redirectToRoleHome(role)
      } else {
        setAuthorized(true)
      }
    }

    checkAccess()
  }, [])

  if (!authorized) {
    return <LoadingScreen title="Menyiapkan Terminal POS..." />
  }

  return <>{children}</>
}

function redirectToRoleHome(role?: string) {
  if (role === 'owner') window.location.href = '/dashboard/owner'
  else if (role === 'admin') window.location.href = '/dashboard/admin'
  else if (role === 'inventory') window.location.href = '/inventory'
  else window.location.href = '/login'
}

function LoadingScreen({ title }: { title: string }) {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-white font-sans space-y-3">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-xs font-semibold tracking-wide text-slate-400">{title}</p>
    </div>
  )
}