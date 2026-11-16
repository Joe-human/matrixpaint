'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function POSLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    let isMounted = true

    const checkAccess = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          if (isMounted) router.replace('/login')
          return
        }

        const { data: userData, error } = await supabase
          .from('users')
          .select('role')
          .eq('email', session.user.email)
          .single()

        if (!isMounted) return

        if (error || !userData) {
          router.replace('/login')
          return
        }

        const role = userData.role?.toLowerCase()

        if (role !== 'cashier') {
          if (role === 'owner') router.replace('/dashboard/owner')
          else if (role === 'admin') router.replace('/dashboard/admin')
          else if (role === 'inventory') router.replace('/inventory')
          else router.replace('/login')
          return
        }

        setAuthorized(true)
      } catch {
        if (isMounted) router.replace('/login')
      }
    }

    checkAccess()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && isMounted) {
        setAuthorized(false)
        router.replace('/login')
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [router])

  if (!authorized) {
    return <LoadingScreen title="Menyiapkan Terminal POS..." />
  }

  return <>{children}</>
}

function LoadingScreen({ title }: { title: string }) {
  return (
    <div className="min-h-dvh w-full flex flex-col items-center justify-center bg-slate-50 text-slate-800 font-sans space-y-3 px-4">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-xs font-semibold tracking-wide text-slate-500 text-center">{title}</p>
    </div>
  )
}