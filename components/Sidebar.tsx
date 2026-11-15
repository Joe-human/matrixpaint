'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import logoMatrixPaint from '@/components/images/logomatrixpaint.jpg'
import {
  LayoutDashboard,
  Users,
  Building2,
  PieChart,
  ClipboardList,
  PackageSearch,
  ArrowRightLeft,
  Boxes,
  FileBarChart2,
  ShoppingCart,
  History,
  Receipt,
  RotateCcw,
  Warehouse,
  Send,
  PackageCheck,
  ClipboardCheck,
  LogOut,
  X,
  SlidersHorizontal,
  Store,
  Truck,
  FileText,
  Menu,
  Loader2,
  LucideIcon,
} from 'lucide-react'

interface MenuItem {
  name: string
  path: string
  icon: LucideIcon
}

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'cashier' | 'inventory' | null>(null)
  const [companyName, setCompanyName] = useState<string>('')
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const pathname = usePathname()
  const router = useRouter()

  const fetchCompanyInfo = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return

      const { data: userData } = await supabase
        .from('users')
        .select('company_id, companies(name)')
        .eq('email', session.user.email)
        .single()

      if (userData && userData.companies) {
        setCompanyName((userData.companies as any).name || 'Matrix Merchant')
      }
    } catch (err) {
      console.error('Error fetching company:', err)
    }
  }, [])

  // 1. Deteksi role aktif berdasarkan URL & ambil nama merchant
  useEffect(() => {
    if (pathname.startsWith('/dashboard/owner')) setUserRole('owner')
    else if (pathname.startsWith('/dashboard/admin')) setUserRole('admin')
    else if (pathname.startsWith('/pos')) setUserRole('cashier')
    else if (pathname.startsWith('/inventory')) setUserRole('inventory')

    fetchCompanyInfo()
  }, [pathname, fetchCompanyInfo])

  // Sembunyikan sidebar di halaman publik / auth
  if (pathname === '/login' || pathname === '/register' || pathname === '/') return null

  // Handler Logout Supabase
  const handleLogout = async () => {
    try {
      setLoggingOut(true)
      await supabase.auth.signOut()
      setShowLogoutConfirm(false)
      setIsMobileOpen(false)
      router.replace('/login')
    } finally {
      setLoggingOut(false)
    }
  }

  // Definisi Menu Lengkap + Icon
  const menuByRole: Record<string, MenuItem[]> = {
    owner: [
      { name: 'Executive Dashboard', path: '/dashboard/owner', icon: LayoutDashboard },
      { name: 'Manajemen Staf', path: '/dashboard/owner/staff', icon: Users },
      { name: 'Manajemen Cabang', path: '/dashboard/owner/outlets', icon: Building2 },
      { name: 'Manajemen Supplier', path: '/dashboard/owner/suppliers', icon: Truck },
      { name: 'Purchase Order (PO)', path: '/dashboard/owner/purchase-orders', icon: FileText },
      { name: 'Laporan Finansial', path: '/dashboard/owner/financials', icon: PieChart },
      { name: 'Audit Log Aktivitas', path: '/dashboard/owner/audit-logs', icon: ClipboardList },
    ],
    admin: [
      { name: 'Pusat Operasional', path: '/dashboard/admin', icon: LayoutDashboard },
      { name: 'Katalog Produk Master', path: '/dashboard/admin/products', icon: PackageSearch },
      { name: 'Manajemen Supplier', path: '/dashboard/admin/suppliers', icon: Truck },
      { name: 'Purchase Order (PO)', path: '/dashboard/admin/purchase-orders', icon: FileText },
      { name: 'Transfer Stok Cabang', path: '/dashboard/admin/transfers', icon: ArrowRightLeft },
      { name: 'Manajemen Stok Cabang', path: '/dashboard/admin/stocks', icon: Boxes },
      { name: 'Laporan & Rekap', path: '/dashboard/admin/reports', icon: FileBarChart2 },
    ],
    cashier: [
      { name: 'Terminal Kasir', path: '/pos', icon: ShoppingCart },
      { name: 'Riwayat Transaksi', path: '/pos/history', icon: History },
      { name: 'Rekap Kasir', path: '/pos/shift', icon: Receipt },
      { name: 'Pelunasan Bon', path: '/pos/receivables', icon: RotateCcw },
    ],
    inventory: [
      { name: 'Stok Gudang Cabang', path: '/inventory', icon: Warehouse },
      { name: 'Pengajuan Transfer Stok', path: '/inventory/transfer-request', icon: Send },
      { name: 'Penerimaan Barang Masuk', path: '/inventory/receipts', icon: PackageCheck },
      { name: 'Stock Opname', path: '/inventory/adjustments', icon: ClipboardCheck },
    ],
  }

  const currentMenuItems = userRole ? menuByRole[userRole] || [] : []
  const isPOSTerminal = pathname === '/pos'

  return (
    <>
      {/* ------------------------------------------------------------- */}
      {/* TOMBOL TOGGLE MOBILE                                          */}
      {/* Di /pos diletakkan di kanan atas agar tidak bentrok keranjang */}
      {/* ------------------------------------------------------------- */}
      {isPOSTerminal ? (
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          aria-label="Buka Menu Kasir"
          className="lg:hidden fixed top-3.5 right-3.5 z-30 p-2.5 bg-slate-900/90 text-white border border-slate-700/80 rounded-xl shadow-lg backdrop-blur-md active:scale-95 transition"
        >
          <Menu className="w-4 h-4 text-blue-400" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          aria-label="Buka Menu Sidebar"
          className="lg:hidden fixed bottom-4 left-4 z-30 flex items-center gap-2 px-4 py-2.5 bg-slate-900/95 text-white border border-blue-500/40 rounded-full shadow-xl backdrop-blur-md active:scale-95 transition mb-[env(safe-area-inset-bottom)]"
        >
          <SlidersHorizontal className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold tracking-wide">Menu</span>
        </button>
      )}

      {/* OVERLAY UNTUK TAMPILAN MOBILE */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 transition-opacity"
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* SIDEBAR MAIN CONTAINER (Desktop Hover & Mobile Drawer)        */}
      {/* ------------------------------------------------------------- */}
      <aside
        onMouseEnter={() => setIsCollapsed(false)}
        onMouseLeave={() => setIsCollapsed(true)}
        className={`fixed lg:static top-0 left-0 z-50 h-dvh bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between shrink-0 select-none transition-all duration-300 ease-in-out ${
          isMobileOpen
            ? 'translate-x-0 w-64 max-w-[82vw]'
            : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}`}
      >
        {/* Top + Scrollable Nav */}
        <div className="flex flex-col min-h-0 flex-1">
          {/* Header Brand & Dynamic Merchant Name */}
          <div className="h-20 px-4 border-b border-slate-800/80 flex items-center justify-between shrink-0">
            {!isCollapsed || isMobileOpen ? (
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl overflow-hidden p-[1px] bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-md shadow-blue-500/20 shrink-0">
                  <Image
                    src={logoMatrixPaint}
                    alt="MatrixPaint Logo"
                    width={72}
                    height={72}
                    quality={100}
                    unoptimized
                    className="w-full h-full object-cover rounded-[10px]"
                    priority
                  />
                </div>

                <div className="min-w-0">
                  <h1 className="text-xs font-extrabold text-white tracking-wider uppercase truncate">
                    MATRIX<span className="text-blue-500">PAINT</span>
                  </h1>

                  <div className="flex items-center gap-1 mt-0.5 text-blue-400 font-bold text-xs min-w-0">
                    <Store className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{companyName || 'Memuat...'}</span>
                  </div>

                  <p className="text-[10px] text-slate-500 capitalize truncate">
                    Role: <span className="text-slate-300 font-medium">{userRole || 'Staff'}</span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="w-9 h-9 mx-auto rounded-xl overflow-hidden p-[1px] bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-md shadow-blue-500/20 shrink-0">
                <Image
                  src={logoMatrixPaint}
                  alt="MatrixPaint Logo"
                  width={72}
                  height={72}
                  quality={100}
                  unoptimized
                  className="w-full h-full object-cover rounded-[10px]"
                  priority
                />
              </div>
            )}

            {/* Tombol Close Khusus Mobile */}
            <button
              type="button"
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0"
              aria-label="Tutup Menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* List Menu Navigasi (Scrollable jika layar pendek) */}
          <nav className="p-3 space-y-1.5 mt-1 overflow-y-auto flex-1">
            {(!isCollapsed || isMobileOpen) && userRole && (
              <p className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Menu {userRole.toUpperCase()}
              </p>
            )}

            {currentMenuItems.map((item) => {
              const isActive = pathname === item.path
              const IconComponent = item.icon

              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setIsMobileOpen(false)}
                  title={isCollapsed && !isMobileOpen ? item.name : undefined}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-medium transition-all group ${
                    isCollapsed && !isMobileOpen ? 'lg:justify-center' : ''
                  } ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-lg shadow-blue-600/20'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                  }`}
                >
                  <IconComponent
                    className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-110 ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'
                    }`}
                  />
                  {(!isCollapsed || isMobileOpen) && (
                    <span className="truncate">{item.name}</span>
                  )}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Footer Area: Tombol Keluar (Logout) */}
        <div className="p-3 border-t border-slate-800/80 shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:pb-3">
          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            title={isCollapsed && !isMobileOpen ? 'Keluar / Logout' : undefined}
            className={`w-full py-2.5 bg-slate-900/60 hover:bg-red-500/10 hover:border-red-500/30 text-slate-400 hover:text-red-400 rounded-xl text-xs font-medium border border-slate-800 transition flex items-center justify-center gap-2 group cursor-pointer ${
              isCollapsed && !isMobileOpen ? 'px-0' : 'px-3'
            }`}
          >
            <LogOut className="w-4 h-4 text-slate-400 group-hover:text-red-400 transition shrink-0" />
            {(!isCollapsed || isMobileOpen) && <span>Keluar / Logout</span>}
          </button>
        </div>
      </aside>

      {/* MODAL KONFIRMASI LOGOUT */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-xs w-full space-y-4 shadow-2xl text-white">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
                <LogOut className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Keluar dari Sistem?</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Sesi akun Anda akan diakhiri dan Anda perlu login kembali untuk mengakses dashboard.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {loggingOut && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{loggingOut ? 'Keluar...' : 'Ya, Logout'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                disabled={loggingOut}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}