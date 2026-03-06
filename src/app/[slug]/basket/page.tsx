'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type CartItem = {
  id: string
  product_id: string
  product_name: string
  product_type: string
  is_enquiry_only: boolean
  size_label: string
  flavour_name: string
  filling_name: string
  frosting_name: string
  enquiry_text: string
  notes: string
  inspiration_images: string[]
  addons: { addon_id: string; addon_name: string; quantity: number; price: number }[]
  price: number
}

const STEPS = ['Basket', 'Your Details', 'Review']

export default function BasketPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [step, setStep] = useState(0)
  const [cart, setCart] = useState<CartItem[]>([])
  const [baker, setBaker] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

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

  useEffect(() => {
    const fetchBaker = async () => {
      const { data } = await supabase.from('baker_profiles').select('*').eq('slug', slug).single()
      setBaker(data)
      setLoading(false)
    }
    fetchBaker()
    const stored = JSON.parse(localStorage.getItem(`cart_${slug}`) || '[]')
    setCart(stored)
  }, [slug])

  const accent = baker?.accent_color || '#111111'

  const removeItem = (id: string) => {
    const updated = cart.filter(i => i.id !== id)
    setCart(updated)
    localStorage.setItem(`cart_${slug}`, JSON.stringify(updated))
    window.dispatchEvent(new Event('cart_updated'))
  }

  const totalEstimate = cart.reduce((sum, item) => sum + item.price, 0)

  const minDate = () => {
    const d = new Date()
    d.setDate(d.getDate() + (baker?.lead_time_days || 3))
    return d.toISOString().split('T')[0]
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setInspoImage(file)
    setInspoPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async () => {
    if (!baker || !customerName || !customerEmail || !eventDate || cart.length === 0) return
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

      for (const item of cart) {
        const flavourParts = [
          item.flavour_name,
          item.filling_name ? `${item.filling_name} filling` : '',
          item.frosting_name ? `${item.frosting_name} frosting` : '',
        ].filter(Boolean).join(', ')

        const itemNotes = [item.notes, item.enquiry_text].filter(Boolean).join(' — ')

        // Upload per-item inspiration images from base64 to Supabase storage
        const uploadedImageUrls: string[] = []
        for (const base64DataUrl of (item.inspiration_images || [])) {
          try {
            // Convert base64 data URL to Uint8Array without fetch()
            const [meta, base64] = base64DataUrl.split(',')
            const mimeMatch = meta.match(/:(.*?);/)
            const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg'
            const ext = mime.split('/')[1] || 'jpg'
            const binary = atob(base64)
            const bytes = new Uint8Array(binary.length)
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i)
            }
            const filename = `item-inspo-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('order-inspo').upload(filename, bytes, { contentType: mime, upsert: true })
            if (uploadError) {
              console.error('Upload error:', uploadError)
            } else if (uploadData) {
              const { data: { publicUrl } } = supabase.storage.from('order-inspo').getPublicUrl(filename)
              uploadedImageUrls.push(publicUrl)
            }
          } catch (e) {
            console.error('Failed to upload item inspiration image', e)
          }
        }

        const { data: orderItem } = await supabase.from('order_items').insert({
          order_id: order.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: 1,
          size: item.size_label,
          flavour: flavourParts,
          notes: itemNotes,
          inspiration_image_urls: uploadedImageUrls.length > 0 ? uploadedImageUrls : null,
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

      localStorage.removeItem(`cart_${slug}`)
      window.dispatchEvent(new Event('cart_updated'))
      router.push(`/${slug}/order-confirmed`)
    } catch (err) {
      console.error(err)
      setSubmitError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f6f6]">
      <div className="text-gray-400 text-sm">Loading...</div>
    </div>
  )

  // ── Shared inspiration image grid ──
  const InspirationGrid = ({ images }: { images: string[] }) => {
    if (!images?.length) return null
    return (
      <div className="grid grid-cols-4 gap-1.5 mt-2">
        {images.map((src, i) => (
          <div key={i} className="aspect-square rounded-lg overflow-hidden border border-gray-100">
            <img src={src} alt="Inspiration" className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    )
  }

  // ── Shared cart item summary ──
  const CartItemSummary = ({ item, variant }: { item: CartItem; variant: 'basket' | 'review' }) => (
    <div className={variant === 'basket'
      ? 'bg-white border border-gray-100 rounded-2xl p-4 shadow-sm'
      : 'mb-3 p-4 rounded-xl border border-gray-100 bg-gray-50'
    }>
      <div className="flex items-start justify-between mb-2">
        <p className="font-bold text-slate-900 text-sm">{item.product_name}</p>
        {variant === 'basket' && (
          <button onClick={() => removeItem(item.id)}
            className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center ml-2 shrink-0">
            <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="space-y-0.5">
        {item.size_label && <p className="text-xs text-slate-500">Size: {item.size_label}</p>}
        {item.flavour_name && <p className="text-xs text-slate-500">Sponge: {item.flavour_name}</p>}
        {item.filling_name && <p className="text-xs text-slate-500">Filling: {item.filling_name}</p>}
        {item.frosting_name && <p className="text-xs text-slate-500">Frosting: {item.frosting_name}</p>}
        {item.enquiry_text && <p className="text-xs text-slate-500 italic">"{item.enquiry_text}"</p>}
        {item.addons?.map(a => (
          <p key={a.addon_id} className="text-xs text-slate-400">
            + {a.quantity > 1 ? `${a.quantity}x ` : ''}{a.addon_name}
          </p>
        ))}
        {item.notes && <p className="text-xs text-slate-400 italic mt-1">Note: "{item.notes}"</p>}
      </div>

      <InspirationGrid images={item.inspiration_images} />

      {item.price > 0 && (
        <p className="text-sm font-bold mt-2.5" style={{ color: accent }}>£{item.price.toFixed(0)}</p>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f8f6f6] font-sans">
      <div className="max-w-md mx-auto bg-white min-h-screen shadow-xl flex flex-col">

        {/* Header */}
        <header className="flex items-center bg-white px-4 py-3 sticky top-0 z-10 border-b border-slate-100">
          <button onClick={() => step > 0 ? setStep(step - 1) : router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 text-slate-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 ml-3">
            <h2 className="text-base font-bold text-slate-900">{STEPS[step]}</h2>
            <div className="flex gap-1 mt-1">
              {STEPS.map((_, i) => (
                <div key={i} className="h-1 rounded-full flex-1 transition-all"
                  style={{ backgroundColor: i <= step ? accent : '#e5e7eb' }} />
              ))}
            </div>
          </div>
          <div className="ml-3 text-sm text-slate-400 font-semibold">{step + 1}/{STEPS.length}</div>
        </header>

        <div className="flex-1 overflow-y-auto pb-28 px-5 py-5">

          {/* ── STEP 0: Basket ── */}
          {step === 0 && (
            <div>
              {cart.length === 0 ? (
                <div className="text-center pt-16">
                  <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <p className="font-bold text-slate-900 mb-1">Your basket is empty</p>
                  <p className="text-sm text-slate-400 mb-6">Head back to browse products</p>
                  <Link href={`/${slug}/menu`}
                    className="inline-block text-white px-6 py-3 rounded-xl font-bold text-sm"
                    style={{ backgroundColor: accent }}>
                    Browse Products
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map(item => (
                    <CartItemSummary key={item.id} item={item} variant="basket" />
                  ))}

                  <Link href={`/${slug}/menu`}
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm font-semibold text-slate-400 hover:border-gray-300 transition-colors">
                    + Add another product
                  </Link>

                  {totalEstimate > 0 && (
                    <div className="bg-gray-50 rounded-xl p-4 flex justify-between items-center">
                      <p className="text-sm font-semibold text-slate-600">Estimated Total</p>
                      <p className="text-lg font-extrabold text-slate-900">£{totalEstimate.toFixed(0)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 1: Details ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 mb-1">Your details</h2>
                <p className="text-slate-400 text-sm">Tell us about yourself and your event.</p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Your Name *</label>
                <input type="text" placeholder="Jane Smith" value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none bg-slate-50" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Email Address *</label>
                <input type="email" placeholder="jane@example.com" value={customerEmail}
                  onChange={e => setCustomerEmail(e.target.value)}
                  className="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none bg-slate-50" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Event Date *</label>
                <input type="date" value={eventDate} min={minDate()}
                  onChange={e => setEventDate(e.target.value)}
                  className="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none bg-slate-50" />
                {baker?.lead_time_days && (
                  <p className="text-xs text-slate-400 mt-1">{baker.lead_time_days} days notice required</p>
                )}
              </div>

              {(baker?.pickup_available || baker?.delivery_available) && (
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Collection *</label>
                  <div className="flex gap-3 mt-2">
                    {baker?.pickup_available && (
                      <button onClick={() => setCollectionType('pickup')}
                        className="flex-1 py-3 rounded-xl border-2 font-semibold text-sm transition-all"
                        style={collectionType === 'pickup'
                          ? { backgroundColor: accent, borderColor: accent, color: '#fff' }
                          : { borderColor: '#e5e7eb', color: '#374151' }}>
                        Pickup
                      </button>
                    )}
                    {baker?.delivery_available && (
                      <button onClick={() => setCollectionType('delivery')}
                        className="flex-1 py-3 rounded-xl border-2 font-semibold text-sm transition-all"
                        style={collectionType === 'delivery'
                          ? { backgroundColor: accent, borderColor: accent, color: '#fff' }
                          : { borderColor: '#e5e7eb', color: '#374151' }}>
                        Delivery
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Budget (optional)</label>
                <div className="relative mt-2">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">£</span>
                  <input type="number" placeholder="0.00" value={budget} onChange={e => setBudget(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none bg-slate-50" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Dietary Requirements</label>
                <input type="text" placeholder="e.g. Vegan, Gluten free" value={dietary}
                  onChange={e => setDietary(e.target.value)}
                  className="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none bg-slate-50" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Allergens</label>
                <input type="text" placeholder="e.g. Nut allergy, Dairy free" value={allergens}
                  onChange={e => setAllergens(e.target.value)}
                  className="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none bg-slate-50" />
                <p className="text-xs text-orange-500 mt-1 font-medium">Please list all allergens — this is important for your safety</p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Overall Inspiration Image (optional)</label>
                <p className="text-xs text-slate-400 mt-1 mb-2">Any extra inspiration for the whole order</p>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-gray-300 transition-all overflow-hidden mt-1">
                  {inspoPreview ? (
                    <div className="relative w-full h-full">
                      <img src={inspoPreview} alt="Inspiration" className="w-full h-full object-cover" />
                      <button type="button"
                        onClick={e => { e.preventDefault(); setInspoImage(null); setInspoPreview(null) }}
                        className="absolute top-2 right-2 bg-white rounded-full w-6 h-6 flex items-center justify-center shadow text-slate-500 text-xs font-bold">
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-slate-400">
                      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs font-medium">Tap to upload</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Additional Notes</label>
                <textarea placeholder="Anything else we should know..." value={notes}
                  onChange={e => setNotes(e.target.value)} rows={3}
                  className="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none resize-none bg-slate-50" />
              </div>
            </div>
          )}

          {/* ── STEP 2: Review ── */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 mb-1">Review & Submit</h2>
              <p className="text-slate-400 text-sm mb-5">Check everything looks right.</p>

              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Items</h3>
              {cart.map(item => (
                <CartItemSummary key={item.id} item={item} variant="review" />
              ))}

              {inspoPreview && (
                <div className="mb-4 mt-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Overall Inspiration</h3>
                  <img src={inspoPreview} alt="Inspiration" className="w-full max-h-40 object-cover rounded-xl" />
                </div>
              )}

              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 mt-5">Your Details</h3>
              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50 space-y-2">
                {([
                  ['Name', customerName],
                  ['Email', customerEmail],
                  ['Date', eventDate],
                  ['Collection', collectionType === 'pickup' ? 'Pickup' : 'Delivery'],
                  budget ? ['Budget', `£${budget}`] : null,
                  dietary ? ['Dietary', dietary] : null,
                  allergens ? ['Allergens', allergens] : null,
                  notes ? ['Notes', notes] : null,
                ] as ([string, string] | null)[])
                  .filter((r): r is [string, string] => r !== null)
                  .map(([label, value]) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span className="text-slate-400 font-semibold">{label}</span>
                      <span className="text-slate-900 font-semibold text-right ml-4 max-w-[60%]">{value}</span>
                    </div>
                  ))}
              </div>

              {totalEstimate > 0 && (
                <div className="mt-4 flex justify-between items-center p-4 rounded-xl bg-gray-50">
                  <p className="text-sm font-semibold text-slate-600">Estimated Total</p>
                  <p className="text-xl font-extrabold text-slate-900">£{totalEstimate.toFixed(0)}</p>
                </div>
              )}

              {submitError && (
                <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200">
                  <p className="text-sm text-red-600 font-medium">{submitError}</p>
                </div>
              )}

              <p className="text-xs text-slate-400 text-center mt-4">
                No payment required now. The baker will review and send a quote.
              </p>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-100 px-5 py-4 pb-6">
          {step === 0 && (
            <button onClick={() => setStep(1)} disabled={cart.length === 0}
              className="w-full text-white font-bold py-4 rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ backgroundColor: accent }}>
              Continue to Details
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
          {step === 1 && (
            <button onClick={() => setStep(2)} disabled={!customerName || !customerEmail || !eventDate}
              className="w-full text-white font-bold py-4 rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ backgroundColor: accent }}>
              Review Order
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
          {step === 2 && (
            <button onClick={handleSubmit} disabled={submitting}
              className="w-full text-white font-bold py-4 rounded-xl disabled:opacity-40"
              style={{ backgroundColor: accent }}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
