'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Banknote,
  QrCode,
  CreditCard,
  Printer,
  Loader2,
  X,
  UserCheck,
  ChevronUp,
} from 'lucide-react'

interface ProductItem {
  id: string
  sku: string
  name: string
  brand: string
  price: number
  stock: number
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

  // State Drawer Mobile
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false)

  // State Payment
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris' | 'transfer' | 'piutang'>('cash')
  const [cashGiven, setCashGiven] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [processing, setProcessing] = useState(false)

  // Modal Cetak Struk
  const [completedTx, setCompletedTx] = useState<any>(null)

  useEffect(() => {
    initPOS()
  }, [])

  const initPOS = async () => {
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
          .select('stock, products(id, sku, name, brand, price)')
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
              stock: item.stock || 0,
            }))
          setProducts(formattedProducts)
        }
      }
    } catch (err) {
      console.error('Gagal memuat terminal POS:', err)
    } finally {
      setLoading(false)
    }
  }

  const addToCart = (product: ProductItem) => {
    if (product.stock <= 0) return alert('Stok produk ini habis!')
    setCart((prev) => {
      const exist = prev.find((item) => item.id === product.id)
      if (exist) {
        if (exist.qty >= product.stock) {
          alert('Jumlah melebihi sisa stok yang tersedia!')
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
      alert('Jumlah melebihi stok yang tersedia!')
      return
    }
    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, qty: newQty } : item))
    )
  }

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.qty, 0)
  const totalItemsCount = cart.reduce((sum, item) => sum + item.qty, 0)

  const handleCheckout = async () => {
    if (!cashierInfo) return alert('Sesi kasir tidak valid.')
    if (cart.length === 0) return alert('Keranjang belanja masih kosong!')

    const cashValue = Number(cashGiven) || 0
    if (paymentMethod === 'cash' && cashValue < totalAmount) {
      return alert('Uang tunai kurang!')
    }

    if (paymentMethod === 'piutang' && !customerName.trim()) {
      return alert('Nama pelanggan wajib diisi untuk transaksi Bon/Piutang!')
    }

    setProcessing(true)
    try {
      const invoiceNo = `INV-${Date.now().toString().slice(-8)}`
      const changeAmount = paymentMethod === 'cash' ? cashValue - totalAmount : 0
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
            customer_name: customerName || 'Pelanggan Umum',
            customer_phone: customerPhone || null,
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
        customer_name: customerName || 'Pelanggan Umum',
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
      initPOS()
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan sistem saat memproses transaksi.')
    } finally {
      setProcessing(false)
    }
  }

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="relative flex flex-col lg:flex-row h-screen bg-slate-950 text-slate-100 overflow-hidden select-none">
      
      {/* ------------------------------------------------------------- */}
      {/* KATALOG PRODUK (FULLSCREEN DI MOBILE)                          */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 p-3 sm:p-6 overflow-y-auto pb-28 lg:pb-6 space-y-3 sm:space-y-4">
        
        {/* Top Header & Search */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900 border border-slate-800 p-3.5 sm:p-4 rounded-2xl shadow-xl">
          <div>
            <h1 className="text-sm sm:text-base font-black tracking-wider text-white flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
              TERMINAL KASIR POS
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
              Kasir: <span className="font-semibold text-slate-200">{cashierInfo?.name || '...'}</span> | Outlet:{' '}
              <span className="font-semibold text-blue-400">{cashierInfo?.outletName || '...'}</span>
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari SKU / Nama barang..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>
        </div>

        {/* Grid Produk */}
        {loading ? (
          <div className="text-center py-20 text-xs text-slate-400 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            <span>Memuat katalog produk...</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
            {filteredProducts.map((p) => (
              <div
                key={p.id}
                onClick={() => addToCart(p)}
                className={`bg-slate-900/90 border p-3 rounded-2xl transition cursor-pointer flex flex-col justify-between group active:scale-95 ${
                  p.stock > 0
                    ? 'border-slate-800/80 hover:border-blue-500/80 hover:shadow-lg hover:shadow-blue-500/10'
                    : 'border-slate-800/40 opacity-40 cursor-not-allowed'
                }`}
              >
                <div>
                  <span className="text-[9px] sm:text-[10px] font-mono bg-slate-950 text-slate-400 px-1.5 py-0.5 rounded border border-slate-800">
                    {p.sku}
                  </span>
                  <h3 className="text-xs font-bold text-white group-hover:text-blue-400 transition mt-1.5 line-clamp-2 leading-snug">
                    {p.name}
                  </h3>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex justify-between items-end">
                  <span className="text-xs font-black text-blue-400">
                    Rp {p.price.toLocaleString('id-ID')}
                  </span>
                  <span
                    className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded font-bold ${
                      p.stock > 0
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}
                  >
                    Stok: {p.stock}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* FLOATING STICKY BAR DI MOBILE (Trigger Bottom Sheet Drawer)    */}
      {/* ------------------------------------------------------------- */}
      <div className="lg:hidden fixed bottom-3 left-3 right-3 z-30">
        <button
          onClick={() => setIsMobileCartOpen(true)}
          className="w-full p-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-2xl flex items-center justify-between text-white active:scale-95 transition border border-blue-400/30"
        >
          <div className="flex items-center space-x-3">
            <div className="relative bg-white/20 p-2 rounded-xl">
              <ShoppingCart className="w-5 h-5 text-white" />
              {totalItemsCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full border border-slate-900">
                  {totalItemsCount}
                </span>
              )}
            </div>
            <div className="text-left">
              <p className="text-[10px] uppercase font-bold text-blue-200">Total Belanja</p>
              <p className="text-sm font-black">Rp {totalAmount.toLocaleString('id-ID')}</p>
            </div>
          </div>

          <div className="flex items-center space-x-1 font-bold text-xs bg-white/10 px-3 py-1.5 rounded-xl">
            <span>Lihat Keranjang</span>
            <ChevronUp className="w-4 h-4" />
          </div>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* PANEL KERANJANG (Desktop: Side Panel 96 | Mobile: Bottom Sheet) */}
      {/* ------------------------------------------------------------- */}
      <div
        className={`fixed lg:static inset-x-0 bottom-0 z-40 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col justify-between p-4 sm:p-6 shadow-2xl transition-transform duration-300 ease-in-out lg:translate-y-0 ${
          isMobileCartOpen ? 'translate-y-0 max-h-[85vh] rounded-t-3xl' : 'translate-y-full lg:translate-y-0'
        } lg:w-96 lg:h-full`}
      >
        {/* Header Panel Drawer */}
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-blue-500" />
              Item Pesanan ({cart.length})
            </h2>
            <button
              onClick={() => setIsMobileCartOpen(false)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* List Items */}
          <div className="space-y-2 mt-3 max-h-40 sm:max-h-56 lg:max-h-[calc(100vh-420px)] overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">Keranjang belanja kosong</p>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 bg-slate-950/80 border border-slate-800/80 rounded-xl flex justify-between items-center text-xs"
                >
                  <div className="pr-2 truncate">
                    <p className="font-bold text-white truncate">{item.name}</p>
                    <p className="text-slate-400 text-[10px]">
                      Rp {item.price.toLocaleString('id-ID')}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                      <button
                        onClick={() => updateCartQty(item.id, item.qty - 1)}
                        className="px-2 py-1 text-slate-400 hover:text-white font-bold"
                      >
                        -
                      </button>
                      <span className="px-2 text-xs font-bold text-white">{item.qty}</span>
                      <button
                        onClick={() => updateCartQty(item.id, item.qty + 1)}
                        className="px-2 py-1 text-slate-400 hover:text-white font-bold"
                      >
                        +
                      </button>
                    </div>
                    <span className="font-extrabold text-blue-400 text-right w-16">
                      Rp {(item.qty * item.price).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Form Pembayaran */}
        <div className="border-t border-slate-800 pt-3 space-y-3 mt-3">
          
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="text-slate-400 uppercase">Total Tagihan:</span>
            <span className="text-base font-black text-blue-400">
              Rp {totalAmount.toLocaleString('id-ID')}
            </span>
          </div>

          {/* Selector Metode Bayar */}
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { id: 'cash', label: 'Cash' },
              { id: 'qris', label: 'QRIS' },
              { id: 'transfer', label: 'Bank' },
              { id: 'piutang', label: 'Bon' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPaymentMethod(m.id as any)}
                className={`py-2 text-[11px] font-bold rounded-xl border transition cursor-pointer ${
                  paymentMethod === m.id
                    ? m.id === 'piutang'
                      ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/20'
                      : 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Form Tunai */}
          {paymentMethod === 'cash' && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Uang Diterima (Rp)
              </label>
              <input
                type="number"
                value={cashGiven}
                onChange={(e) => setCashGiven(e.target.value)}
                placeholder="Contoh: 100000"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-bold"
              />
            </div>
          )}

          {/* Form Bon / Piutang */}
          {paymentMethod === 'piutang' && (
            <div className="space-y-2 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
              <p className="text-[10px] font-bold text-amber-400 uppercase flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" /> Data Penanggung Jawab Bon
              </p>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nama Pelanggan / Toko *"
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
                required
              />
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="No. HP / WA (Opsional)"
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || processing}
            className={`w-full py-3 rounded-xl text-xs font-bold shadow-lg transition active:scale-98 disabled:opacity-50 text-white cursor-pointer flex items-center justify-center space-x-2 ${
              paymentMethod === 'piutang'
                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-600/25'
            }`}
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memproses...</span>
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
      {/* MODAL CETAK STRUK THERMAL                                      */}
      {/* ------------------------------------------------------------- */}
      {completedTx && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div id="receipt-print" className="font-mono text-xs text-slate-800 space-y-2 border border-slate-300 p-4 rounded-xl bg-white">
              <div className="text-center font-black text-sm text-slate-900 uppercase">MATRIXPAINT</div>
              <div className="text-center text-[10px] text-slate-600">Cabang: {completedTx.outlet}</div>
              <div className="border-b border-dashed border-slate-400 my-2"></div>
              <div className="flex justify-between text-[10px] text-slate-600">
                <span>No: {completedTx.invoice_number}</span>
                <span>{completedTx.created_at}</span>
              </div>
              <div className="text-[10px] text-slate-600">Kasir: {completedTx.cashier}</div>
              {completedTx.customer_name && (
                <div className="text-[10px] font-bold text-slate-900">
                  Pelanggan: {completedTx.customer_name}
                </div>
              )}
              <div className="border-b border-dashed border-slate-400 my-2"></div>
              <div className="space-y-1">
                {completedTx.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-[11px] text-slate-800">
                    <span>{item.qty}x {item.name}</span>
                    <span className="font-bold">Rp {(item.price * item.qty).toLocaleString('id-ID')}</span>
                  </div>
                ))}
              </div>
              <div className="border-b border-dashed border-slate-400 my-2"></div>
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
              <div className="border-b border-dashed border-slate-400 my-2"></div>
              <div className="text-center text-[10px] text-slate-500 mt-2">Terima Kasih Atas Kunjungan Anda!</div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Struk</span>
              </button>
              <button
                onClick={() => setCompletedTx(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
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