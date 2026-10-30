'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import logoMatrixPaint from '@/components/images/logomatrixpaint.jpg'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    try {
      // 1. Validasi autentikasi via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
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

        const role = userData.role?.toLowerCase()

        // 3. Hard Redirect berdasarkan role spesifik
        if (role === 'owner') {
          window.location.href = '/dashboard/owner'
        } else if (role === 'admin') {
          window.location.href = '/dashboard/admin'
        } else if (role === 'cashier') {
          window.location.href = '/pos'
        } else if (role === 'inventory') {
          window.location.href = '/inventory'
        } else {
          throw new Error('Role pengguna tidak valid atau tidak terdaftar.')
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal masuk. Periksa kembali email dan password Anda.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6 lg:p-8 selection:bg-blue-500 selection:text-white">
      
      {/* Container Card Login Responsif */}
      <div className="bg-slate-900/90 border border-slate-800/80 p-6 sm:p-10 rounded-2xl sm:rounded-3xl w-full max-w-md shadow-2xl backdrop-blur-xl relative overflow-hidden transition-all duration-300">
        
        {/* Ambient Radial Glow Latar Belakang */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header Terpusat: Floating Logo & Dynamic Glow */}
        <div className="text-center mb-6 sm:mb-8 relative z-10 flex flex-col items-center">
          
          {/* Container Logo Floating dengan Hover Glow */}
          <div className="relative mb-3.5 group cursor-pointer">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full p-[2px] bg-slate-800 border border-slate-700/80 group-hover:bg-gradient-to-tr group-hover:from-blue-600 group-hover:via-indigo-500 group-hover:to-cyan-400 group-hover:border-transparent group-hover:shadow-[0_0_25px_rgba(37,99,235,0.55)] transition-all duration-300">
              <div className="w-full h-full rounded-full overflow-hidden bg-slate-950">
                <Image
                  src={logoMatrixPaint}
                  alt="MatrixPaint Logo"
                  width={160} // Render scale 2x untuk memastikan ketajaman di layar Retina
                  height={160}
                  quality={100}
                  unoptimized
                  className="w-full h-full object-cover rounded-full group-hover:scale-110 transition-transform duration-300"
                  priority
                />
              </div>
            </div>
          </div>

          {/* Teks Brand Identity */}
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wider">
            MATRIX<span className="text-blue-500">PAINT</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-1 tracking-wide">
            POS & Inventory System
          </p>
        </div>

        {/* Banner Alert Pesan Error */}
        {errorMsg && (
          <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs font-semibold flex items-start gap-2.5 animate-fadeIn">
            <span className="shrink-0 text-sm">⚠️</span>
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* Form Login */}
        <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5 relative z-10">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Email
            </label>
            <input
              type="email"
              required
              placeholder="contoh: admin@matrixpaint.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 sm:py-3.5 bg-slate-950/70 border border-slate-800/90 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 sm:py-3.5 bg-slate-950/70 border border-slate-800/90 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 sm:py-4 mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-sm transition-all duration-200 shadow-lg shadow-blue-600/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Memverifikasi Sesi...</span>
              </>
            ) : (
              <span>Masuk ke Sistem</span>
            )}
          </button>
        </form>

        {/* Footer Link: Credit Matrix Labs */}
        <div className="mt-8 pt-5 border-t border-slate-800/80 text-center relative z-10">
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