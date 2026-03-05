import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import BasketButton from './BasketButton'
import BakerPageClient from './BakerPageClient'

type Props = { params: Promise<{ slug: string }> }

async function getBakerData(slug: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: baker } = await supabase
    .from('baker_profiles').select('*').eq('slug', slug).single()
  if (!baker) return null

  const [productsRes, flavoursRes, blockedRes] = await Promise.all([
    supabase.from('products').select('*, sizes(*)')
      .eq('baker_id', baker.id).eq('is_active', true).order('name'),
    supabase.from('flavours').select('*')
      .eq('baker_id', baker.id).eq('is_active', true).order('type').order('name'),
    supabase.from('blocked_dates').select('date')
      .eq('baker_id', baker.id).gte('date', new Date().toISOString().split('T')[0]),
  ])

  return {
    baker,
    products: productsRes.data || [],
    flavours: flavoursRes.data || [],
    blockedDates: blockedRes.data?.map((b: any) => b.date) || [],
  }
}

export default async function BakerPage({ params }: Props) {
  const { slug } = await params
  const data = await getBakerData(slug)
  if (!data) notFound()
  const { baker, products, flavours, blockedDates } = data
  const accent = baker.accent_color || '#111111'

  const TYPE_LABELS: Record<string, string> = {
    round_cake: 'Cakes', square_cake: 'Cakes', heart_cake: 'Cakes',
    character_cake: 'Specialty Cakes', drip_cake: 'Specialty Cakes',
    cupcakes: 'Cupcakes & Bento', bento: 'Cupcakes & Bento',
    set_menu: 'Sets & Bundles', custom: 'Custom Orders',
  }

  const grouped = products.reduce((acc: Record<string, any[]>, p: any) => {
    const label = TYPE_LABELS[p.product_type] || 'Other'
    if (!acc[label]) acc[label] = []
    acc[label].push(p)
    return acc
  }, {})

  // Get next available date
  const getNextAvailable = () => {
    const workingDays: string[] = baker.working_days || ['Monday','Tuesday','Wednesday','Thursday','Friday']
    const leadTime = baker.lead_time_days || 7
    const d = new Date()
    d.setDate(d.getDate() + leadTime)
    for (let i = 0; i < 60; i++) {
      const dayName = d.toLocaleDateString('en-GB', { weekday: 'long' })
      const dateStr = d.toISOString().split('T')[0]
      if (workingDays.includes(dayName) && !blockedDates.includes(dateStr)) {
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
      }
      d.setDate(d.getDate() + 1)
    }
    return null
  }

  const nextAvailable = getNextAvailable()
  const spongeFlavours = flavours.filter((f: any) => f.type === 'flavour')
  const fillings = flavours.filter((f: any) => f.type === 'filling')

  return (
    <div className="min-h-screen bg-[#f5f4f2] font-sans text-slate-900">

      {/* Announcement banner */}
      {baker.custom_message && (
        <div style={{ backgroundColor: accent }} className="w-full px-4 py-2.5 text-center">
          <p className="text-white text-sm font-semibold tracking-wide">{baker.custom_message}</p>
        </div>
      )}

      {/* Sticky nav */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-end">
          <BasketButton slug={slug} accent={accent} />
        </div>
      </header>

      {/* ── HERO: Twitter-style banner + overlapping avatar ── */}
      <div className="relative">
        {/* Cover banner */}
        <div className="w-full h-44 md:h-64 overflow-hidden"
          style={{ background: baker.cover_image_url ? undefined : `linear-gradient(135deg, ${accent}22 0%, ${accent}55 100%)` }}>
          {baker.cover_image_url && (
            <img src={baker.cover_image_url} alt="Cover" className="w-full h-full object-cover" />
          )}
        </div>

        {/* Avatar overlapping the banner */}
        <div className="max-w-4xl mx-auto px-4 md:px-6">
          <div className="flex items-end justify-between"
            style={{ marginTop: '-44px', paddingBottom: '0' }}>
            {/* Logo/avatar */}
            <div className="relative">
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl overflow-hidden shadow-lg"
                style={{ border: `4px solid #f5f4f2`, backgroundColor: '#fff' }}>
                {baker.logo_url ? (
                  <img src={baker.logo_url} alt={baker.business_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold"
                    style={{ backgroundColor: accent }}>
                    {baker.business_name?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons top-right */}
            <div className="flex gap-2 pb-1">
              {baker.instagram && (
                <a href={`https://instagram.com/${baker.instagram.replace('@', '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 text-slate-700 text-xs font-semibold hover:bg-gray-50 transition-colors shadow-sm">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                  Instagram
                </a>
              )}
              <Link href={`/${slug}/order`}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold hover:opacity-90 transition-opacity shadow-sm"
                style={{ backgroundColor: accent }}>
                Order Now
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── PROFILE INFO ── */}
      <div className="max-w-4xl mx-auto px-4 md:px-6 mt-4 mb-8">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-0.5">{baker.business_name}</h1>
        {baker.instagram && (
          <p className="text-sm text-slate-400 mb-3">@{baker.instagram.replace('@', '')}</p>
        )}
        {baker.bio && (
          <p className="text-slate-500 leading-relaxed text-sm max-w-xl mb-4">{baker.bio}</p>
        )}

        {/* Info pills row */}
        <div className="flex flex-wrap gap-2 mb-2">
          {nextAvailable && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-700">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
              Next available: {nextAvailable}
            </span>
          )}
          {baker.pickup_available && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-white border border-gray-200 text-slate-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              Pickup
            </span>
          )}
          {baker.delivery_available && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-white border border-gray-200 text-slate-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
              </svg>
              Delivery{baker.delivery_radius ? ` (${baker.delivery_radius}mi)` : ''}
            </span>
          )}
          {baker.lead_time_days && (
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white border border-gray-200 text-slate-600">
              {baker.lead_time_days} days notice
            </span>
          )}
          {baker.deposit_percentage && (
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white border border-gray-200 text-slate-600">
              {baker.deposit_percentage}% deposit
            </span>
          )}
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 md:px-6 pb-24">

        {/* ── AVAILABILITY CALENDAR STRIP ── */}
        <BakerPageClient
          slug={slug}
          accent={accent}
          blockedDates={blockedDates}
          workingDays={baker.working_days || ['Monday','Tuesday','Wednesday','Thursday','Friday']}
          leadTimeDays={baker.lead_time_days || 7}
        />

        {/* ── FLAVOURS STRIP ── */}
        {(spongeFlavours.length > 0 || fillings.length > 0) && (
          <section className="mb-10">
            <h2 className="text-lg font-extrabold mb-4">Flavours & Fillings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {spongeFlavours.length > 0 && (
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Sponge Flavours</p>
                  <div className="flex flex-wrap gap-2">
                    {spongeFlavours.map((f: any) => (
                      <span key={f.id}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full border"
                        style={{
                          backgroundColor: `${accent}10`,
                          borderColor: `${accent}25`,
                          color: accent,
                        }}>
                        {f.name}{f.price_adjustment > 0 ? ` +£${f.price_adjustment}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {fillings.length > 0 && (
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Fillings</p>
                  <div className="flex flex-wrap gap-2">
                    {fillings.map((f: any) => (
                      <span key={f.id}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full border"
                        style={{
                          backgroundColor: `${accent}10`,
                          borderColor: `${accent}25`,
                          color: accent,
                        }}>
                        {f.name}{f.price_adjustment > 0 ? ` +£${f.price_adjustment}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── PRODUCTS ── */}
        {Object.entries(grouped).map(([category, catProducts]: [string, any]) => (
          <section key={category} className="mb-12">
            <h2 className="text-lg font-extrabold mb-4">{category}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              {catProducts.map((product: any) => {
                const sizes = product.sizes || []
                const minPrice = sizes.length > 0
                  ? Math.min(...sizes.map((s: any) => s.price))
                  : product.starting_price

                return (
                  <Link key={product.id} href={`/${slug}/product/${product.id}`}
                    className="group bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.98]">
                    <div className="aspect-square overflow-hidden relative"
                      style={{ background: `linear-gradient(135deg, ${accent}12, ${accent}30)` }}>
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg className="w-10 h-10 opacity-20" style={{ color: accent }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21l-9-4.5L3 21V9a2 2 0 012-2h14a2 2 0 012 2v12z" />
                          </svg>
                        </div>
                      )}
                      {baker.show_prices !== false && minPrice > 0 && (
                        <div className="absolute top-2 right-2 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-bold shadow-sm"
                          style={{ color: accent }}>
                          From £{minPrice}
                        </div>
                      )}
                      {product.is_enquiry_only && (
                        <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-bold shadow-sm text-slate-600">
                          Enquiry
                        </div>
                      )}
                    </div>
                    <div className="p-3.5">
                      <h4 className="font-bold text-sm text-slate-900 mb-0.5 leading-snug">{product.name}</h4>
                      {product.description && (
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{product.description}</p>
                      )}
                      {sizes.length > 0 && (
                        <p className="text-xs mt-1.5 font-semibold" style={{ color: accent }}>
                          {sizes.length} size{sizes.length > 1 ? 's' : ''} →
                        </p>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        ))}

        {/* ── SPECIAL REQUEST CTA ── */}
        <section className="mb-10 rounded-2xl p-8 text-center"
          style={{ backgroundColor: `${accent}08`, border: `1px solid ${accent}20` }}>
          <div className="flex justify-center mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${accent}15` }}>
              <svg className="w-5 h-5" style={{ color: accent }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
          </div>
          <h2 className="text-lg font-bold mb-2">Something unique in mind?</h2>
          <p className="text-slate-500 text-sm mb-5 max-w-sm mx-auto leading-relaxed">
            Can't find what you're looking for? Send an enquiry and we'll create something just for you.
          </p>
          <Link href={`/${slug}/order`}
            className="inline-block text-white px-8 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity text-sm"
            style={{ backgroundColor: accent }}>
            Send an Enquiry
          </Link>
        </section>

      </main>

      {/* ── STICKY MOBILE ORDER BUTTON ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden px-4 pb-6 pt-3 bg-gradient-to-t from-[#f5f4f2] to-transparent pointer-events-none">
        <Link href={`/${slug}/order`}
          className="pointer-events-auto w-full flex items-center justify-center gap-2 text-white py-4 rounded-2xl font-bold text-sm shadow-xl hover:opacity-90 transition-opacity"
          style={{ backgroundColor: accent }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Place an Order
        </Link>
      </div>

      <footer className="bg-white border-t border-gray-100 py-8">
        <div className="max-w-4xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: accent }}>
              {baker.business_name?.charAt(0).toUpperCase()}
            </div>
            <span className="font-bold text-sm">{baker.business_name}</span>
          </div>
          {baker.instagram && (
            <a href={`https://instagram.com/${baker.instagram.replace('@', '')}`}
              target="_blank" rel="noopener noreferrer"
              className="text-slate-400 hover:text-slate-700 text-sm transition-colors">
              @{baker.instagram.replace('@', '')}
            </a>
          )}
          <p className="text-xs text-slate-400">Powered by CakeApp</p>
        </div>
      </footer>
    </div>
  )
}
