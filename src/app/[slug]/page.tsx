'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Baker = {
  id: string
  business_name: string
  slug: string
  bio: string
  location: string
  delivery_radius_miles: number
  free_delivery_threshold: number
  lead_time_days: number
  pickup_available: boolean
  delivery_available: boolean
  instagram_url: string
  profile_image_url: string
}
type Product = { id: string; name: string; description: string; starting_price: number }
type Flavour = { id: string; name: string; price_adjustment: number }
type Addon = { id: string; name: string; price: number; is_required: boolean; allow_quantity: boolean }
type OrderItem = {
  product_id: string
  product_name: string
  quantity: number
  size: string
  flavour_id: string
  flavour_name: string
  notes: string
  addons: { addon_id: string; addon_name: string; quantity: number; price: number }[]
}

const STEPS = ['Products', 'Details', 'Review']

export default function BakerPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [view, setView] = useState<'profile' | 'order'>('profile')
  const [step, setStep] = useState(0)
  const [baker, setBaker] = useState<Baker | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [flavours, setFlavours] = useState<Flavour[]>([])
  const [addons, setAddons] = useState<Addon[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [filterCategory, setFilterCategory] = useState('All')
  const [submitted, setSubmitted] = useState(false)

  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [collectionType, setCollectionType] = useState<'pickup' | 'delivery'>('pickup')
  const [budget, setBudget] = useState('')
  const [notes, setNotes] = useState('')
  const [dietary, setDietary] = useState('')
  const [allergens, setAllergens] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      const { data: bakerData } = await supabase
        .from('baker_profiles').select('*').eq('slug', slug).single()
      if (!bakerData) { router.push('/'); return }
      setBaker(bakerData)

      const [productsRes, flavoursRes, addonsRes] = await Promise.all([
        supabase.from('products').select('*').eq('baker_id', bakerData.id).eq('is_active', true).order('name'),
        supabase.from('flavours').select('*').eq('baker_id', bakerData.id).eq('is_active', true).order('name'),
        supabase.from('addons').select('*').eq('baker_id', bakerData.id).eq('is_active', true).order('name'),
      ])
      setProducts(productsRes.data || [])
      setFlavours(flavoursRes.data || [])
      setAddons(addonsRes.data || [])
      setLoading(false)
    }
    fetchData()
  }, [slug])

  const addProduct = (product: Product) => {
    if (orderItems.find(i => i.product_id === product.id)) return
    setOrderItems([...orderItems, {
      product_id: product.id, product_name: product.name,
      quantity: 1, size: '', flavour_id: '', flavour_name: '', notes: '',
      addons: addons.filter(a => a.is_required).map(a => ({
        addon_id: a.id, addon_name: a.name, quantity: 1, price: a.price,
      })),
    }])
  }
  const removeProduct = (product_id: string) => setOrderItems(orderItems.filter(i => i.product_id !== product_id))
  const updateItem = (product_id: string, updates: Partial<OrderItem>) =>
    setOrderItems(orderItems.map(i => i.product_id === product_id ? { ...i, ...updates } : i))

  const toggleAddon = (item: OrderItem, addon: Addon) => {
    const existing = item.addons.find(a => a.addon_id === addon.id)
    if (existing) {
      if (addon.is_required) return
      updateItem(item.product_id, { addons: item.addons.filter(a => a.addon_id !== addon.id) })
    } else {
      updateItem(item.product_id, { addons: [...item.addons, { addon_id: addon.id, addon_name: addon.name, quantity: 1, price: addon.price }] })
    }
  }

  const updateAddonQty = (item: OrderItem, addon_id: string, qty: number) =>
    updateItem(item.product_id, { addons: item.addons.map(a => a.addon_id === addon_id ? { ...a, quantity: Math.max(1, qty) } : a) })

  const handleSubmit = async () => {
    if (!baker || !customerName || !customerEmail || !eventDate || orderItems.length === 0) return
    setSubmitting(true)
    const { data: order, error } = await supabase.from('orders').insert({
      baker_id: baker.id, customer_name: customerName, customer_email: customerEmail,
      event_date: eventDate, collection_type: collectionType,
      budget: budget ? parseFloat(budget) : null, notes,
      dietary_requirements: dietary, allergens, status: 'new',
    }).select().single()

    if (error || !order) { setSubmitting(false); alert('Something went wrong. Please try again.'); return }

    for (const item of orderItems) {
      const { data: orderItem } = await supabase.from('order_items').insert({
        order_id: order.id, product_id: item.product_id, product_name: item.product_name,
        quantity: item.quantity, size: item.size, flavour: item.flavour_name, notes: item.notes,
      }).select().single()
      if (orderItem && item.addons.length > 0) {
        await supabase.from('order_item_addons').insert(
          item.addons.map(a => ({ order_item_id: orderItem.id, addon_id: a.addon_id, addon_name: a.addon_name, quantity: a.quantity, price: a.price }))
        )
      }
    }
    setSubmitting(false)
    setSubmitted(true)
  }

  const minDate = () => {
    const d = new Date()
    d.setDate(d.getDate() + (baker?.lead_time_days || 3))
    return d.toISOString().split('T')[0]
  }

  const totalEstimate = orderItems.reduce((sum, item) => {
    const product = products.find(p => p.id === item.product_id)
    const addonTotal = item.addons.reduce((s, a) => s + (a.price * a.quantity), 0)
    return sum + ((product?.starting_price || 0) * item.quantity) + addonTotal
  }, 0)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f9f6f2]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-[#ec5413] border-t-transparent animate-spin" />
        <p className="text-sm text-[#7a6a60] font-medium" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Loading bakery…</p>
      </div>
    </div>
  )

  // ── ORDER SUBMITTED CONFIRMATION ──────────────────────────────────────────
  if (submitted) return (
    <div className="min-h-screen bg-[#f9f6f2] flex items-center justify-center px-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 bg-[#ec5413] rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#ec5413]/30">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="text-3xl font-extrabold text-[#1a1008] mb-3">Request Sent! 🎂</h1>
        <p className="text-[#7a6a60] mb-2 leading-relaxed">
          <strong className="text-[#1a1008]">{baker?.business_name}</strong> will review your order and get back to you at
        </p>
        <p className="font-bold text-[#ec5413] mb-8">{customerEmail}</p>
        <p className="text-xs text-[#aaa] mb-8">No payment required — the baker will send you a personalised quote.</p>
        <button onClick={() => { setSubmitted(false); setView('profile'); setStep(0); setOrderItems([]); setCustomerName(''); setCustomerEmail(''); setEventDate(''); setBudget(''); setNotes(''); setDietary(''); setAllergens(''); }}
          className="bg-[#1a1008] text-white px-8 py-3 rounded-2xl font-bold hover:opacity-80 transition-opacity">
          Back to Bakery
        </button>
      </div>
    </div>
  )

  // ── ORDER FLOW ────────────────────────────────────────────────────────────
  if (view === 'order') return (
    <main className="min-h-screen bg-[#f9f6f2]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#f9f6f2]/90 backdrop-blur-md border-b border-[#e8ddd6]">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => step > 0 ? setStep(step - 1) : setView('profile')}
              className="text-[#7a6a60] hover:text-[#1a1008] font-semibold text-sm transition-colors flex items-center gap-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Back
            </button>
            <div className="flex items-center gap-2">
              <span className="text-lg">🎂</span>
              <h1 className="font-extrabold text-[#1a1008]">{baker?.business_name}</h1>
            </div>
            <div className="text-sm text-[#aaa] font-medium">{step + 1}/{STEPS.length}</div>
          </div>
          <div className="w-full bg-[#e8ddd6] h-1.5 rounded-full overflow-hidden">
            <div className="h-full bg-[#ec5413] rounded-full transition-all duration-500"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
          <div className="flex justify-between mt-1.5">
            {STEPS.map((s, i) => (
              <span key={s} className={`text-xs font-bold transition-colors ${i === step ? 'text-[#ec5413]' : i < step ? 'text-[#1a1008]' : 'text-[#c9b9af]'}`}>{s}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 pb-36">

        {/* STEP 0: Products */}
        {step === 0 && (
          <div>
            <h2 className="text-2xl font-extrabold text-[#1a1008] mb-1">What would you like?</h2>
            <p className="text-[#7a6a60] text-sm mb-6">Select everything you'd like to order.</p>
            {products.map(product => {
              const selected = orderItems.find(i => i.product_id === product.id)
              return (
                <div key={product.id} className={`mb-3 rounded-2xl overflow-hidden border-2 transition-all duration-200 ${selected ? 'border-[#ec5413] shadow-md shadow-[#ec5413]/10' : 'border-[#e8ddd6] bg-white'}`}>
                  <button onClick={() => selected ? removeProduct(product.id) : addProduct(product)}
                    className="w-full flex items-center justify-between p-4 text-left bg-white">
                    <div>
                      <p className="font-bold text-[#1a1008]">{product.name}</p>
                      {product.description && <p className="text-sm text-[#7a6a60] mt-0.5">{product.description}</p>}
                      {product.starting_price > 0 && <p className="text-sm font-semibold text-[#ec5413] mt-1">From £{product.starting_price}</p>}
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ml-4 transition-all ${selected ? 'bg-[#ec5413] border-[#ec5413]' : 'border-[#d0c4bc]'}`}>
                      {selected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                  </button>

                  {selected && (
                    <div className="border-t-2 border-[#f3ede8] bg-[#fdf9f7] p-4 space-y-4">
                      <div>
                        <label className="text-xs font-bold text-[#7a6a60] uppercase tracking-widest">Quantity</label>
                        <div className="flex items-center gap-3 mt-2">
                          <button onClick={() => updateItem(product.id, { quantity: Math.max(1, selected.quantity - 1) })}
                            className="w-8 h-8 rounded-full bg-white border-2 border-[#e8ddd6] font-bold text-[#1a1008] flex items-center justify-center hover:border-[#ec5413] transition-colors">−</button>
                          <span className="font-extrabold text-[#1a1008] w-6 text-center">{selected.quantity}</span>
                          <button onClick={() => updateItem(product.id, { quantity: selected.quantity + 1 })}
                            className="w-8 h-8 rounded-full bg-[#ec5413] font-bold text-white flex items-center justify-center hover:opacity-80 transition-opacity">+</button>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-[#7a6a60] uppercase tracking-widest">Size</label>
                        <input type="text" placeholder='e.g. 8" round, 12 cupcakes' value={selected.size}
                          onChange={e => updateItem(product.id, { size: e.target.value })}
                          className="w-full mt-2 px-4 py-2.5 rounded-xl border-2 border-[#e8ddd6] text-sm focus:outline-none focus:border-[#ec5413] bg-white transition-colors" />
                      </div>

                      {flavours.length > 0 && (
                        <div>
                          <label className="text-xs font-bold text-[#7a6a60] uppercase tracking-widest">Flavour</label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {flavours.map(f => (
                              <button key={f.id} onClick={() => updateItem(product.id, { flavour_id: f.id, flavour_name: f.name })}
                                className={`px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-all ${selected.flavour_id === f.id ? 'bg-[#ec5413] text-white border-[#ec5413]' : 'bg-white text-[#7a6a60] border-[#e8ddd6] hover:border-[#ec5413]'}`}>
                                {f.name}{f.price_adjustment > 0 ? ` +£${f.price_adjustment}` : ''}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {addons.length > 0 && (
                        <div>
                          <label className="text-xs font-bold text-[#7a6a60] uppercase tracking-widest">Add-ons</label>
                          <div className="space-y-2 mt-2">
                            {addons.map(addon => {
                              const selectedAddon = selected.addons.find(a => a.addon_id === addon.id)
                              return (
                                <div key={addon.id} className={`flex items-center justify-between p-3 rounded-xl border-2 bg-white transition-all ${selectedAddon ? 'border-[#ec5413]' : 'border-[#e8ddd6]'}`}>
                                  <button onClick={() => toggleAddon(selected, addon)} className="flex items-center gap-3 flex-1 text-left">
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${selectedAddon ? 'bg-[#ec5413] border-[#ec5413]' : 'border-[#d0c4bc]'}`}>
                                      {selectedAddon && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-[#1a1008]">{addon.name}</p>
                                      <p className="text-xs text-[#7a6a60]">£{addon.price}{addon.allow_quantity ? ' per item' : ''}{addon.is_required && <span className="ml-1 text-[#ec5413]">• Required</span>}</p>
                                    </div>
                                  </button>
                                  {selectedAddon && addon.allow_quantity && (
                                    <div className="flex items-center gap-2">
                                      <button onClick={() => updateAddonQty(selected, addon.id, selectedAddon.quantity - 1)} className="w-7 h-7 rounded-full bg-[#f3ede8] font-bold text-[#1a1008] text-sm flex items-center justify-center">−</button>
                                      <span className="font-bold text-sm w-4 text-center">{selectedAddon.quantity}</span>
                                      <button onClick={() => updateAddonQty(selected, addon.id, selectedAddon.quantity + 1)} className="w-7 h-7 rounded-full bg-[#ec5413] font-bold text-white text-sm flex items-center justify-center">+</button>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-bold text-[#7a6a60] uppercase tracking-widest">Notes for this item</label>
                        <textarea placeholder="e.g. 'Happy Birthday Sarah' on the cake" value={selected.notes}
                          onChange={e => updateItem(product.id, { notes: e.target.value })} rows={2}
                          className="w-full mt-2 px-4 py-2.5 rounded-xl border-2 border-[#e8ddd6] text-sm focus:outline-none focus:border-[#ec5413] bg-white resize-none transition-colors" />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* STEP 1: Details */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-extrabold text-[#1a1008] mb-1">Your details</h2>
              <p className="text-[#7a6a60] text-sm mb-6">Tell us about yourself and your event.</p>
            </div>
            {[
              { label: 'Your Name *', type: 'text', placeholder: 'Jane Smith', value: customerName, onChange: setCustomerName },
              { label: 'Email Address *', type: 'email', placeholder: 'jane@example.com', value: customerEmail, onChange: setCustomerEmail },
            ].map(field => (
              <div key={field.label}>
                <label className="text-xs font-bold text-[#7a6a60] uppercase tracking-widest">{field.label}</label>
                <input type={field.type} placeholder={field.placeholder} value={field.value}
                  onChange={e => field.onChange(e.target.value)}
                  className="w-full mt-2 px-4 py-3 rounded-xl border-2 border-[#e8ddd6] text-sm focus:outline-none focus:border-[#ec5413] bg-white transition-colors" />
              </div>
            ))}
            <div>
              <label className="text-xs font-bold text-[#7a6a60] uppercase tracking-widest">Event Date *</label>
              <input type="date" value={eventDate} min={minDate()} onChange={e => setEventDate(e.target.value)}
                className="w-full mt-2 px-4 py-3 rounded-xl border-2 border-[#e8ddd6] text-sm focus:outline-none focus:border-[#ec5413] bg-white transition-colors" />
              {baker?.lead_time_days && <p className="text-xs text-[#7a6a60] mt-1">{baker.lead_time_days} days notice required</p>}
            </div>
            {(baker?.pickup_available || baker?.delivery_available) && (
              <div>
                <label className="text-xs font-bold text-[#7a6a60] uppercase tracking-widest">Collection Type *</label>
                <div className="flex gap-3 mt-2">
                  {baker?.pickup_available && (
                    <button onClick={() => setCollectionType('pickup')}
                      className={`flex-1 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${collectionType === 'pickup' ? 'border-[#ec5413] bg-[#ec5413] text-white' : 'border-[#e8ddd6] text-[#7a6a60] bg-white hover:border-[#ec5413]'}`}>
                      🛍️ Pickup
                    </button>
                  )}
                  {baker?.delivery_available && (
                    <button onClick={() => setCollectionType('delivery')}
                      className={`flex-1 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${collectionType === 'delivery' ? 'border-[#ec5413] bg-[#ec5413] text-white' : 'border-[#e8ddd6] text-[#7a6a60] bg-white hover:border-[#ec5413]'}`}>
                      🚗 Delivery
                    </button>
                  )}
                </div>
              </div>
            )}
            <div>
              <label className="text-xs font-bold text-[#7a6a60] uppercase tracking-widest">Budget (optional)</label>
              <div className="relative mt-2">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7a6a60] font-semibold">£</span>
                <input type="number" placeholder="0.00" value={budget} onChange={e => setBudget(e.target.value)}
                  className="w-full pl-8 pr-4 py-3 rounded-xl border-2 border-[#e8ddd6] text-sm focus:outline-none focus:border-[#ec5413] bg-white transition-colors" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-[#7a6a60] uppercase tracking-widest">Dietary Requirements</label>
              <input type="text" placeholder="e.g. Vegan, Gluten free" value={dietary} onChange={e => setDietary(e.target.value)}
                className="w-full mt-2 px-4 py-3 rounded-xl border-2 border-[#e8ddd6] text-sm focus:outline-none focus:border-[#ec5413] bg-white transition-colors" />
            </div>
            <div>
              <label className="text-xs font-bold text-[#7a6a60] uppercase tracking-widest">Allergens</label>
              <input type="text" placeholder="e.g. Nut allergy, Dairy free" value={allergens} onChange={e => setAllergens(e.target.value)}
                className="w-full mt-2 px-4 py-3 rounded-xl border-2 border-[#e8ddd6] text-sm focus:outline-none focus:border-[#ec5413] bg-white transition-colors" />
              <p className="text-xs text-[#ec5413] mt-1 font-medium">⚠️ Please list all allergens — this is important for your safety</p>
            </div>
            <div>
              <label className="text-xs font-bold text-[#7a6a60] uppercase tracking-widest">Additional Notes</label>
              <textarea placeholder="Anything else we should know…" value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                className="w-full mt-2 px-4 py-3 rounded-xl border-2 border-[#e8ddd6] text-sm focus:outline-none focus:border-[#ec5413] bg-white resize-none transition-colors" />
            </div>
          </div>
        )}

        {/* STEP 2: Review */}
        {step === 2 && (
          <div>
            <h2 className="text-2xl font-extrabold text-[#1a1008] mb-1">Review your order</h2>
            <p className="text-[#7a6a60] text-sm mb-6">Check everything looks right before submitting.</p>
            <div className="mb-6">
              <h3 className="text-xs font-bold text-[#7a6a60] uppercase tracking-widest mb-3">Order Items</h3>
              {orderItems.map(item => (
                <div key={item.product_id} className="mb-3 p-4 rounded-2xl border-2 border-[#e8ddd6] bg-white">
                  <p className="font-bold text-[#1a1008]">{item.quantity > 1 ? `${item.quantity}× ` : ''}{item.product_name}</p>
                  {item.size && <p className="text-sm text-[#7a6a60] mt-1">Size: {item.size}</p>}
                  {item.flavour_name && <p className="text-sm text-[#7a6a60]">Flavour: {item.flavour_name}</p>}
                  {item.addons.length > 0 && item.addons.map(a => (
                    <p key={a.addon_id} className="text-sm text-[#aaa]">+ {a.quantity > 1 ? `${a.quantity}× ` : ''}{a.addon_name} (£{(a.price * a.quantity).toFixed(2)})</p>
                  ))}
                  {item.notes && <p className="text-sm text-[#aaa] italic mt-2">"{item.notes}"</p>}
                </div>
              ))}
            </div>
            <div className="mb-6">
              <h3 className="text-xs font-bold text-[#7a6a60] uppercase tracking-widest mb-3">Your Details</h3>
              <div className="p-4 rounded-2xl border-2 border-[#e8ddd6] bg-white space-y-2">
                {[
                  ['Name', customerName], ['Email', customerEmail], ['Event Date', eventDate],
                  ['Collection', collectionType === 'pickup' ? '🛍️ Pickup' : '🚗 Delivery'],
                  ...(budget ? [['Budget', `£${budget}`]] : []),
                  ...(dietary ? [['Dietary', dietary]] : []),
                  ...(allergens ? [['Allergens', allergens]] : []),
                  ...(notes ? [['Notes', notes]] : []),
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-[#7a6a60] font-medium">{label}</span>
                    <span className="text-[#1a1008] font-semibold text-right ml-4">{value}</span>
                  </div>
                ))}
              </div>
            </div>
            {totalEstimate > 0 && (
              <div className="p-5 rounded-2xl bg-[#1a1008] text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-[#7a6a60]">Estimated starting from</p>
                    <p className="text-3xl font-extrabold">£{totalEstimate.toFixed(2)}</p>
                  </div>
                  <p className="text-xs text-[#7a6a60] text-right max-w-[140px]">Final price confirmed by baker after review</p>
                </div>
              </div>
            )}
            <p className="text-xs text-[#aaa] text-center mt-4">No payment required now. The baker will send you a quote.</p>
          </div>
        )}
      </div>

      {/* Sticky footer CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#f9f6f2]/95 backdrop-blur-md border-t border-[#e8ddd6] p-4">
        <div className="max-w-2xl mx-auto">
          {step === 0 && (
            <button onClick={() => setStep(1)} disabled={orderItems.length === 0}
              className="w-full bg-[#ec5413] text-white font-bold py-4 rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-all shadow-lg shadow-[#ec5413]/20">
              Continue with {orderItems.length} item{orderItems.length !== 1 ? 's' : ''} →
            </button>
          )}
          {step === 1 && (
            <button onClick={() => setStep(2)} disabled={!customerName || !customerEmail || !eventDate}
              className="w-full bg-[#ec5413] text-white font-bold py-4 rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-all shadow-lg shadow-[#ec5413]/20">
              Review Order →
            </button>
          )}
          {step === 2 && (
            <button onClick={handleSubmit} disabled={submitting}
              className="w-full bg-[#ec5413] text-white font-bold py-4 rounded-2xl disabled:opacity-30 hover:opacity-90 transition-all shadow-lg shadow-[#ec5413]/20">
              {submitting ? 'Submitting…' : 'Submit Request 🎂'}
            </button>
          )}
        </div>
      </div>
    </main>
  )

  // ── PROFILE PAGE ──────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        * { font-family: 'Plus Jakarta Sans', sans-serif; }
        .card-hover { transition: transform 0.3s ease, box-shadow 0.3s ease; }
        .card-hover:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(236,84,19,0.12); }
        .img-zoom { transition: transform 0.6s ease; }
        .img-zoom:hover { transform: scale(1.06); }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.6s ease forwards; }
        .fade-up-2 { animation: fadeUp 0.6s 0.1s ease both; }
        .fade-up-3 { animation: fadeUp 0.6s 0.2s ease both; }
        .fade-up-4 { animation: fadeUp 0.6s 0.3s ease both; }
        @keyframes pulse-dot { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.4); opacity: 0.7; } }
        .pulse-dot { animation: pulse-dot 2s ease-in-out infinite; }
      `}</style>

      <div className="min-h-screen bg-[#f9f6f2]">
        {/* ── HEADER ── */}
        <header className="sticky top-0 z-50 bg-[#f9f6f2]/90 backdrop-blur-md border-b border-[#e8ddd6]">
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎂</span>
              <h1 className="text-lg font-extrabold text-[#1a1008] tracking-tight">{baker?.business_name}</h1>
            </div>
            <button
              onClick={() => { setView('order'); setStep(0) }}
              className="flex items-center gap-2 bg-[#ec5413] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity shadow-md shadow-[#ec5413]/25">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
              Order Now
            </button>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-10">

          {/* ── HERO ── */}
          <section className="flex flex-col items-center text-center mb-14 fade-up">
            <div className="relative mb-6">
              <div className="w-28 h-28 rounded-full border-4 border-white shadow-xl overflow-hidden">
                {baker?.profile_image_url ? (
                  <img src={baker.profile_image_url} alt={baker.business_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#ec5413] to-[#f0855a] flex items-center justify-center">
                    <span className="text-4xl">🎂</span>
                  </div>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 bg-[#5a6e5d] text-white p-1.5 rounded-full shadow-md">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>
              </div>
            </div>

            <h2 className="text-4xl font-extrabold text-[#1a1008] mb-3 tracking-tight">{baker?.business_name}</h2>
            {baker?.bio && (
              <p className="max-w-md text-[#7a6a60] leading-relaxed mb-6 text-sm">{baker.bio}</p>
            )}

            <div className="flex flex-wrap justify-center gap-3 fade-up-2">
              <button onClick={() => { setView('order'); setStep(0) }}
                className="bg-[#ec5413] text-white px-8 py-3 rounded-xl font-bold hover:scale-[1.02] hover:opacity-95 transition-all shadow-lg shadow-[#ec5413]/25">
                Place an Order
              </button>
              {baker?.instagram_url && (
                <a href={baker.instagram_url} target="_blank" rel="noopener noreferrer"
                  className="bg-white text-[#1a1008] px-8 py-3 rounded-xl font-bold border-2 border-[#e8ddd6] hover:border-[#ec5413] transition-colors">
                  View Portfolio
                </a>
              )}
            </div>
          </section>

          {/* ── LOCATION ── */}
          {baker?.location && (
            <section className="mb-12 bg-white rounded-2xl p-6 shadow-sm border border-[#f0e8e2] fade-up-3">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-[#ec5413]/10 rounded-xl flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ec5413" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>
                <h3 className="text-base font-bold text-[#1a1008]">Location & Service Area</h3>
              </div>
              <div className="grid md:grid-cols-2 gap-6 items-center">
                <div className="space-y-3">
                  <p className="text-[#7a6a60] text-sm">
                    Based in <span className="font-bold text-[#1a1008]">{baker.location}</span>.
                    {baker.delivery_radius_miles && ` We deliver within a ${baker.delivery_radius_miles}-mile radius.`}
                  </p>
                  {baker.free_delivery_threshold && (
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#5a6e5d]">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                      Free delivery over £{baker.free_delivery_threshold}
                    </div>
                  )}
                  {baker.lead_time_days && (
                    <div className="flex items-center gap-2 text-sm font-medium text-[#7a6a60]">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {baker.lead_time_days} days lead time required
                    </div>
                  )}
                </div>
                <div className="h-36 bg-[#f3ede8] rounded-xl overflow-hidden flex items-center justify-center relative border border-[#e8ddd6]">
                  <div className="text-center">
                    <div className="w-4 h-4 bg-[#ec5413] rounded-full pulse-dot mx-auto mb-2 shadow-md shadow-[#ec5413]/40" />
                    <p className="text-xs font-semibold text-[#7a6a60]">{baker.location}</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── PRODUCTS ── */}
          <section className="mb-14 fade-up-4">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-extrabold text-[#1a1008]">Available Products</h2>
              <div className="flex gap-2">
                {['All', 'Cakes', 'Treats'].map(cat => (
                  <button key={cat} onClick={() => setFilterCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${filterCategory === cat ? 'bg-[#ec5413] text-white shadow-md shadow-[#ec5413]/20' : 'bg-white text-[#7a6a60] border border-[#e8ddd6] hover:border-[#ec5413]'}`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {products.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-[#f0e8e2]">
                <p className="text-4xl mb-3">🧁</p>
                <p className="text-[#7a6a60] font-medium">Products coming soon</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {products.map(product => (
                  <div key={product.id} className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-[#f0e8e2] card-hover">
                    <div className="h-48 overflow-hidden relative bg-[#f3ede8]">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-6xl opacity-30">🎂</span>
                      </div>
                      {product.starting_price > 0 && (
                        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-[#ec5413] shadow-sm">
                          From £{product.starting_price}
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <h4 className="text-base font-extrabold text-[#1a1008] mb-1">{product.name}</h4>
                      {product.description && <p className="text-sm text-[#7a6a60] mb-4 line-clamp-2">{product.description}</p>}
                      <button
                        onClick={() => { addProduct(product); setView('order'); setStep(0) }}
                        className="w-full bg-[#ec5413]/10 text-[#ec5413] py-2.5 rounded-xl font-bold text-sm hover:bg-[#ec5413] hover:text-white transition-all flex items-center justify-center gap-2 group">
                        <span>Order this</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── SPECIAL REQUEST CTA ── */}
          <section className="mb-14 bg-[#1a1008] rounded-3xl p-10 text-center">
            <p className="text-3xl mb-4">✨</p>
            <h2 className="text-2xl font-extrabold text-white mb-3">Have a special request?</h2>
            <p className="text-[#7a6a60] mb-8 max-w-lg mx-auto text-sm leading-relaxed">
              Looking for something completely unique? We specialise in matching themes, dietary requirements, and specific flavour profiles.
            </p>
            <button onClick={() => { setView('order'); setStep(0) }}
              className="bg-[#ec5413] text-white px-10 py-4 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-lg shadow-[#ec5413]/30">
              Contact the Baker
            </button>
          </section>
        </main>

        {/* ── FOOTER ── */}
        <footer className="bg-white border-t border-[#f0e8e2] py-10">
          <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎂</span>
              <span className="font-extrabold text-[#1a1008]">{baker?.business_name}</span>
            </div>
            <div className="flex gap-6">
              {baker?.instagram_url && <a href={baker.instagram_url} target="_blank" rel="noopener noreferrer" className="text-[#7a6a60] hover:text-[#ec5413] transition-colors text-sm font-medium">Instagram</a>}
              <button onClick={() => { setView('order'); setStep(0) }} className="text-[#7a6a60] hover:text-[#ec5413] transition-colors text-sm font-medium">Place Order</button>
            </div>
            <p className="text-xs text-[#c0b0a8]">© {new Date().getFullYear()} {baker?.business_name}</p>
          </div>
        </footer>
      </div>
    </>
  )
}
