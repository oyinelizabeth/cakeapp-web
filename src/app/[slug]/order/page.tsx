'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Baker = { id: string; business_name: string; lead_time_days: number; pickup_available: boolean; delivery_available: boolean }
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

export default function OrderPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [step, setStep] = useState(0)
  const [baker, setBaker] = useState<Baker | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [flavours, setFlavours] = useState<Flavour[]>([])
  const [addons, setAddons] = useState<Addon[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Order state
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
    const existing = orderItems.find(i => i.product_id === product.id)
    if (existing) return
    setOrderItems([...orderItems, {
      product_id: product.id,
      product_name: product.name,
      quantity: 1,
      size: '',
      flavour_id: '',
      flavour_name: '',
      notes: '',
      addons: addons.filter(a => a.is_required).map(a => ({
        addon_id: a.id,
        addon_name: a.name,
        quantity: 1,
        price: a.price,
      })),
    }])
  }

  const removeProduct = (product_id: string) => {
    setOrderItems(orderItems.filter(i => i.product_id !== product_id))
  }

  const updateItem = (product_id: string, updates: Partial<OrderItem>) => {
    setOrderItems(orderItems.map(i => i.product_id === product_id ? { ...i, ...updates } : i))
  }

  const toggleAddon = (item: OrderItem, addon: Addon) => {
    const existing = item.addons.find(a => a.addon_id === addon.id)
    if (existing) {
      if (addon.is_required) return
      updateItem(item.product_id, {
        addons: item.addons.filter(a => a.addon_id !== addon.id)
      })
    } else {
      updateItem(item.product_id, {
        addons: [...item.addons, { addon_id: addon.id, addon_name: addon.name, quantity: 1, price: addon.price }]
      })
    }
  }

  const updateAddonQty = (item: OrderItem, addon_id: string, qty: number) => {
    updateItem(item.product_id, {
      addons: item.addons.map(a => a.addon_id === addon_id ? { ...a, quantity: Math.max(1, qty) } : a)
    })
  }

  const handleSubmit = async () => {
    if (!baker || !customerName || !customerEmail || !eventDate || orderItems.length === 0) return
    setSubmitting(true)

    const { data: order, error } = await supabase.from('orders').insert({
      baker_id: baker.id,
      customer_name: customerName,
      customer_email: customerEmail,
      event_date: eventDate,
      collection_type: collectionType,
      budget: budget ? parseFloat(budget) : null,
      notes,
      dietary_requirements: dietary,
      allergens,
      status: 'new',
    }).select().single()

    if (error || !order) { setSubmitting(false); alert('Something went wrong. Please try again.'); return }

    for (const item of orderItems) {
      const { data: orderItem } = await supabase.from('order_items').insert({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        size: item.size,
        flavour: item.flavour_name,
        notes: item.notes,
      }).select().single()

      if (orderItem && item.addons.length > 0) {
        await supabase.from('order_item_addons').insert(
          item.addons.map(a => ({
            order_item_id: orderItem.id,
            addon_id: a.addon_id,
            addon_name: a.addon_name,
            quantity: a.quantity,
            price: a.price,
          }))
        )
      }
    }

    setSubmitting(false)
    router.push('/order-confirmed')
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
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-400 text-sm">Loading...</div>
    </div>
  )

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-100 sticky top-0 bg-white z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => step > 0 ? setStep(step - 1) : router.back()}
              className="text-gray-400 hover:text-gray-600 font-semibold text-sm">
              ← Back
            </button>
            <h1 className="font-extrabold text-gray-900">{baker?.business_name}</h1>
            <div className="text-sm text-gray-400">{step + 1} / {STEPS.length}</div>
          </div>
          {/* Progress */}
          <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
            <div className="h-full bg-gray-900 rounded-full transition-all duration-300"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
          <div className="flex justify-between mt-1.5">
            {STEPS.map((s, i) => (
              <span key={s} className={`text-xs font-semibold ${i === step ? 'text-gray-900' : 'text-gray-300'}`}>
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 pb-32">

        {/* STEP 0: Products */}
        {step === 0 && (
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-1">What would you like?</h2>
            <p className="text-gray-500 text-sm mb-6">Select everything you'd like to order. You can add multiple items.</p>

            {products.map(product => {
              const selected = orderItems.find(i => i.product_id === product.id)
              return (
                <div key={product.id} className={`mb-3 border rounded-2xl overflow-hidden transition-all ${selected ? 'border-gray-900' : 'border-gray-100'}`}>
                  {/* Product header */}
                  <button
                    onClick={() => selected ? removeProduct(product.id) : addProduct(product)}
                    className="w-full flex items-center justify-between p-4 text-left"
                  >
                    <div>
                      <p className="font-bold text-gray-900">{product.name}</p>
                      {product.description && <p className="text-sm text-gray-400 mt-0.5">{product.description}</p>}
                      {product.starting_price > 0 && (
                        <p className="text-sm font-semibold text-gray-500 mt-1">From £{product.starting_price}</p>
                      )}
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ml-4 transition-all ${selected ? 'bg-gray-900 border-gray-900' : 'border-gray-200'}`}>
                      {selected && <span className="text-white text-xs font-bold">✓</span>}
                    </div>
                  </button>

                  {/* Expanded options */}
                  {selected && (
                    <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-4">
                      {/* Quantity */}
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Quantity</label>
                        <div className="flex items-center gap-3 mt-2">
                          <button onClick={() => updateItem(product.id, { quantity: Math.max(1, selected.quantity - 1) })}
                            className="w-8 h-8 rounded-full bg-white border border-gray-200 font-bold text-gray-900 flex items-center justify-center">−</button>
                          <span className="font-bold text-gray-900 w-6 text-center">{selected.quantity}</span>
                          <button onClick={() => updateItem(product.id, { quantity: selected.quantity + 1 })}
                            className="w-8 h-8 rounded-full bg-gray-900 font-bold text-white flex items-center justify-center">+</button>
                        </div>
                      </div>

                      {/* Size */}
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Size</label>
                        <input
                          type="text"
                          placeholder='e.g. 8" round, 12 cupcakes'
                          value={selected.size}
                          onChange={e => updateItem(product.id, { size: e.target.value })}
                          className="w-full mt-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400 bg-white"
                        />
                      </div>

                      {/* Flavour */}
                      {flavours.length > 0 && (
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Flavour</label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {flavours.map(f => (
                              <button
                                key={f.id}
                                onClick={() => updateItem(product.id, { flavour_id: f.id, flavour_name: f.name })}
                                className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${selected.flavour_id === f.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}
                              >
                                {f.name}{f.price_adjustment > 0 ? ` +£${f.price_adjustment}` : ''}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Add-ons */}
                      {addons.length > 0 && (
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Add-ons</label>
                          <div className="space-y-2 mt-2">
                            {addons.map(addon => {
                              const selectedAddon = selected.addons.find(a => a.addon_id === addon.id)
                              return (
                                <div key={addon.id} className={`flex items-center justify-between p-3 rounded-xl border bg-white ${selectedAddon ? 'border-gray-900' : 'border-gray-200'}`}>
                                  <button
                                    onClick={() => toggleAddon(selected, addon)}
                                    className="flex items-center gap-3 flex-1 text-left"
                                  >
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${selectedAddon ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}>
                                      {selectedAddon && <span className="text-white text-xs">✓</span>}
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-gray-900">{addon.name}</p>
                                      <p className="text-xs text-gray-400">
                                        £{addon.price}{addon.allow_quantity ? ' per item' : ''}
                                        {addon.is_required && <span className="ml-1 text-orange-500">• Required</span>}
                                      </p>
                                    </div>
                                  </button>
                                  {selectedAddon && addon.allow_quantity && (
                                    <div className="flex items-center gap-2">
                                      <button onClick={() => updateAddonQty(selected, addon.id, selectedAddon.quantity - 1)}
                                        className="w-7 h-7 rounded-full bg-gray-100 font-bold text-gray-900 text-sm flex items-center justify-center">−</button>
                                      <span className="font-bold text-sm w-4 text-center">{selectedAddon.quantity}</span>
                                      <button onClick={() => updateAddonQty(selected, addon.id, selectedAddon.quantity + 1)}
                                        className="w-7 h-7 rounded-full bg-gray-900 font-bold text-white text-sm flex items-center justify-center">+</button>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Notes for this item */}
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Notes for this item</label>
                        <textarea
                          placeholder="e.g. Please write 'Happy Birthday Sarah' on the cake"
                          value={selected.notes}
                          onChange={e => updateItem(product.id, { notes: e.target.value })}
                          rows={2}
                          className="w-full mt-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400 bg-white resize-none"
                        />
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
              <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Your details</h2>
              <p className="text-gray-500 text-sm mb-6">Tell us about yourself and your event.</p>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Your Name *</label>
              <input type="text" placeholder="Jane Smith" value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Email Address *</label>
              <input type="email" placeholder="jane@example.com" value={customerEmail}
                onChange={e => setCustomerEmail(e.target.value)}
                className="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Event Date *</label>
              <input type="date" value={eventDate} min={minDate()}
                onChange={e => setEventDate(e.target.value)}
                className="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
              {baker?.lead_time_days && (
                <p className="text-xs text-gray-400 mt-1">{baker.lead_time_days} days notice required</p>
              )}
            </div>

            {(baker?.pickup_available || baker?.delivery_available) && (
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Collection Type *</label>
                <div className="flex gap-3 mt-2">
                  {baker?.pickup_available && (
                    <button
                      onClick={() => setCollectionType('pickup')}
                      className={`flex-1 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${collectionType === 'pickup' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600'}`}
                    >
                      🛍️ Pickup
                    </button>
                  )}
                  {baker?.delivery_available && (
                    <button
                      onClick={() => setCollectionType('delivery')}
                      className={`flex-1 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${collectionType === 'delivery' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600'}`}
                    >
                      🚗 Delivery
                    </button>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Budget (optional)</label>
              <div className="relative mt-2">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">£</span>
                <input type="number" placeholder="0.00" value={budget}
                  onChange={e => setBudget(e.target.value)}
                  className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Dietary Requirements</label>
              <input type="text" placeholder="e.g. Vegan, Gluten free" value={dietary}
                onChange={e => setDietary(e.target.value)}
                className="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Allergens</label>
              <input type="text" placeholder="e.g. Nut allergy, Dairy free" value={allergens}
                onChange={e => setAllergens(e.target.value)}
                className="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
              <p className="text-xs text-orange-500 mt-1 font-medium">⚠️ Please list all allergens — this is important for your safety</p>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Additional Notes</label>
              <textarea placeholder="Anything else we should know about your order..." value={notes}
                onChange={e => setNotes(e.target.value)} rows={3}
                className="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400 resize-none" />
            </div>
          </div>
        )}

        {/* STEP 2: Review */}
        {step === 2 && (
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Review your order</h2>
            <p className="text-gray-500 text-sm mb-6">Check everything looks right before submitting.</p>

            {/* Order items */}
            <div className="mb-6">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Order Items</h3>
              {orderItems.map(item => (
                <div key={item.product_id} className="mb-3 p-4 rounded-xl border border-gray-100 bg-gray-50">
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-gray-900">{item.quantity > 1 ? `${item.quantity}x ` : ''}{item.product_name}</p>
                  </div>
                  {item.size && <p className="text-sm text-gray-500 mt-1">Size: {item.size}</p>}
                  {item.flavour_name && <p className="text-sm text-gray-500">Flavour: {item.flavour_name}</p>}
                  {item.addons.length > 0 && (
                    <div className="mt-2">
                      {item.addons.map(a => (
                        <p key={a.addon_id} className="text-sm text-gray-400">
                          + {a.quantity > 1 ? `${a.quantity}x ` : ''}{a.addon_name} (£{(a.price * a.quantity).toFixed(2)})
                        </p>
                      ))}
                    </div>
                  )}
                  {item.notes && <p className="text-sm text-gray-400 italic mt-2">"{item.notes}"</p>}
                </div>
              ))}
            </div>

            {/* Customer details */}
            <div className="mb-6">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Your Details</h3>
              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50 space-y-2">
                {[
                  ['Name', customerName],
                  ['Email', customerEmail],
                  ['Event Date', eventDate],
                  ['Collection', collectionType === 'pickup' ? '🛍️ Pickup' : '🚗 Delivery'],
                  budget ? ['Budget', `£${budget}`] : null,
                  dietary ? ['Dietary', dietary] : null,
                  allergens ? ['Allergens', allergens] : null,
                  notes ? ['Notes', notes] : null,
                ].filter((item): item is [string, string] => item !== null).map(([label, value]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-gray-400 font-medium">{label}</span>
                    <span className="text-gray-900 font-semibold text-right ml-4">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Estimate */}
            {totalEstimate > 0 && (
              <div className="p-4 rounded-xl bg-gray-900 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-400">Estimated starting from</p>
                    <p className="text-2xl font-extrabold">£{totalEstimate.toFixed(2)}</p>
                  </div>
                  <p className="text-xs text-gray-400 text-right max-w-[140px]">
                    Final price confirmed by baker after review
                  </p>
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400 text-center mt-4">
              No payment is required now. The baker will review your request and send a quote.
            </p>
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
        <div className="max-w-2xl mx-auto">
          {step === 0 && (
            <button
              onClick={() => setStep(1)}
              disabled={orderItems.length === 0}
              className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              Continue with {orderItems.length} item{orderItems.length !== 1 ? 's' : ''} →
            </button>
          )}
          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              disabled={!customerName || !customerEmail || !eventDate}
              className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Review Order →
            </button>
          )}
          {step === 2 && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl disabled:opacity-40"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
