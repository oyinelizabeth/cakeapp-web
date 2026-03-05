'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Size = { id: string; label: string; price: number; servings?: number; sort_order: number }
type Flavour = { id: string; name: string; price_adjustment: number; type: string }
type Addon = { id: string; name: string; price: number; is_required: boolean; allow_quantity: boolean }

type Product = {
  id: string; name: string; description: string
  product_type: string; is_enquiry_only: boolean; image_url?: string
  sizes: Size[]
  excluded_flavour_ids: string[]
  excluded_addon_ids: string[]
  baker: {
    id: string; business_name: string; accent_color: string; slug: string
    lead_time_days: number
  }
  flavours: Flavour[]
  addons: Addon[]
}

export default function ProductPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const productId = params.productId as string

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [added, setAdded] = useState(false)

  // Selections
  const [selectedSize, setSelectedSize] = useState<Size | null>(null)
  const [selectedFlavour, setSelectedFlavour] = useState<Flavour | null>(null)
  const [selectedFilling, setSelectedFilling] = useState<Flavour | null>(null)
  const [selectedFrosting, setSelectedFrosting] = useState<Flavour | null>(null)
  const [enquiryText, setEnquiryText] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedAddons, setSelectedAddons] = useState<{ addon: Addon; qty: number }[]>([])

  useEffect(() => {
    const fetch = async () => {
      const { data: bakerData } = await supabase
        .from('baker_profiles').select('*').eq('slug', slug).single()
      if (!bakerData) { router.push('/'); return }

      const { data: productData } = await supabase
        .from('products').select('*, sizes(*)').eq('id', productId).single()
      if (!productData) { router.push(`/${slug}`); return }

      const [flavoursRes, addonsRes, fOverrides, aOverrides] = await Promise.all([
        supabase.from('flavours').select('*').eq('baker_id', bakerData.id).eq('is_active', true).order('name'),
        supabase.from('addons').select('*').eq('baker_id', bakerData.id).eq('is_active', true).order('name'),
        supabase.from('product_flavour_overrides').select('flavour_id').eq('product_id', productId).eq('is_excluded', true),
        supabase.from('product_addon_overrides').select('addon_id').eq('product_id', productId).eq('is_excluded', true),
      ])

      const excludedFlavourIds = (fOverrides.data || []).map((r: any) => r.flavour_id)
      const excludedAddonIds = (aOverrides.data || []).map((r: any) => r.addon_id)
      const allFlavours = (flavoursRes.data || []).filter((f: Flavour) => !excludedFlavourIds.includes(f.id))
      const allAddons = (addonsRes.data || []).filter((a: Addon) => !excludedAddonIds.includes(a.id))

      const sorted = (productData.sizes || []).sort((a: Size, b: Size) => a.sort_order - b.sort_order)

      setProduct({
        ...productData,
        sizes: sorted,
        excluded_flavour_ids: excludedFlavourIds,
        excluded_addon_ids: excludedAddonIds,
        baker: bakerData,
        flavours: allFlavours,
        addons: allAddons,
      })

      // Pre-select required addons
      const required = allAddons.filter((a: Addon) => a.is_required)
      setSelectedAddons(required.map((a: Addon) => ({ addon: a, qty: 1 })))

      setLoading(false)
    }
    fetch()
  }, [slug, productId])

  if (loading || !product) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f6f6]">
      <div className="text-gray-400 text-sm">Loading...</div>
    </div>
  )

  const accent = product.baker.accent_color || '#111111'
  const sponges = product.flavours.filter(f => f.type === 'flavour' || !f.type)
  const fillings = product.flavours.filter(f => f.type === 'filling')
  const frostings = product.flavours.filter(f => f.type === 'frosting')
  const isCustom = product.product_type === 'custom' || product.is_enquiry_only

  // Price calculation
  const basePrice = selectedSize?.price || (product.sizes[0]?.price ?? 0)
  const flavourExtra = selectedFlavour?.price_adjustment || 0
  const fillingExtra = selectedFilling?.price_adjustment || 0
  const frostingExtra = selectedFrosting?.price_adjustment || 0
  const addonsExtra = selectedAddons.reduce((sum, { addon, qty }) => sum + addon.price * qty, 0)
  const totalPrice = basePrice + flavourExtra + fillingExtra + frostingExtra + addonsExtra

  const isValid = isCustom
    ? enquiryText.trim().length > 0
    : product.sizes.length === 0 || selectedSize !== null

  const toggleAddon = (addon: Addon) => {
    const existing = selectedAddons.find(a => a.addon.id === addon.id)
    if (existing) {
      if (addon.is_required) return
      setSelectedAddons(selectedAddons.filter(a => a.addon.id !== addon.id))
    } else {
      setSelectedAddons([...selectedAddons, { addon, qty: 1 }])
    }
  }

  const updateQty = (addonId: string, qty: number) => {
    setSelectedAddons(selectedAddons.map(a =>
      a.addon.id === addonId ? { ...a, qty: Math.max(1, qty) } : a
    ))
  }

  const handleAddToBasket = () => {
    const cart = JSON.parse(localStorage.getItem(`cart_${slug}`) || '[]')
    const item = {
      id: `${product.id}_${Date.now()}`,
      product_id: product.id,
      product_name: product.name,
      product_type: product.product_type,
      is_enquiry_only: product.is_enquiry_only,
      size_id: selectedSize?.id || null,
      size_label: selectedSize?.label || '',
      flavour_id: selectedFlavour?.id || null,
      flavour_name: selectedFlavour?.name || '',
      filling_id: selectedFilling?.id || null,
      filling_name: selectedFilling?.name || '',
      frosting_id: selectedFrosting?.id || null,
      frosting_name: selectedFrosting?.name || '',
      enquiry_text: enquiryText,
      notes,
      addons: selectedAddons.map(({ addon, qty }) => ({
        addon_id: addon.id, addon_name: addon.name, quantity: qty, price: addon.price,
      })),
      price: totalPrice,
    }
    cart.push(item)
    localStorage.setItem(`cart_${slug}`, JSON.stringify(cart))
    window.dispatchEvent(new Event('cart_updated'))
    setAdded(true)
    setTimeout(() => router.push(`/${slug}`), 1200)
  }

  return (
    <div className="min-h-screen bg-[#f8f6f6] font-sans">
      <div className="max-w-md mx-auto bg-white min-h-screen shadow-xl flex flex-col">

        {/* Header */}
        <header className="flex items-center bg-white px-4 py-3 sticky top-0 z-10 border-b border-slate-100">
          <button onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 text-slate-700 hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-base font-bold text-slate-900 flex-1 ml-3">Product Details</h2>
        </header>

        <div className="flex-1 overflow-y-auto pb-28">
          {/* Product image */}
          <div className="aspect-square w-full overflow-hidden relative"
            style={{ background: `linear-gradient(135deg, ${accent}18, ${accent}38)` }}>
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-20 h-20 opacity-20" style={{ color: accent }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21l-9-4.5L3 21V9a2 2 0 012-2h14a2 2 0 012 2v12z" />
                </svg>
              </div>
            )}
          </div>

          {/* Product info */}
          <div className="px-5 pt-5 pb-2">
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: accent }}>
              {product.baker.business_name}
            </p>
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl font-extrabold text-slate-900 leading-tight">{product.name}</h1>
              {totalPrice > 0 && (
                <div className="shrink-0 px-3 py-1 rounded-full font-bold text-base"
                  style={{ backgroundColor: `${accent}15`, color: accent }}>
                  £{totalPrice.toFixed(0)}
                </div>
              )}
            </div>
            {product.description && (
              <p className="text-slate-500 text-sm mt-2 leading-relaxed">{product.description}</p>
            )}
          </div>

          <div className="px-5 space-y-6 mt-4">

            {/* Custom / enquiry */}
            {isCustom ? (
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">
                  Describe what you want <span className="text-red-400">*</span>
                </h3>
                <textarea
                  placeholder="e.g. A 2-tier wedding cake with floral decorations, pastel colours, serves around 60 people..."
                  value={enquiryText}
                  onChange={e => setEnquiryText(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none bg-slate-50 resize-none"
                  style={{ '--tw-ring-color': accent } as any}
                />
              </div>
            ) : (
              <>
                {/* Size selection — pill grid */}
                {product.sizes.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <span style={{ color: accent }}>◆</span>
                      {['cupcakes', 'bento'].includes(product.product_type) ? 'Quantity' : 'Select Size'}
                    </h3>
                    <div className="grid grid-cols-3 gap-2.5">
                      {product.sizes.map(size => {
                        const isSelected = selectedSize?.id === size.id
                        return (
                          <button key={size.id}
                            onClick={() => setSelectedSize(isSelected ? null : size)}
                            className="flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all"
                            style={isSelected
                              ? { borderColor: accent, backgroundColor: `${accent}10` }
                              : { borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}>
                            <span className="text-sm font-bold" style={isSelected ? { color: accent } : { color: '#111' }}>
                              {size.label}
                            </span>
                            {size.servings && (
                              <span className="text-[10px] mt-0.5" style={isSelected ? { color: `${accent}99` } : { color: '#9ca3af' }}>
                                Feeds {size.servings}
                              </span>
                            )}
                            <span className="text-[11px] font-semibold mt-1" style={isSelected ? { color: accent } : { color: '#6b7280' }}>
                              £{size.price}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Sponge flavour dropdown */}
                {sponges.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <span style={{ color: accent }}>◆</span> Sponge Flavour
                    </h3>
                    <div className="relative">
                      <select
                        value={selectedFlavour?.id || ''}
                        onChange={e => setSelectedFlavour(sponges.find(f => f.id === e.target.value) || null)}
                        className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm appearance-none focus:outline-none pr-10"
                      >
                        <option value="">Select flavour...</option>
                        {sponges.map(f => (
                          <option key={f.id} value={f.id}>
                            {f.name}{f.price_adjustment > 0 ? ` (+£${f.price_adjustment})` : ''}
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
                )}

                {/* Filling dropdown */}
                {fillings.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <span style={{ color: accent }}>◆</span> Filling
                    </h3>
                    <div className="relative">
                      <select
                        value={selectedFilling?.id || ''}
                        onChange={e => setSelectedFilling(fillings.find(f => f.id === e.target.value) || null)}
                        className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm appearance-none focus:outline-none pr-10"
                      >
                        <option value="">Select filling...</option>
                        {fillings.map(f => (
                          <option key={f.id} value={f.id}>
                            {f.name}{f.price_adjustment > 0 ? ` (+£${f.price_adjustment})` : ''}
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
                )}

                {/* Frosting dropdown */}
                {frostings.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <span style={{ color: accent }}>◆</span> Frosting
                    </h3>
                    <div className="relative">
                      <select
                        value={selectedFrosting?.id || ''}
                        onChange={e => setSelectedFrosting(frostings.find(f => f.id === e.target.value) || null)}
                        className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm appearance-none focus:outline-none pr-10"
                      >
                        <option value="">Select frosting...</option>
                        {frostings.map(f => (
                          <option key={f.id} value={f.id}>
                            {f.name}{f.price_adjustment > 0 ? ` (+£${f.price_adjustment})` : ''}
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
                )}

                {/* Character/theme for character cakes */}
                {product.product_type === 'character_cake' && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <span style={{ color: accent }}>◆</span> Character / Theme
                    </h3>
                    <input type="text"
                      placeholder="e.g. Peppa Pig, Spiderman, Princess..."
                      value={enquiryText}
                      onChange={e => setEnquiryText(e.target.value)}
                      className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none" />
                  </div>
                )}

                {/* Add-ons */}
                {product.addons.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <span style={{ color: accent }}>◆</span> Add-ons
                    </h3>
                    <div className="space-y-2">
                      {product.addons.map(addon => {
                        const sel = selectedAddons.find(a => a.addon.id === addon.id)
                        return (
                          <div key={addon.id}
                            className="flex items-center justify-between p-3.5 rounded-xl border-2 bg-white transition-all"
                            style={{ borderColor: sel ? accent : '#e5e7eb' }}>
                            <button onClick={() => toggleAddon(addon)} className="flex items-center gap-3 flex-1 text-left">
                              <div className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all"
                                style={sel ? { backgroundColor: accent, borderColor: accent } : { borderColor: '#d1d5db' }}>
                                {sel && (
                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{addon.name}</p>
                                <p className="text-xs text-slate-400">
                                  £{addon.price}{addon.allow_quantity ? ' each' : ''}
                                  {addon.is_required && <span className="ml-1 text-orange-500">Required</span>}
                                </p>
                              </div>
                            </button>
                            {sel && addon.allow_quantity && (
                              <div className="flex items-center gap-2">
                                <button onClick={() => updateQty(addon.id, sel.qty - 1)}
                                  className="w-7 h-7 rounded-full bg-gray-100 font-bold text-sm flex items-center justify-center">−</button>
                                <span className="font-bold text-sm w-4 text-center">{sel.qty}</span>
                                <button onClick={() => updateQty(addon.id, sel.qty + 1)}
                                  className="w-7 h-7 rounded-full text-white text-sm font-bold flex items-center justify-center"
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
                  <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <span style={{ color: accent }}>◆</span> Customisation Notes
                  </h3>
                  <textarea
                    placeholder="e.g. Please write 'Happy Birthday Sarah', any special requests..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none resize-none"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Sticky footer CTA */}
        <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-100 px-5 py-4 pb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">
                {isCustom ? 'Enquiry' : 'Price Estimate'}
              </p>
              <p className="text-xl font-extrabold text-slate-900">
                {totalPrice > 0 ? `£${totalPrice.toFixed(0)}` : 'TBC'}
              </p>
            </div>
            <button
              onClick={handleAddToBasket}
              disabled={!isValid || added}
              className="flex items-center gap-2 text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-40 active:scale-95"
              style={{ backgroundColor: added ? '#22c55e' : accent }}>
              {added ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Added!
                </>
              ) : (
                <>
                  Add to Request
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
