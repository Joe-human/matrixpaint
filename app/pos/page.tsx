'use client'

import { useState, useEffect, useCallback } from 'react'
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
} from 'lucide-react'

interface ProductItem {
  id: string
  sku: string
  name: string
  brand: string
  price: number
  stock: number
  unit?: string
}

interface CartItem extends ProductItem {
  qty: number
}

export default function POSPage() {
  const [products, setProducts] = useState<ProductItem[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
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

  // State Payment
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
    }, 4000)
  }

  const initPOS = useCallback(async () => {
    try {
      setLoading(true)
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return

      const { data: userData } = await supabase
        .from('users')
        .select('id, name, outlet_id, company_id, outlets(name)')
        .eq('email', session.user.email)
        .single()

      if (userData && userData.outlet_id) {
        setCashierInfo({
          id: userData.id,
          name: userData.name || 'Kasir',
          outletId: userData.outlet_id,
          outletName: (userData.outlets as any)?.name || 'Cabang Store',
          companyId: userData.company_id,
        })

        const { data: stocksData, error } = await supabase
          .from('outlet_stocks')
          .select('stock, products(id, sku, name, brand, price, unit)')
          .eq('outlet_id', userData.outlet_id)

        if (error) throw error

        if (stocksData) {
          const formattedProducts = stocksData
            .filter((item: any) => item.products !== null)
            .map((item: any) => ({
              id: item.products.id,
              sku: item.products.sku || '-',
              name: item.products.name,
              brand: item.products.brand || '-',
              price: Number(item.products.price || 0),
              stock: Number(item.stock || 0),
              unit: item.products.unit || 'unit',
            }))
            .sort((a, b) => a.name.localeCompare(b.name))
          setProducts(formattedProducts)
        }
      }
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
    if (product.stock <= 0) {
      showFeedback('error', `Stok "${product.name}" sedang habis!`)
      return
    }
    setCart((prev) => {
      const exist = prev.find((item) => item.id === product.id)
      if (exist) {
        if (exist.qty >= product.stock) {
          showFeedback('error', `Maksimal stok "${product.name}" hanya ${product.stock} ${product.unit || 'unit'}.`)
          return prev
        }
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        )
      }
      return [...prev, { ...product, qty: 1 }]
    })
  }

  const updateCartQty = (id: string, newQty: number) => {
    if (newQty <= 0) {
      setCart((prev) => prev.filter((item) => item.id !== id))
      return
    }
    const targetProd = products.find((p) => p.id === id)
    if (targetProd && newQty > targetProd.stock) {
      showFeedback('error', `Jumlah melebihi sisa stok (${targetProd.stock} ${targetProd.unit || 'unit'}).`)
      return
    }
    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, qty: newQty } : item))
    )
  }

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.qty, 0)
  const totalItemsCount = cart.reduce((sum, item) => sum + item.qty, 0)
  const cashValue = Number(cashGiven) || 0
  const changePreview = cashValue - totalAmount

  const handleCheckout = async () => {
    if (!cashierInfo) {
      showFeedback('error', 'Sesi kasir tidak valid. Silakan login ulang.')
      return
    }
    if (cart.length === 0) {
      showFeedback('error', 'Keranjang belanja masih kosong!')
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
        subtotal: item.price * item.qty,
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
          const newStock = Math.max(0, item.stock - item.qty)
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
        total: totalAmount,
        cashier: cashierInfo.name,
        outlet: cashierInfo.outletName,
      })

      setCart([])
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

  return (
    <div className="relative flex flex-col lg:flex-row h-dvh bg-slate-50 text-slate-900 overflow-hidden select-none">
      {/* ------------------------------------------------------------- */}
      {/* KATALOG PRODUK (KIRI / FULLSCREEN DI MOBILE)                  */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 p-3 min-[375px]:p-4 sm:p-6 overflow-y-auto pb-28 lg:pb-6 space-y-4">
        {/* Top Header & Search */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white border border-slate-200/90 p-3.5 min-[375px]:p-4 rounded-2xl shadow-sm">
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

          <div className="relative w-full sm:w-64 lg:w-72 shrink-0">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari SKU, nama cat, atau merek..."
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
              Coba kata kunci SKU, nama produk, atau merek lain.
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
                    p.stock > 0
                      ? inCart
                        ? 'border-blue-500 ring-1 ring-blue-500/20'
                        : 'border-slate-200/90 hover:border-blue-400 hover:shadow-md'
                      : 'border-slate-200/60 opacity-50 cursor-not-allowed bg-slate-100/60'
                  }`}
                >
                  {inCart && (
                    <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
                      {inCart.qty}x
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
                    <span className="text-xs font-black text-blue-600 truncate">
                      Rp {p.price.toLocaleString('id-ID')}
                    </span>
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
            ? 'translate-y-0 max-h-[88dvh] rounded-t-3xl'
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
                  onClick={() => setCart([])}
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

          {/* List Items */}
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
                  className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex justify-between items-center gap-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 truncate">{item.name}</p>
                    <p className="text-slate-500 text-[10px]">
                      Rp {item.price.toLocaleString('id-ID')} / {item.unit || 'unit'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.id, item.qty - 1)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                        aria-label="Kurangi"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2 text-xs font-bold text-slate-900">{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.id, item.qty + 1)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                        aria-label="Tambah"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="font-extrabold text-blue-600 text-right min-w-[72px]">
                      Rp {(item.qty * item.price).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Form Pembayaran */}
        <div className="border-t border-slate-200 pt-3 space-y-3 mt-3 shrink-0">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-500 uppercase">Total Tagihan</span>
            <span className="text-base sm:text-lg font-black text-blue-600">
              Rp {totalAmount.toLocaleString('id-ID')}
            </span>
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
            disabled={cart.length === 0 || processing}
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
            ) : paymentMethod === 'piutang' ? (
              <span>Catat Transaksi Bon (Unpaid)</span>
            ) : (
              <span>Bayar & Cetak Struk</span>
            )}
          </button>
        </div>
      </div>

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
                      {item.qty}x {item.name}
                    </span>
                    <span className="font-bold shrink-0">
                      Rp {(item.price * item.qty).toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-b border-dashed border-slate-400 my-2" />
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