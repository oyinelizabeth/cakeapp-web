'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Baker = {
  id: string
  business_name: string
  lead_time_days: number
  pickup_available: boolean
  delivery_available: boolean
  accent_color: string
}

type RawSize = {
  id: string
  label: string
  price: number
  servings?: number
  variant_group?: string | null
  sort_order: number
}

type Product = {
  id: string
  name: string
  description: string
  category: string
  sizes: RawSize[]
}

type Flavour = {
  id: string
  name: string
  price_adjustment: number
  type: 'flavour' | 'filling' | 'frosting'
}

type Addon = {
  id: string
  name: string
  price: number
  price_note: string
  is_required: boolean
  allow_quantity: boolean
}

type OrderItem = {
  product_id: string
  product_name: string
  // keyed by group name (or '__flat__' for ungrouped)
  size_selections: Record<string, string> // group -> size id
  flavour_id: string
  flavour_name: string
  filling_id: string
  filling_name: string
  frosting_id: string
  frosting_name: string
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
  const [submitError, setSubmitError] = useState('')

  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [collectionType, setCollectionType] = useState<'pickup' | 'delivery'>('pickup')
  const [budget, setBudget] = useState('')
  const [notes, setNotes] = useState('')
  const [dietary, setDietary] = useState('')
  const [allergens, setAllergens] = useState('')
  const [inspoImage, setInspoImage] = useState<File | null>(null)
  const [inspoPreview, setInspoPreview] = useState<string | null>(null)

  const accent = baker?.accent_color || '#111111'

  useEffect(() => {
    const fetchData = async () => {
      const { data: bakerData } = await supabase
        .from('baker_profiles').select('*').eq('slug', slug).single()
      if (!bakerData) { router.push('/'); return }
      setBaker(bakerData)

      const [productsRes, flavoursRes, addonsRes] = await Promise.all([
        supabase.from('products').select('*, sizes(*)').eq('baker_id', bakerData.id).eq('is_active', true).order('name'),
        supabase.from('flavours').select('*').eq('baker_id', bakerData.id).eq('is_active', true).order('name'),
        supabase.from('addons').select('*').eq('baker_id', bakerData.id).eq('is_active', true).order('name'),
      ])

      setProducts((productsRes.data || []).map((p: any) => ({
        ...p,
        sizes: (p.sizes || []).sort((a: RawSize, b: RawSize) => a.sort_order - b.sort_order)
      })))
      setFlavours(flavoursRes.data || [])
      setAddons(addonsRes.data || [])
      setLoading(false)
    }
    fetchData()
  }, [slug])

  // Split sizes into groups. Ungrouped go under '__flat__'
  const getSizeGroups = (sizes: RawSize[]): Record<string, RawSize[]> => {
    const groups: Record<string, RawSize[]> = {}
    sizes.forEach(s => {
      const key = s.variant_group || '__flat__'
      if (!groups[key]) groups[key] = []
      groups[key].push(s)
    })
    return groups
  }

  const isProductComplete = (item: OrderItem, product: Product): boolean => {
    const groups = getSizeGroups(product.sizes)
    for (const key of Object.keys(groups)) {
      if (!item.size_selections[key]) return false
    }
    return true
  }

  const validateStep0 = () =>
    orderItems.length > 0 &&
    orderItems.every(item => {
      const product = products.find(p => p.id === item.product_id)
      return product ? isProductComplete(item, product) : false
    })

  const addProduct = (product: Product) => {
    if (orderItems.find(i => i.product_id === product.id)) return
    setOrderItems([...orderItems, {
      product_id: product.id,
      product_name: product.name,
      size_selections: {},
      flavour_id: '', flavour_name: '',
      filling_id: '', filling_name: '',
      frosting_id: '', frosting_name: '',
      notes: '',
      addons: addons.filter(a => a.is_required).map(a => ({
        addon_id: a.id, addon_name: a.name, quantity: 1, price: a.price,
      })),
    }])
  }

  const removeProduct = (product_id: string) =>
    setOrderItems(orderItems.filter(i => i.product_id !== product_id))

  const updateItem = (product_id: string, updates: Partial<OrderItem>) =>
    setOrderItems(orderItems.map(i => i.product_id === product_id ? { ...i, ...updates } : i))

  const setSizeSelection = (item: OrderItem, groupKey: string, sizeId: string) =>
    updateItem(item.product_id, {
      size_selections: { ...item.size_selections, [groupKey]: sizeId }
    })

  const getSelectedSizeLabel = (item: OrderItem, product: Product): string => {
    const groups = getSizeGroups(product.sizes)
    return Object.entries(item.size_selections)
      .map(([key, sizeId]) => {
        const size = groups[key]?.find(s => s.id === sizeId)
        return size ? size.label : ''
      })
      .filter(Boolean)
      .join(', ')
  }

  const toggleAddon = (item: OrderItem, addon: Addon) => {
    const existing = item.addons.find(a => a.addon_id === addon.id)
    if (existing) {
      if (addon.is_required) return
      updateItem(item.product_id, { addons: item.addons.filter(a => a.addon_id !== addon.id) })
    } else {
      updateItem(item.product_id, {
        addons: [...item.addons, { addon_id: addon.id, addon_name: addon.name, quantity: 1, price: addon.price }]
      })
    }
  }

  const updateAddonQty = (item: OrderItem, addon_id: string, qty: number) =>
    updateItem(item.product_id, {
      addons: item.addons.map(a => a.addon_id === addon_id ? { ...a, quantity: Math.max(1, qty) } : a)
    })

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setInspoImage(file)
    setInspoPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async () => {
    if (!baker || !customerName || !customerEmail || !eventDate || orderItems.length === 0) return
    setSubmitting(true)
    setSubmitError('')

    try {
      let inspoImageUrl = null
      if (inspoImage) {
        const ext = inspoImage.name.split('.').pop()
        const filename = `inspo-${Date.now()}.${ext}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('order-inspo').upload(filename, inspoImage, { contentType: inspoImage.type })
        if (!uploadError && uploadData) {
          const { data: { publicUrl } } = supabase.storage.from('order-inspo').getPublicUrl(filename)
          inspoImageUrl = publicUrl
        }
      }

      const { data: order, error: orderError } = await supabase.from('orders').insert({
        baker_id: baker.id,
        customer_name: customerName,
        customer_email: customerEmail,
        event_date: eventDate,
        collection_type: collectionType,
        budget: budget ? parseFloat(budget) : null,
        notes,
        dietary_requirements: dietary,
        allergens,
        inspo_image_url: inspoImageUrl,
        status: 'new',
      }).select().single()

      if (orderError || !order) {
        setSubmitError('Failed to submit. Please try again.')
        setSubmitting(false)
        return
      }

      for (const item of orderItems) {
        const product = products.find(p => p.id === item.product_id)
        const sizeLabel = product ? getSelectedSizeLabel(item, product) : ''
        const flavourParts = [
          item.flavour_name,
          item.filling_name ? `${item.filling_name} filling` : '',
          item.frosting_name ? `${item.frosting_name} frosting` : '',
        ].filter(Boolean).join(', ')

        const { data: orderItem } = await supabase.from('order_items').insert({
          order_id: order.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: 1,
          size: sizeLabel,
          flavour: flavourParts,
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

      router.push(`/${slug}/order-confirmed`)
    } catch (err) {
      console.error(err)
      setSubmitError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  const minDate = () => {
    const d = new Date()
    d.setDate(d.getDate() + (baker?.lead_time_days || 3))
    return d.toISOString().split('T')[0]
  }

  const spongeFlavours = flavours.filter(f => f.type === 'flavour' || !f.type)
  const fillings = flavours.filter(f => f.type === 'filling')
  const frostings = flavours.filter(f => f.type === 'frosting')

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
          <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%`, backgroundColor: accent }} />
          </div>
          <div className="flex justify-between mt-1.5">
            {STEPS.map((s, i) => (
              <span key={s} className={`text-xs font-semibold ${i === step ? 'text-gray-900' : 'text-gray-300'}`}>{s}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 pb-32">

        {/* STEP 0: Products */}
        {step === 0 && (
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-1">What would you like?</h2>
            <p className="text-gray-500 text-sm mb-6">Select a product and choose your options.</p>

            {products.map(product => {
              const selected = orderItems.find(i => i.product_id === product.id)
              const sizeGroups = getSizeGroups(product.sizes)

              return (
                <div key={product.id} className={`mb-4 border-2 rounded-2xl overflow-hidden transition-all ${selected ? 'border-gray-900' : 'border-gray-100'}`}>
                  {/* Product header */}
                  <button
                    onClick={() => selected ? removeProduct(product.id) : addProduct(product)}
                    className="w-full flex items-center justify-between p-4 text-left"
                  >
                    <div>
                      <p className="font-bold text-gray-900">{product.name}</p>
                      {product.description && <p className="text-sm text-gray-400 mt-0.5">{product.description}</p>}
                      {product.sizes.length > 0 && (
                        <p className="text-xs text-gray-400 mt-1">
                          From £{Math.min(...product.sizes.map(s => s.price))}
                        </p>
                      )}
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ml-4 transition-all ${selected ? 'border-gray-900' : 'border-gray-200'}`}
                      style={selected ? { backgroundColor: accent, borderColor: accent } : {}}>
                      {selected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>

                  {/* Expanded options */}
                  {selected && (
                    <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-4">

                      {/* One dropdown per size group */}
                      {Object.entries(sizeGroups).map(([groupKey, groupSizes]) => {
                        const label = groupKey === '__flat__' ? 'Size / Quantity' : groupKey
                        const selectedId = selected.size_selections[groupKey] || ''
                        const missing = !selectedId

                        return (
                          <div key={groupKey}>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                                {label} <span className="text-red-400">*</span>
                              </label>
                              {missing && <span className="text-xs text-red-400 font-semibold">Required</span>}
                            </div>
                            <div className="relative">
                              <select
                                value={selectedId}
                                onChange={e => setSizeSelection(selected, groupKey, e.target.value)}
                                className={`w-full appearance-none bg-white border-2 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none pr-10 ${missing ? 'border-red-200' : selectedId ? 'border-gray-900' : 'border-gray-200'}`}
                                style={selectedId ? { borderColor: accent } : {}}
                              >
                                <option value="">Select {label}...</option>
                                {groupSizes.map(size => (
                                  <option key={size.id} value={size.id}>
                                    {size.label}
                                    {size.servings ? ` — serves ${size.servings}` : ''}
                                    {' '}— £{size.price}
                                  </option>
                                ))}
                              </select>
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        )
                      })}

                      {/* Sponge Flavour */}
                      {spongeFlavours.length > 0 && (
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Sponge Flavour</label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {spongeFlavours.map(f => (
                              <button key={f.id}
                                onClick={() => updateItem(product.id, {
                                  flavour_id: selected.flavour_id === f.id ? '' : f.id,
                                  flavour_name: selected.flavour_id === f.id ? '' : f.name,
                                })}
                                className={`px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-all ${selected.flavour_id === f.id ? 'text-white' : 'bg-white text-gray-600 border-gray-200'}`}
                                style={selected.flavour_id === f.id ? { backgroundColor: accent, borderColor: accent } : {}}>
                                {f.name}{f.price_adjustment > 0 ? ` +£${f.price_adjustment}` : ''}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Filling */}
                      {fillings.length > 0 && (
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Filling</label>
                          <p className="text-xs text-gray-400 mb-2">Premium fillings +£5</p>
                          <div className="flex flex-wrap gap-2">
                            {fillings.map(f => (
                              <button key={f.id}
                                onClick={() => updateItem(product.id, {
                                  filling_id: selected.filling_id === f.id ? '' : f.id,
                                  filling_name: selected.filling_id === f.id ? '' : f.name,
                                })}
                                className={`px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-all ${selected.filling_id === f.id ? 'text-white' : 'bg-white text-gray-600 border-gray-200'}`}
                                style={selected.filling_id === f.id ? { backgroundColor: accent, borderColor: accent } : {}}>
                                {f.name}{f.price_adjustment > 0 ? ` +£${f.price_adjustment}` : ''}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Frosting */}
                      {frostings.length > 0 && (
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Frosting</label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {frostings.map(f => (
                              <button key={f.id}
                                onClick={() => updateItem(product.id, {
                                  frosting_id: selected.frosting_id === f.id ? '' : f.id,
                                  frosting_name: selected.frosting_id === f.id ? '' : f.name,
                                })}
                                className={`px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-all ${selected.frosting_id === f.id ? 'text-white' : 'bg-white text-gray-600 border-gray-200'}`}
                                style={selected.frosting_id === f.id ? { backgroundColor: accent, borderColor: accent } : {}}>
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
                                <div key={addon.id} className={`flex items-center justify-between p-3 rounded-xl border-2 bg-white transition-all ${selectedAddon ? 'border-gray-900' : 'border-gray-200'}`}>
                                  <button onClick={() => toggleAddon(selected, addon)} className="flex items-center gap-3 flex-1 text-left">
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${selectedAddon ? '' : 'border-gray-300'}`}
                                      style={selectedAddon ? { backgroundColor: accent, borderColor: accent } : {}}>
                                      {selectedAddon && (
                                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-gray-900">{addon.name}</p>
                                      <p className="text-xs text-gray-400">
                                        £{addon.price}{addon.allow_quantity ? ' each' : ''}
                                        {addon.is_required && <span className="ml-1 text-orange-500">· Required</span>}
                                      </p>
                                    </div>
                                  </button>
                                  {selectedAddon && addon.allow_quantity && (
                                    <div className="flex items-center gap-2">
                                      <button onClick={() => updateAddonQty(selected, addon.id, selectedAddon.quantity - 1)}
                                        className="w-7 h-7 rounded-full bg-gray-100 font-bold text-gray-900 text-sm flex items-center justify-center">−</button>
                                      <span className="font-bold text-sm w-4 text-center">{selectedAddon.quantity}</span>
                                      <button onClick={() => updateAddonQty(selected, addon.id, selectedAddon.quantity + 1)}
                                        className="w-7 h-7 rounded-full text-white text-sm flex items-center justify-center font-bold"
                                        style={{ backgroundColor: accent }}>+</button>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Notes */}
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
                    <button onClick={() => setCollectionType('pickup')}
                      className={`flex-1 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${collectionType === 'pickup' ? 'text-white' : 'border-gray-200 text-gray-600'}`}
                      style={collectionType === 'pickup' ? { backgroundColor: accent, borderColor: accent } : {}}>
                      Pickup
                    </button>
                  )}
                  {baker?.delivery_available && (
                    <button onClick={() => setCollectionType('delivery')}
                      className={`flex-1 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${collectionType === 'delivery' ? 'text-white' : 'border-gray-200 text-gray-600'}`}
                      style={collectionType === 'delivery' ? { backgroundColor: accent, borderColor: accent } : {}}>
                      Delivery
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
              <p className="text-xs text-orange-500 mt-1 font-medium">Please list all allergens — this is important for your safety</p>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Inspiration Image (optional)</label>
              <p className="text-xs text-gray-400 mt-1 mb-2">Upload a photo of a style you love</p>
              <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-gray-400 transition-all overflow-hidden">
                {inspoPreview ? (
                  <div className="relative w-full h-full">
                    <img src={inspoPreview} alt="Inspiration" className="w-full h-full object-cover" />
                    <button type="button"
                      onClick={e => { e.preventDefault(); setInspoImage(null); setInspoPreview(null) }}
                      className="absolute top-2 right-2 bg-white rounded-full w-6 h-6 flex items-center justify-center shadow text-gray-500 font-bold text-xs">✕</button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm font-medium">Tap to upload photo</span>
                    <span className="text-xs">JPG or PNG</span>
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </label>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Additional Notes</label>
              <textarea placeholder="Anything else we should know..." value={notes}
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

            <div className="mb-6">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Order Items</h3>
              {orderItems.map(item => {
                const product = products.find(p => p.id === item.product_id)
                const groups = product ? getSizeGroups(product.sizes) : {}
                return (
                  <div key={item.product_id} className="mb-3 p-4 rounded-xl border border-gray-100 bg-gray-50">
                    <p className="font-bold text-gray-900">{item.product_name}</p>
                    {Object.entries(item.size_selections).map(([groupKey, sizeId]) => {
                      const size = groups[groupKey]?.find(s => s.id === sizeId)
                      const label = groupKey === '__flat__' ? 'Size' : groupKey
                      return size ? (
                        <p key={groupKey} className="text-sm text-gray-500 mt-1">{label}: {size.label}</p>
                      ) : null
                    })}
                    {item.flavour_name && <p className="text-sm text-gray-500">Sponge: {item.flavour_name}</p>}
                    {item.filling_name && <p className="text-sm text-gray-500">Filling: {item.filling_name}</p>}
                    {item.frosting_name && <p className="text-sm text-gray-500">Frosting: {item.frosting_name}</p>}
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
                )
              })}
            </div>

            {inspoPreview && (
              <div className="mb-6">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Inspiration Image</h3>
                <img src={inspoPreview} alt="Inspiration" className="w-full max-h-48 object-cover rounded-xl" />
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Your Details</h3>
              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50 space-y-2">
                {([
                  ['Name', customerName],
                  ['Email', customerEmail],
                  ['Event Date', eventDate],
                  ['Collection', collectionType === 'pickup' ? 'Pickup' : 'Delivery'],
                  budget ? ['Budget', `£${budget}`] : null,
                  dietary ? ['Dietary', dietary] : null,
                  allergens ? ['Allergens', allergens] : null,
                  notes ? ['Notes', notes] : null,
                ] as ([string, string] | null)[])
                  .filter((r): r is [string, string] => r !== null)
                  .map(([label, value]) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-gray-400 font-medium">{label}</span>
                      <span className="text-gray-900 font-semibold text-right ml-4">{value}</span>
                    </div>
                  ))}
              </div>
            </div>

            {submitError && (
              <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200">
                <p className="text-sm text-red-600 font-medium">{submitError}</p>
              </div>
            )}

            <p className="text-xs text-gray-400 text-center mt-4">
              No payment required now. The baker will review your request and send a quote.
            </p>
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
        <div className="max-w-2xl mx-auto">
          {step === 0 && (
            <button onClick={() => setStep(1)} disabled={!validateStep0()}
              className="w-full text-white font-bold py-4 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: accent }}>
              {orderItems.length === 0 ? 'Select a product to continue'
                : !validateStep0() ? 'Please complete all required options'
                : 'Continue →'}
            </button>
          )}
          {step === 1 && (
            <button onClick={() => setStep(2)} disabled={!customerName || !customerEmail || !eventDate}
              className="w-full text-white font-bold py-4 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: accent }}>
              Review Order →
            </button>
          )}
          {step === 2 && (
            <button onClick={handleSubmit} disabled={submitting}
              className="w-full text-white font-bold py-4 rounded-2xl disabled:opacity-40"
              style={{ backgroundColor: accent }}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
