'use client'

import { useState, useEffect } from 'react'
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
  LucideIcon,
} from 'lucide-react'

interface MenuItem {
  name: string
  path: string
  icon: LucideIcon
}

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(true) // Mode desktop auto-collapse
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'cashier' | 'inventory' | null>(null)
  const [companyName, setCompanyName] = useState<string>('') // Dynamic Company Name
  
  const pathname = usePathname()
  const router = useRouter()

  // 1. Deteksi role aktif berdasarkan URL
  useEffect(() => {
    if (pathname.startsWith('/dashboard/owner')) setUserRole('owner')
    else if (pathname.startsWith('/dashboard/admin')) setUserRole('admin')
    else if (pathname.startsWith('/pos')) setUserRole('cashier')
    else if (pathname.startsWith('/inventory')) setUserRole('inventory')

    fetchCompanyInfo()
  }, [pathname])

  // 2. Fetch Nama Perusahaan / Brand dari Supabase
  const fetchCompanyInfo = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
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
  }

  // Sembunyikan sidebar di halaman login
  if (pathname === '/login') return null

  // Handler Logout Supabase
  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
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

  return (
    <>
      {/* ------------------------------------------------------------- */}
      {/* TOMBOL TOGGLE MOBILE (Floating Pill Button)                   */}
      {/* Disembunyikan khusus di route /pos agar tidak menutupi kasir   */}
      {/* ------------------------------------------------------------- */}
      {!pathname.startsWith('/pos') && (
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          aria-label="Buka Menu Sidebar"
          className="lg:hidden fixed bottom-5 left-5 z-50 flex items-center space-x-2 px-4 py-2.5 bg-slate-900/90 text-white border border-blue-500/40 rounded-full shadow-2xl backdrop-blur-md active:scale-95 transition"
        >
          <SlidersHorizontal className="w-4 h-4 text-blue-400 animate-pulse" />
          <span className="text-xs font-semibold tracking-wide">Menu</span>
        </button>
      )}

      {/* OVERLAY UNTUK TAMPILAN MOBILE */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 transition-opacity"
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* SIDEBAR MAIN CONTAINER (Desktop Hover & Mobile Drawer)        */}
      {/* ------------------------------------------------------------- */}
      <aside
        onMouseEnter={() => setIsCollapsed(false)}
        onMouseLeave={() => setIsCollapsed(true)}
        className={`fixed lg:static top-0 left-0 z-50 h-screen bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between shrink-0 select-none transition-all duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        } ${
          isCollapsed ? 'lg:w-20' : 'lg:w-64'
        }`}
      >
        <div>
          {/* Header Brand & Dynamic Merchant Name */}
          <div className="h-20 px-4 border-b border-slate-800/80 flex items-center justify-between">
            {(!isCollapsed || isMobileOpen) ? (
              <div className="flex items-center space-x-3 truncate">
                
                {/* Logo Image pada Posisi Expanded */}
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

                <div className="truncate">
                  <h1 className="text-xs font-extrabold text-white tracking-wider uppercase">
                    MATRIX<span className="text-blue-500">PAINT</span>
                  </h1>
                  
                  {/* BRAND / NAMA COMPANY DYNAMIC (misal: Dunia Warna) */}
                  <div className="flex items-center space-x-1 mt-0.5 text-blue-400 font-bold text-xs truncate">
                    <Store className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{companyName || 'Loading...'}</span>
                  </div>

                  <p className="text-[10px] text-slate-500 capitalize">
                    Role: <span className="text-slate-300 font-medium">{userRole || 'Staff'}</span>
                  </p>
                </div>
              </div>
            ) : (
              /* Logo Image pada Posisi Collapsed (Ikon Ringkas) */
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
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* List Menu Navigasi */}
          <div className="p-3 space-y-1.5 mt-2">
            {(!isCollapsed || isMobileOpen) && (
              <p className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Menu {userRole?.toUpperCase()}
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
                  className={`flex items-center space-x-3 px-3 py-3 rounded-xl text-xs font-medium transition-all group ${
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
          </div>
        </div>

        {/* Footer Area: Tombol Keluar (Logout) */}
        <div className="p-3 border-t border-slate-800/80">
          <button
            onClick={handleLogout}
            className={`w-full py-2.5 bg-slate-900/60 hover:bg-red-500/10 hover:border-red-500/30 text-slate-400 hover:text-red-400 rounded-xl text-xs font-medium border border-slate-800 transition flex items-center justify-center space-x-2 group ${
              isCollapsed && !isMobileOpen ? 'px-0' : 'px-3'
            }`}
          >
            <LogOut className="w-4 h-4 text-slate-400 group-hover:text-red-400 transition" />
            {(!isCollapsed || isMobileOpen) && <span>Keluar / Logout</span>}
          </button>
        </div>
      </aside>
    </>
  )
}