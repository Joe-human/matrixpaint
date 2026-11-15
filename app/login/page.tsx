'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import logoMatrixPaint from '@/components/images/logomatrixpaint.jpg'
import { Eye, EyeOff, AlertCircle, Loader2, LogIn } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  const redirectByRole = (role?: string) => {
    const normalized = role?.toLowerCase()
    if (normalized === 'owner') {
      router.replace('/dashboard/owner')
    } else if (normalized === 'admin') {
      router.replace('/dashboard/admin')
    } else if (normalized === 'cashier') {
      router.replace('/pos')
    } else if (normalized === 'inventory') {
      router.replace('/inventory')
    } else {
      throw new Error('Role pengguna tidak valid atau tidak terdaftar.')
    }
  }

  // Cek jika sesi sudah aktif agar otomatis diarahkan sesuai role
  useEffect(() => {
    let isMounted = true

    const checkExistingSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session?.user?.email) {
          const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('email', session.user.email)
            .single()

          if (isMounted && userData?.role) {
            redirectByRole(userData.role)
            return
          }
        }
      } catch {
        // Biarkan tetap di halaman login jika sesi tidak valid
      } finally {
        if (isMounted) setCheckingSession(false)
      }
    }

    checkExistingSession()

    return () => {
      isMounted = false
    }
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    try {
      // 1. Validasi autentikasi via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (authError) throw authError

      if (authData.user) {
        // 2. Ambil role dari tabel public.users
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('email', authData.user.email)
          .single()

        if (userError || !userData) {
          throw new Error('Profil pengguna tidak ditemukan di database.')
        }

        // 3. Redirect berdasarkan role spesifik
        redirectByRole(userData.role)
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal masuk. Periksa kembali email dan password Anda.')
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-dvh bg-slate-950 flex flex-col items-center justify-center p-4 space-y-3">
        <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
        <p className="text-xs font-medium text-slate-400">Memeriksa sesi aktif...</p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-slate-950 flex items-center justify-center p-3.5 min-[375px]:p-5 sm:p-6 lg:p-8 selection:bg-blue-500 selection:text-white">
      {/* Container Card Login Responsif */}
      <div className="bg-slate-900/90 border border-slate-800/80 p-5 min-[375px]:p-6 sm:p-10 rounded-2xl sm:rounded-3xl w-full max-w-md shadow-2xl backdrop-blur-xl relative overflow-hidden transition-all duration-300">
        {/* Ambient Radial Glow Latar Belakang */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header Terpusat: Floating Logo & Dynamic Glow */}
        <div className="text-center mb-6 sm:mb-8 relative z-10 flex flex-col items-center">
          <div className="relative mb-3.5 group">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full p-[2px] bg-slate-800 border border-slate-700/80 group-hover:bg-gradient-to-tr group-hover:from-blue-600 group-hover:via-indigo-500 group-hover:to-cyan-400 group-hover:border-transparent group-hover:shadow-[0_0_25px_rgba(37,99,235,0.55)] transition-all duration-300">
              <div className="w-full h-full rounded-full overflow-hidden bg-slate-950">
                <Image
                  src={logoMatrixPaint}
                  alt="MatrixPaint Logo"
                  width={160}
                  height={160}
                  quality={100}
                  unoptimized
                  className="w-full h-full object-cover rounded-full group-hover:scale-110 transition-transform duration-300"
                  priority
                />
              </div>
            </div>
          </div>

          <h1 className="text-xl min-[375px]:text-2xl sm:text-3xl font-black text-white tracking-wider">
            MATRIX<span className="text-blue-500">PAINT</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-400 font-medium mt-1 tracking-wide">
            POS &amp; Inventory System
          </p>
        </div>

        {/* Banner Alert Pesan Error */}
        {errorMsg && (
          <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs font-medium flex items-start gap-2.5 relative z-10">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed break-words">{errorMsg}</span>
          </div>
        )}

        {/* Form Login */}
        <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5 relative z-10">
          <div>
            <label
              htmlFor="login-email"
              className="block text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5"
            >
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              placeholder="contoh: admin@matrixpaint.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 sm:px-4 py-3 sm:py-3.5 bg-slate-950/70 border border-slate-800/90 rounded-xl text-xs sm:text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-3.5 sm:pl-4 pr-11 py-3 sm:py-3.5 bg-slate-950/70 border border-slate-800/90 rounded-xl text-xs sm:text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 transition"
                aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 sm:py-4 mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs sm:text-sm transition-all duration-200 shadow-lg shadow-blue-600/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memverifikasi Sesi...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Masuk ke Sistem</span>
              </>
            )}
          </button>
        </form>

        {/* Footer Link: Credit Matrix Labs */}
        <div className="mt-7 sm:mt-8 pt-5 border-t border-slate-800/80 text-center relative z-10">
          <p className="text-[11px] text-slate-500 font-medium tracking-wide">
            Powered by{' '}
            <Link
              href="https://www.instagram.com/matrixlabs.id/?utm_source=ig_web_button_share_sheet"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 font-semibold underline decoration-blue-500/40 hover:decoration-blue-400 transition-all duration-200"
            >
              Matrix Labs
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}