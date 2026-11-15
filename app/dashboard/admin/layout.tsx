'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ShieldAlert } from 'lucide-react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [status, setStatus] = useState<'checking' | 'authorized' | 'denied'>('checking')

  useEffect(() => {
    let isMounted = true

    const checkAccess = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session?.user?.email) {
          if (isMounted) router.replace('/login')
          return
        }

        const { data: userData, error } = await supabase
          .from('users')
          .select('role')
          .eq('email', session.user.email)
          .single()

        if (error || !userData) {
          if (isMounted) router.replace('/login')
          return
        }

        const role = userData.role?.toLowerCase().trim()

        // HANYA Admin (Owner & role lain diarahkan ke dashboard masing-masing)
        if (role !== 'admin') {
          if (isMounted) setStatus('denied')
          setTimeout(() => {
            if (isMounted) redirectToRoleHome(role, router)
          }, 1200)
        } else {
          if (isMounted) setStatus('authorized')
        }
      } catch {
        if (isMounted) router.replace('/login')
      }
    }

    checkAccess()

    return () => {
      isMounted = false
    }
  }, [router])

  if (status === 'checking') {
    return <LoadingScreen title="Memeriksa Hak Akses Admin..." />
  }

  if (status === 'denied') {
    return <AccessDeniedScreen />
  }

  return <>{children}</>
}

function redirectToRoleHome(role: string | undefined, router: ReturnType<typeof useRouter>) {
  if (role === 'owner') router.replace('/dashboard/owner')
  else if (role === 'cashier' || role === 'kasir') router.replace('/pos')
  else if (role === 'inventory') router.replace('/inventory')
  else router.replace('/login')
}

function LoadingScreen({ title }: { title: string }) {
  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-slate-50 px-4 text-center select-none">
      <div className="w-9 h-9 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
      <p className="text-xs sm:text-sm font-semibold tracking-wide text-slate-600">{title}</p>
    </div>
  )
}

function AccessDeniedScreen() {
  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <div className="bg-white border border-rose-200 rounded-2xl p-6 max-w-xs w-full shadow-sm space-y-2.5">
        <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-sm font-bold text-slate-900">Akses Ditolak</h2>
        <p className="text-xs text-slate-500">
          Area ini khusus untuk Admin Pusat. Mengalihkan ke halaman utama Anda...
        </p>
      </div>
    </div>
  )
}