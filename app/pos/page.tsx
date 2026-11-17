'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Printer,
  Loader2,
  X,
  UserCheck,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Trash2,
  MapPin,
  Banknote,
  QrCode,
  CreditCard,
  FileText,
  Package,
  Fuel,
  PackageOpen,
  ArrowRight,
  Tag,
  Clock,
  History,
  Vault,
  Lock,
} from 'lucide-react'

interface ProductItem {
  id: string
  sku: string
  name: string
  brand: string
  category?: string
  price: number
  stock: number
  unit: string
}

interface CartItem extends ProductItem {
  qty: number
}

interface ActiveShift {
  id: string
  start_time: string
  initial_cash: number
  status: string
}

const EXPENSE_CATEGORIES = [
  'Bensin / Transportasi',
  'Plastik & Packing',
  'Konsumsi / Air Galon',
  'Parkir & Retribusi',
  'Operasional Lainnya',
]

export default function POSPage() {
  const [products, setProducts] = useState<ProductItem[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeShift, setActiveShift] = useState<ActiveShift | null>(null)
  const [cashierInfo, setCashierInfo] = useState<{
    id: string
    name: string
    outletId: string
    outletName: string
    companyId: string
  } | null>(null)

  // State Drawer Mobile & Feedback Banner
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  )

  // State Modal Kas Keluar / Operasional
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
  const [expenseCategory, setExpenseCategory] = useState('Bensin / Transportasi')
  const [expenseDescription, setExpenseDescription] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [savingExpense, setSavingExpense] = useState(false)

  // State Modal Bongkar Kemasan (Konversi Kaleng/Pail -> Kg/Liter Eceran)
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false)
  const [sourceProductId, setSourceProductId] = useState('')
  const [targetProductId, setTargetProductId] = useState('')
  const [convertQtySource, setConvertQtySource] = useState('1')
  const [convertYieldPerUnit, setConvertYieldPerUnit] = useState('5')
  const [convertingStock, setConvertingStock] = useState(false)

  // State Diskon Nominal Manual & Payment
  const [discountInput, setDiscountInput] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris' | 'transfer' | 'piutang'>('cash')
  const [cashGiven, setCashGiven] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [processing, setProcessing] = useState(false)

  // Modal Cetak Struk
  const [completedTx, setCompletedTx] = useState<any>(null)

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev))
    }, 4500)
  }

  const initPOS = useCallback(async () => {
    try {
      setLoading(true)
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return

      const { data: userData, error: userErr } = await supabase
        .from('users')
        .select('id, name, outlet_id, company_id, outlets(name)')
        .eq('email', session.user.email)
        .single()

      if (userErr || !userData) {
        console.error('Gagal memuat profil kasir:', userErr)
        return
      }

      const currentOutletId = userData.outlet_id
      setCashierInfo({
        id: userData.id,
        name: userData.name || 'Kasir',
        outletId: currentOutletId || '',
        outletName: (userData.outlets as any)?.name || 'Cabang Store',
        companyId: userData.company_id,
      })

      // 1. Cek Shift Aktif cabang ini
      if (currentOutletId) {
        const { data: shiftData, error: shiftErr } = await supabase
          .from('cashier_shifts')
          .select('id, start_time, initial_cash, status')
          .eq('outlet_id', currentOutletId)
          .eq('status', 'open')
          .order('start_time', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (shiftErr) {
          console.error('Gagal cek shift aktif:', shiftErr)
        }
        setActiveShift(shiftData || null)
      }

      // 2. Ambil daftar produk & stok cabang
      let formattedProducts: ProductItem[] = []

      if (currentOutletId) {
        const { data: stocksData, error: stockErr } = await supabase
          .from('outlet_stocks')
          .select('stock, products(id, sku, name, brand, price, unit)')
          .eq('outlet_id', currentOutletId)

        if (stockErr) {
          console.error('Gagal query outlet_stocks:', stockErr)
        } else if (stocksData && stocksData.length > 0) {
          formattedProducts = stocksData
            .filter((item: any) => item.products !== null)
            .map((item: any) => ({
              id: item.products.id,
              sku: item.products.sku || '-',
              name: item.products.name,
              brand: item.products.brand || '-',
              price: Number(item.products.price || 0),
              stock: Number(item.stock || 0),
              unit: item.products.unit || 'pcs',
            }))
        }
      }

      // Fallback: jika outlet_stocks belum terisi untuk cabang ini, tampilkan katalog master company
      if (formattedProducts.length === 0 && userData.company_id) {
        const { data: masterProducts, error: prodErr } = await supabase
          .from('products')
          .select('id, sku, name, brand, price, unit')
          .eq('company_id', userData.company_id)

        if (!prodErr && masterProducts) {
          formattedProducts = masterProducts.map((p: any) => ({
            id: p.id,
            sku: p.sku || '-',
            name: p.name,
            brand: p.brand || '-',
            price: Number(p.price || 0),
            stock: 0,
            unit: p.unit || 'pcs',
          }))
        }
      }

      formattedProducts.sort((a, b) => a.name.localeCompare(b.name))
      setProducts(formattedProducts)
    } catch (err) {
      console.error('Gagal memuat terminal POS:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    initPOS()
  }, [initPOS])

  const addToCart = (product: ProductItem) => {
    if (!activeShift) {
      showFeedback('error', 'Kasir terkunci! Buka shift terlebih dahulu sebelum input transaksi.')
      return
    }
    if (product.stock <= 0) {
      showFeedback('error', `Stok "${product.name}" sedang habis (0 ${product.unit})!`)
      return
    }
    const defaultStep = product.stock < 1 ? Number(product.stock.toFixed(3)) : 1

    setCart((prev) => {
      const exist = prev.find((item) => item.id === product.id)
      if (exist) {
        const nextQty = Number((exist.qty + 1).toFixed(3))
        if (nextQty > product.stock) {
          showFeedback(
            'error',
            `Maksimal stok "${product.name}" hanya ${product.stock} ${product.unit}.`
          )
          return prev
        }
        return prev.map((item) => (item.id === product.id ? { ...item, qty: nextQty } : item))
      }
      return [...prev, { ...product, qty: defaultStep }]
    })
  }

  const updateCartQty = (id: string, rawQty: number) => {
    if (Number.isNaN(rawQty) || rawQty <= 0) {
      setCart((prev) => {
        const next = prev.filter((item) => item.id !== id)
        if (next.length === 0) setDiscountInput('')
        return next
      })
      return
    }
    const cleanQty = Number(rawQty.toFixed(3))
    const targetProd = products.find((p) => p.id === id)
    if (targetProd && cleanQty > targetProd.stock) {
      showFeedback(
        'error',
        `Jumlah melebihi sisa stok (${targetProd.stock} ${targetProd.unit}).`
      )
      return
    }
    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, qty: cleanQty } : item))
    )
  }

  const resetCart = () => {
    setCart([])
    setDiscountInput('')
    setCashGiven('')
  }

  // SIMPAN PENGELUARAN OPERASIONAL (BENSIN, PARKIR, PLASTIK, DLL)
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cashierInfo) {
      showFeedback('error', 'Sesi kasir tidak valid.')
      return
    }

    const numericAmount = Number(expenseAmount) || 0
    if (numericAmount <= 0 || !expenseDescription.trim()) {
      showFeedback('error', 'Keterangan dan nominal pengeluaran wajib diisi.')
      return
    }

    setSavingExpense(true)
    try {
      const { error } = await supabase.from('operational_expenses').insert([
        {
          company_id: cashierInfo.companyId,
          outlet_id: cashierInfo.outletId,
          shift_id: activeShift?.id || null,
          cashier_id: cashierInfo.id,
          category: expenseCategory,
          description: expenseDescription.trim(),
          amount: numericAmount,
        },
      ])

      if (error) throw error

      showFeedback(
        'success',
        `Kas keluar "${expenseDescription.trim()}" (Rp ${numericAmount.toLocaleString('id-ID')}) tercatat!`
      )
      setExpenseDescription('')
      setExpenseAmount('')
      setIsExpenseModalOpen(false)
    } catch (err: any) {
      showFeedback('error', `Gagal mencatat pengeluaran: ${err.message}`)
    } finally {
      setSavingExpense(false)
    }
  }

  // KONVERSI / BONGKAR KEMASAN (MISAL 1 KALENG -> 5 KG / LITER ECERAN)
  const handleConvertStock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cashierInfo) return

    const sourceProd = products.find((p) => p.id === sourceProductId)
    const targetProd = products.find((p) => p.id === targetProductId)
    const qtyOpen = Number(convertQtySource) || 0
    const yieldEach = Number(convertYieldPerUnit) || 0

    if (!sourceProd || !targetProd) {
      showFeedback('error', 'Pilih produk kemasan asal dan produk eceran tujuan.')
      return
    }
    if (sourceProd.id === targetProd.id) {
      showFeedback('error', 'Produk kemasan asal dan produk eceran tujuan tidak boleh sama.')
      return
    }
    if (qtyOpen <= 0 || yieldEach <= 0) {
      showFeedback('error', 'Jumlah kemasan dibuka dan isi per kemasan harus lebih dari 0.')
      return
    }
    if (qtyOpen > sourceProd.stock) {
      showFeedback(
        'error',
        `Stok "${sourceProd.name}" tidak cukup (tersisa ${sourceProd.stock} ${sourceProd.unit}).`
      )
      return
    }

    setConvertingStock(true)
    try {
      const addedEceran = Number((qtyOpen * yieldEach).toFixed(3))
      const newSourceStock = Number((sourceProd.stock - qtyOpen).toFixed(3))
      const newTargetStock = Number((targetProd.stock + addedEceran).toFixed(3))

      const { error: errSource } = await supabase
        .from('outlet_stocks')
        .update({ stock: newSourceStock })
        .eq('outlet_id', cashierInfo.outletId)
        .eq('product_id', sourceProd.id)

      if (errSource) throw errSource

      const { error: errTarget } = await supabase
        .from('outlet_stocks')
        .update({ stock: newTargetStock })
        .eq('outlet_id', cashierInfo.outletId)
        .eq('product_id', targetProd.id)

      if (errTarget) throw errTarget

      showFeedback(
        'success',
        `Berhasil bongkar ${qtyOpen} ${sourceProd.unit} "${sourceProd.name}" menjadi +${addedEceran} ${targetProd.unit} "${targetProd.name}".`
      )
      setIsConvertModalOpen(false)
      setSourceProductId('')
      setTargetProductId('')
      setConvertQtySource('1')
      setConvertYieldPerUnit('5')
      await initPOS()
    } catch (err: any) {
      showFeedback('error', `Gagal bongkar kemasan: ${err.message}`)
    } finally {
      setConvertingStock(false)
    }
  }

  // Perhitungan Subtotal, Diskon Nominal, dan Total Akhir
  const subtotalAmount = Math.round(
    cart.reduce((sum, item) => sum + item.price * item.qty, 0)
  )
  const rawDiscount = Math.max(0, Math.round(Number(discountInput) || 0))
  const discountAmount = Math.min(rawDiscount, subtotalAmount)
  const totalAmount = Math.max(0, subtotalAmount - discountAmount)

  const totalItemsCount = cart.length
  const cashValue = Number(cashGiven) || 0
  const changePreview = cashValue - totalAmount

  const handleCheckout = async () => {
    if (!cashierInfo) {
      showFeedback('error', 'Sesi kasir tidak valid. Silakan login ulang.')
      return
    }
    if (!activeShift) {
      showFeedback('error', 'Shift kasir belum dibuka! Silakan buka shift terlebih dahulu.')
      return
    }
    if (cart.length === 0) {
      showFeedback('error', 'Keranjang belanja masih kosong!')
      return
    }
    if (rawDiscount > subtotalAmount) {
      showFeedback('error', 'Nominal diskon tidak boleh melebihi subtotal belanja!')
      return
    }
    if (paymentMethod === 'cash' && cashValue < totalAmount) {
      showFeedback('error', 'Uang tunai yang diterima masih kurang dari total tagihan!')
      return
    }
    if (paymentMethod === 'piutang' && !customerName.trim()) {
      showFeedback('error', 'Nama pelanggan wajib diisi untuk transaksi Bon / Piutang!')
      return
    }

    setProcessing(true)
    try {
      const invoiceNo = `INV-${Date.now().toString().slice(-8)}`
      const changeAmount = paymentMethod === 'cash' ? Math.max(0, cashValue - totalAmount) : 0
      const isUnpaid = paymentMethod === 'piutang'

      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .insert([
          {
            company_id: cashierInfo.companyId,
            outlet_id: cashierInfo.outletId,
            cashier_id: cashierInfo.id,
            invoice_no: invoiceNo,
            subtotal_amount: subtotalAmount,
            discount_amount: discountAmount,
            total_amount: totalAmount,
            payment_method: paymentMethod,
            payment_status: isUnpaid ? 'unpaid' : 'paid',
            customer_name: customerName.trim() || 'Pelanggan Umum',
            customer_phone: customerPhone.trim() || null,
          },
        ])
        .select()
        .single()

      if (txError) throw new Error(`Gagal transaksi: ${txError.message}`)

      const itemsPayload = cart.map((item) => ({
        transaction_id: txData.id,
        product_id: item.id,
        qty: item.qty,
        price: item.price,
        subtotal: Math.round(item.price * item.qty),
      }))

      const { error: itemError } = await supabase
        .from('transaction_items')
        .insert(itemsPayload)

      if (itemError) throw new Error(`Gagal simpan barang: ${itemError.message}`)

      for (const item of cart) {
        const { error: rpcError } = await supabase.rpc('decrement_stock', {
          p_outlet_id: cashierInfo.outletId,
          p_product_id: item.id,
          p_qty: item.qty,
        })

        if (rpcError) {
          const newStock = Math.max(0, Number((item.stock - item.qty).toFixed(3)))
          await supabase
            .from('outlet_stocks')
            .update({ stock: newStock })
            .eq('outlet_id', cashierInfo.outletId)
            .eq('product_id', item.id)
        }
      }

      setCompletedTx({
        invoice_number: invoiceNo,
        created_at: new Date().toLocaleString('id-ID'),
        payment_method: paymentMethod.toUpperCase(),
        payment_status: isUnpaid ? 'BELUM LUNAS (BON)' : 'LUNAS',
        cash_given: cashValue,
        change_amount: changeAmount,
        customer_name: customerName.trim() || 'Pelanggan Umum',
        items: [...cart],
        subtotal: subtotalAmount,
        discount: discountAmount,
        total: totalAmount,
        cashier: cashierInfo.name,
        outlet: cashierInfo.outletName,
      })

      setCart([])
      setDiscountInput('')
      setCashGiven('')
      setCustomerName('')
      setCustomerPhone('')
      setIsMobileCartOpen(false)
      await initPOS()
    } catch (err: any) {
      showFeedback('error', err.message || 'Terjadi kesalahan sistem saat memproses transaksi.')
    } finally {
      setProcessing(false)
    }
  }

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.brand.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedSourceProd = products.find((p) => p.id === sourceProductId)
  const selectedTargetProd = products.find((p) => p.id === targetProductId)

  return (
    <div className="relative flex flex-col lg:flex-row h-dvh bg-slate-50 text-slate-900 overflow-hidden select-none">
      {/* ------------------------------------------------------------- */}
      {/* KATALOG PRODUK (KIRI / FULLSCREEN DI MOBILE)                  */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 p-3 min-[375px]:p-4 sm:p-6 overflow-y-auto pb-28 lg:pb-6 space-y-4">
        {/* Top Header */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 bg-white border border-slate-200/90 p-3.5 min-[375px]:p-4 rounded-2xl shadow-sm">
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-black tracking-wide text-slate-900 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0" />
              <span>TERMINAL KASIR POS</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span>
                Kasir: <strong className="text-slate-800">{cashierInfo?.name || '...'}</strong>
              </span>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center gap-1 font-semibold text-blue-600">
                <MapPin className="w-3 h-3 shrink-0" />
                <span>{cashierInfo?.outletName || '...'}</span>
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
            <Link
              href="/pos/shift"
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition inline-flex items-center justify-center gap-1.5 shrink-0 ${
                activeShift
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
              }`}
            >
              {activeShift ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Shift Aktif</span>
                </>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5" />
                  <span>Shift Tutup (Klik Buka Shift)</span>
                </>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setIsConvertModalOpen(true)}
              disabled={!activeShift}
              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-bold transition inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              title="Buka cat kaleng/pail menjadi stok kiloan/literan eceran"
            >
              <PackageOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span>Bongkar Kemasan</span>
            </button>

            <button
              type="button"
              onClick={() => setIsExpenseModalOpen(true)}
              disabled={!activeShift}
              className="px-3 py-2 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Fuel className="w-3.5 h-3.5 text-amber-600" />
              <span>Kas Keluar</span>
            </button>

            <Link
              href="/pos/history"
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition inline-flex items-center justify-center gap-1.5 shrink-0"
            >
              <History className="w-3.5 h-3.5" />
              <span>Riwayat</span>
            </Link>

            <Link
              href="/pos/shift"
              className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition inline-flex items-center justify-center gap-1.5 shrink-0"
            >
              <Vault className="w-3.5 h-3.5" />
              <span>Kelola Shift</span>
            </Link>
          </div>
        </div>

        {/* Banner Peringatan Jika Belum Buka Shift */}
        {!loading && !activeShift && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-100 text-rose-600 rounded-xl shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-rose-800">
                  Kasir Terkunci — Belum Ada Shift Aktif
                </h3>
                <p className="text-[11px] sm:text-xs text-rose-600 mt-0.5">
                  Buka shift terlebih dahulu dan masukkan modal awal laci kasir agar semua transaksi tercatat rapi.
                </p>
              </div>
            </div>
            <Link
              href="/pos/shift"
              className="w-full sm:w-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold text-center transition shrink-0"
            >
              Buka Shift Sekarang
            </Link>
          </div>
        )}

        {/* Search Bar */}
        <div className="bg-white border border-slate-200/90 p-3.5 rounded-2xl shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama produk, merek, atau scan / ketik kode SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label="Hapus pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <span className="text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-2 rounded-xl text-center shrink-0">
            Total Produk: {filteredProducts.length}
          </span>
        </div>

        {/* Feedback Banner */}
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

        {/* Grid Produk */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3 animate-pulse">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <div key={n} className="h-32 bg-white border border-slate-200/80 rounded-2xl p-3" />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white border border-slate-200/90 rounded-2xl py-16 px-4 text-center space-y-1.5">
            <Package className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs sm:text-sm font-semibold text-slate-600">
              Produk tidak ditemukan
            </p>
            <p className="text-[11px] text-slate-400">
              Pastikan produk sudah ditambahkan ke stok cabang {cashierInfo?.outletName || 'ini'}.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
            {filteredProducts.map((p) => {
              const inCart = cart.find((item) => item.id === p.id)
              return (
                <div
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className={`relative bg-white border p-3 sm:p-3.5 rounded-2xl transition cursor-pointer flex flex-col justify-between group active:scale-[0.98] shadow-xs ${
                    p.stock > 0 && activeShift
                      ? inCart
                        ? 'border-blue-500 ring-1 ring-blue-500/20'
                        : 'border-slate-200/90 hover:border-blue-400 hover:shadow-md'
                      : 'border-slate-200/60 opacity-50 cursor-not-allowed bg-slate-100/60'
                  }`}
                >
                  {inCart && (
                    <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
                      {inCart.qty} {p.unit}
                    </span>
                  )}

                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[9px] sm:text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200/80 truncate">
                        {p.sku}
                      </span>
                      <span className="text-[9px] text-slate-400 truncate max-w-[80px]">
                        {p.brand}
                      </span>
                    </div>
                    <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition mt-2 line-clamp-2 leading-snug">
                      {p.name}
                    </h3>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center gap-1">
                    <div className="truncate">
                      <span className="text-xs font-black text-blue-600">
                        Rp {p.price.toLocaleString('id-ID')}
                      </span>
                      <span className="text-[10px] text-slate-400">/{p.unit}</span>
                    </div>
                    <span
                      className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                        p.stock > 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                          : 'bg-rose-50 text-rose-700 border border-rose-200/80'
                      }`}
                    >
                      Stok: {p.stock}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* FLOATING STICKY BAR DI MOBILE (Trigger Bottom Sheet Drawer)   */}
      {/* ------------------------------------------------------------- */}
      <div className="lg:hidden fixed bottom-3 inset-x-3 z-30 pb-[env(safe-area-inset-bottom)]">
        <button
          onClick={() => setIsMobileCartOpen(true)}
          className="w-full p-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-xl shadow-blue-600/25 flex items-center justify-between text-white active:scale-[0.98] transition"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative bg-white/20 p-2 rounded-xl shrink-0">
              <ShoppingCart className="w-5 h-5 text-white" />
              {totalItemsCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                  {totalItemsCount}
                </span>
              )}
            </div>
            <div className="text-left min-w-0">
              <p className="text-[10px] uppercase font-bold text-blue-100">Total Belanja</p>
              <p className="text-sm font-black truncate">
                Rp {totalAmount.toLocaleString('id-ID')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 font-bold text-xs bg-white/15 px-3 py-1.5 rounded-xl shrink-0">
            <span>Keranjang</span>
            <ChevronUp className="w-4 h-4" />
          </div>
        </button>
      </div>

      {/* BACKDROP MOBILE DRAWER */}
      {isMobileCartOpen && (
        <div
          onClick={() => setIsMobileCartOpen(false)}
          className="lg:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-30"
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* PANEL KERANJANG (Desktop: Side Panel 96 | Mobile: Bottom Sheet) */}
      {/* ------------------------------------------------------------- */}
      <div
        className={`fixed lg:static inset-x-0 bottom-0 z-40 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col justify-between p-4 sm:p-5 shadow-2xl lg:shadow-none transition-transform duration-300 ease-in-out pb-[calc(1rem+env(safe-area-inset-bottom))] lg:pb-5 ${
          isMobileCartOpen
            ? 'translate-y-0 max-h-[90dvh] rounded-t-3xl'
            : 'translate-y-full lg:translate-y-0'
        } lg:w-96 lg:h-full`}
      >
        {/* Header & List Items */}
        <div className="flex flex-col min-h-0 flex-1">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-blue-600" />
              <span>Item Pesanan ({cart.length})</span>
            </h2>
            <div className="flex items-center gap-1.5">
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={resetCart}
                  className="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition inline-flex items-center gap-1"
                  title="Kosongkan Keranjang"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsMobileCartOpen(false)}
                className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 bg-slate-100 rounded-lg"
                aria-label="Tutup keranjang"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List Items (Mendukung Input Desimal kg / liter) */}
          <div className="space-y-2 mt-3 overflow-y-auto pr-1 flex-1 min-h-[100px]">
            {cart.length === 0 ? (
              <div className="text-center py-10 space-y-1">
                <ShoppingCart className="w-7 h-7 text-slate-300 mx-auto" />
                <p className="text-xs font-medium text-slate-500">Keranjang belanja kosong</p>
                <p className="text-[11px] text-slate-400">
                  Klik produk di katalog untuk menambahkan
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 text-xs"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 truncate">{item.name}</p>
                      <p className="text-slate-500 text-[10px]">
                        Rp {item.price.toLocaleString('id-ID')} / {item.unit}
                      </p>
                    </div>
                    <span className="font-extrabold text-blue-600 text-right shrink-0">
                      Rp {Math.round(item.qty * item.price).toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    {['kg', 'liter', 'meter'].includes(item.unit.toLowerCase()) ? (
                      <div className="flex items-center gap-1">
                        {[0.25, 0.5, 1].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => updateCartQty(item.id, preset)}
                            className="px-1.5 py-0.5 text-[10px] font-semibold bg-white border border-slate-200 rounded hover:border-blue-400 text-slate-600"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 uppercase">{item.unit}</span>
                    )}

                    <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden ml-auto">
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.id, Number((item.qty - 1).toFixed(3)))}
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                        aria-label="Kurangi"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={item.qty}
                        onChange={(e) => updateCartQty(item.id, parseFloat(e.target.value))}
                        className="w-14 text-center text-xs font-bold text-slate-900 focus:outline-none bg-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.id, Number((item.qty + 1).toFixed(3)))}
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                        aria-label="Tambah"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Form Diskon & Pembayaran */}
        <div className="border-t border-slate-200 pt-3 space-y-2.5 mt-3 shrink-0">
          {/* Input Diskon Nominal Manual */}
          {cart.length > 0 && (
            <div className="bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1">
                  <Tag className="w-3 h-3 text-emerald-600" />
                  <span>Potongan / Diskon (Rp)</span>
                </label>
                {discountAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => setDiscountInput('')}
                    className="text-[10px] font-semibold text-rose-500 hover:text-rose-700"
                  >
                    Hapus Diskon
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                  Rp
                </span>
                <input
                  type="number"
                  min="0"
                  max={subtotalAmount}
                  step="500"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  placeholder="0 (Contoh: 5000)"
                  className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-emerald-700 placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Ringkasan Subtotal, Diskon, & Total Tagihan */}
          <div className="space-y-1">
            {discountAmount > 0 && (
              <>
                <div className="flex justify-between items-center text-[11px] text-slate-500">
                  <span>Subtotal</span>
                  <span>Rp {subtotalAmount.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] font-semibold text-emerald-600">
                  <span>Diskon Manual</span>
                  <span>- Rp {discountAmount.toLocaleString('id-ID')}</span>
                </div>
              </>
            )}

            <div className="flex justify-between items-center pt-0.5">
              <span className="text-xs font-bold text-slate-500 uppercase">Total Tagihan</span>
              <span className="text-base sm:text-lg font-black text-blue-600">
                Rp {totalAmount.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* Selector Metode Bayar */}
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { id: 'cash', label: 'Cash', icon: Banknote },
              { id: 'qris', label: 'QRIS', icon: QrCode },
              { id: 'transfer', label: 'Bank', icon: CreditCard },
              { id: 'piutang', label: 'Bon', icon: FileText },
            ].map((m) => {
              const Icon = m.icon
              const active = paymentMethod === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethod(m.id as any)}
                  className={`py-2 px-1 text-[11px] font-bold rounded-xl border transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                    active
                      ? m.id === 'piutang'
                        ? 'bg-amber-600 text-white border-amber-500 shadow-sm shadow-amber-600/20'
                        : 'bg-blue-600 text-white border-blue-500 shadow-sm shadow-blue-600/20'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{m.label}</span>
                </button>
              )
            })}
          </div>

          {/* Form Tunai + Tombol Cepat */}
          {paymentMethod === 'cash' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Uang Diterima (Rp)
                </label>
                {totalAmount > 0 && cashValue > 0 && (
                  <span
                    className={`text-[11px] font-bold ${
                      changePreview >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {changePreview >= 0
                      ? `Kembali: Rp ${changePreview.toLocaleString('id-ID')}`
                      : `Kurang: Rp ${Math.abs(changePreview).toLocaleString('id-ID')}`}
                  </span>
                )}
              </div>

              <input
                type="number"
                value={cashGiven}
                onChange={(e) => setCashGiven(e.target.value)}
                placeholder="Masukkan nominal tunai..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 font-bold"
              />

              {totalAmount > 0 && (
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCashGiven(String(totalAmount))}
                    className="py-1.5 px-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-bold transition truncate"
                  >
                    Uang Pas
                  </button>
                  {[50000, 100000, 200000].map((nominal) => (
                    <button
                      key={nominal}
                      type="button"
                      onClick={() => setCashGiven(String(nominal))}
                      className="py-1.5 px-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold transition"
                    >
                      {nominal / 1000}rb
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Form Bon / Piutang */}
          {paymentMethod === 'piutang' && (
            <div className="space-y-2 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
              <p className="text-[10px] font-bold text-amber-800 uppercase flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>Data Penanggung Jawab Bon</span>
              </p>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nama Pelanggan / Toko *"
                className="w-full px-2.5 py-1.5 bg-white border border-amber-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                required
              />
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="No. HP / WA (Opsional)"
                className="w-full px-2.5 py-1.5 bg-white border border-amber-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || processing || !activeShift}
            className={`w-full py-3 rounded-xl text-xs font-bold shadow-md transition active:scale-[0.98] disabled:opacity-50 text-white cursor-pointer flex items-center justify-center gap-2 ${
              paymentMethod === 'piutang'
                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/25'
            }`}
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memproses Transaksi...</span>
              </>
            ) : !activeShift ? (
              <span>Buka Shift Dahulu untuk Transaksi</span>
            ) : paymentMethod === 'piutang' ? (
              <span>Catat Transaksi Bon (Unpaid)</span>
            ) : (
              <span>Bayar & Cetak Struk</span>
            )}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL BONGKAR KEMASAN (KALENG / PAIL -> KG / LITER ECERAN)    */}
      {/* ------------------------------------------------------------- */}
      {isConvertModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 min-[375px]:p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 min-[375px]:p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <PackageOpen className="w-4 h-4 text-indigo-600" />
                <span>Bongkar Kemasan ke Stok Eceran</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsConvertModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed bg-indigo-50/70 border border-indigo-100 p-2.5 rounded-xl">
              Gunakan fitur ini saat membuka cat kaleng / galon / pail untuk dijual eceran kiloan
              atau literan. Stok kaleng otomatis berkurang dan stok eceran bertambah.
            </p>

            <form onSubmit={handleConvertStock} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  1. Produk Kemasan Utuh yang Dibuka *
                </label>
                <select
                  required
                  value={sourceProductId}
                  onChange={(e) => setSourceProductId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-500"
                >
                  <option value="">-- Pilih Kemasan Asal (Kaleng / Galon / Pail) --</option>
                  {products
                    .filter((p) => p.stock > 0)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Sisa: {p.stock} {p.unit})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  2. Produk Eceran Tujuan (Kg / Liter) *
                </label>
                <select
                  required
                  value={targetProductId}
                  onChange={(e) => setTargetProductId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-500"
                >
                  <option value="">-- Pilih Produk Eceran Tujuan --</option>
                  {products
                    .filter((p) => p.id !== sourceProductId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Stok saat ini: {p.stock} {p.unit})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Jumlah Dibuka ({selectedSourceProd?.unit || 'kemasan'}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    required
                    value={convertQtySource}
                    onChange={(e) => setConvertQtySource(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Isi per Kemasan ({selectedTargetProd?.unit || 'kg/L'}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    required
                    value={convertYieldPerUnit}
                    onChange={(e) => setConvertYieldPerUnit(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>
              </div>

              {selectedSourceProd && selectedTargetProd && (
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <p className="text-[10px] text-slate-400">Berkurang</p>
                    <p className="font-bold text-rose-600">
                      -{Number(convertQtySource) || 0} {selectedSourceProd.unit}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400">Bertambah Eceran</p>
                    <p className="font-bold text-emerald-600">
                      +{((Number(convertQtySource) || 0) * (Number(convertYieldPerUnit) || 0)).toFixed(2)}{' '}
                      {selectedTargetProd.unit}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={convertingStock}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {convertingStock && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{convertingStock ? 'Memproses...' : 'Konversi Stok Sekarang'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsConvertModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL PENGELUARAN OPERASIONAL KASIR (BENSIN, PARKIR, DLL)     */}
      {/* ------------------------------------------------------------- */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 min-[375px]:p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 min-[375px]:p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Fuel className="w-4 h-4 text-amber-600" />
                <span>Catat Kas Keluar / Operasional</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Kategori Pengeluaran
                </label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Keterangan Keperluan *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Uang bensin motor antar cat ke pelanggan"
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nominal Uang Keluar (Rp) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="25000"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={savingExpense}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {savingExpense && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{savingExpense ? 'Menyimpan...' : 'Simpan Pengeluaran'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL CETAK STRUK THERMAL                                     */}
      {/* ------------------------------------------------------------- */}
      {completedTx && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 min-[375px]:p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 min-[375px]:p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div
              id="receipt-print"
              className="font-mono text-xs text-slate-800 space-y-2 border border-slate-300 p-4 rounded-xl bg-white"
            >
              <div className="text-center font-black text-sm text-slate-900 uppercase">
                MATRIXPAINT
              </div>
              <div className="text-center text-[10px] text-slate-600">
                Cabang: {completedTx.outlet}
              </div>
              <div className="border-b border-dashed border-slate-400 my-2" />
              <div className="flex justify-between text-[10px] text-slate-600 gap-2">
                <span>No: {completedTx.invoice_number}</span>
                <span className="text-right">{completedTx.created_at}</span>
              </div>
              <div className="text-[10px] text-slate-600">Kasir: {completedTx.cashier}</div>
              {completedTx.customer_name && (
                <div className="text-[10px] font-bold text-slate-900">
                  Pelanggan: {completedTx.customer_name}
                </div>
              )}
              <div className="border-b border-dashed border-slate-400 my-2" />
              <div className="space-y-1">
                {completedTx.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-[11px] text-slate-800 gap-2">
                    <span className="break-words">
                      {item.qty} {item.unit} {item.name}
                    </span>
                    <span className="font-bold shrink-0">
                      Rp {Math.round(item.price * item.qty).toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-b border-dashed border-slate-400 my-2" />
              {completedTx.discount > 0 && (
                <>
                  <div className="flex justify-between text-[10px] text-slate-600">
                    <span>Subtotal</span>
                    <span>Rp {completedTx.subtotal.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-700 font-semibold">
                    <span>Diskon</span>
                    <span>- Rp {completedTx.discount.toLocaleString('id-ID')}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-bold text-xs text-slate-900">
                <span>TOTAL</span>
                <span>Rp {completedTx.total.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-[10px] font-bold text-slate-700 mt-1">
                <span>STATUS:</span>
                <span>{completedTx.payment_status}</span>
              </div>
              {completedTx.payment_method === 'CASH' && (
                <>
                  <div className="flex justify-between text-[10px] text-slate-600">
                    <span>Bayar (Tunai)</span>
                    <span>Rp {completedTx.cash_given.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-600 font-bold">
                    <span>Kembali</span>
                    <span>Rp {completedTx.change_amount.toLocaleString('id-ID')}</span>
                  </div>
                </>
              )}
              <div className="border-b border-dashed border-slate-400 my-2" />
              <div className="text-center text-[10px] text-slate-500 mt-2">
                Terima Kasih Atas Kunjungan Anda!
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Struk</span>
              </button>
              <button
                onClick={() => setCompletedTx(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}