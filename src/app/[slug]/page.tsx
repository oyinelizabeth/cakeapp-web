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

  const [flavoursRes, blockedRes] = await Promise.all([
    supabase.from('flavours').select('*')
      .eq('baker_id', baker.id).eq('is_active', true).order('type').order('name'),
    supabase.from('blocked_dates').select('date')
      .eq('baker_id', baker.id).gte('date', new Date().toISOString().split('T')[0]),
  ])

  return {
    baker,
    flavours: flavoursRes.data || [],
    blockedDates: blockedRes.data?.map((b: any) => b.date) || [],
  }
}

export default async function BakerPage({ params }: Props) {
  const { slug } = await params
  const data = await getBakerData(slug)
  if (!data) notFound()
  const { baker, flavours, blockedDates } = data
  const accent = baker.accent_color || '#111111'

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

      {baker.custom_message && (
        <div style={{ backgroundColor: accent }} className="w-full px-4 py-2.5 text-center">
          <p className="text-white text-sm font-semibold tracking-wide">{baker.custom_message}</p>
        </div>
      )}

      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-end">
          <BasketButton slug={slug} accent={accent} />
        </div>
      </header>

      {/* Hero */}
      <div className="relative">
        <div className="w-full h-44 md:h-64 overflow-hidden"
          style={{ background: baker.cover_image_url ? undefined : `linear-gradient(135deg, ${accent}22 0%, ${accent}55 100%)` }}>
          {baker.cover_image_url && (
            <img src={baker.cover_image_url} alt="Cover" className="w-full h-full object-cover" />
          )}
        </div>

        <div className="max-w-4xl mx-auto px-4 md:px-6">
          <div className="flex items-end justify-between" style={{ marginTop: '-44px' }}>
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

            <div className="flex gap-2 pb-1">
              {baker.instagram && (
                <a href={`https://instagram.com/${baker.instagram.replace('@', '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>
              )}
              {baker.tiktok && (
                <a href={`https://tiktok.com/@${baker.tiktok.replace('@', '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.75a4.85 4.85 0 01-1.01-.06z"/>
                  </svg>
                </a>
              )}
              {baker.twitter && (
                <a href={`https://twitter.com/${baker.twitter.replace('@', '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </a>
              )}
              {baker.facebook && (
                <a href={`https://facebook.com/${baker.facebook}`}
                  target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
              )}
              <Link href={`/${slug}/menu`}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold hover:opacity-90 transition-opacity shadow-sm"
                style={{ backgroundColor: accent }}>
                View Menu
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Profile info */}
      <div className="max-w-4xl mx-auto px-4 md:px-6 mt-4 mb-8">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-0.5">{baker.business_name}</h1>
        {baker.instagram && (
          <p className="text-sm text-slate-400 mb-3">@{baker.instagram.replace('@', '')}</p>
        )}
        {baker.bio && (
          <p className="text-slate-500 leading-relaxed text-sm max-w-xl mb-4">{baker.bio}</p>
        )}

        <div className="flex flex-wrap gap-2 mb-2">
          {nextAvailable && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-700">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
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
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-white border border-gray-200 text-slate-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {baker.lead_time_days} days notice
            </span>
          )}
          {baker.deposit_percentage && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-white border border-gray-200 text-slate-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              {baker.deposit_percentage}% deposit
            </span>
          )}
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 md:px-6 pb-24">

        {/* Availability calendar */}
        <BakerPageClient
          slug={slug}
          accent={accent}
          blockedDates={blockedDates}
          workingDays={baker.working_days || ['Monday','Tuesday','Wednesday','Thursday','Friday']}
          leadTimeDays={baker.lead_time_days || 7}
        />

        {/* Flavours & Fillings */}
        {(spongeFlavours.length > 0 || fillings.length > 0) && (
          <section className="mb-10">
            <h2 className="text-lg font-extrabold mb-4">Flavours & Fillings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {spongeFlavours.length > 0 && (
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Sponge Flavours</p>
                  <div className="flex flex-wrap gap-2">
                    {spongeFlavours.map((f: any) => (
                      <span key={f.id} className="text-xs font-semibold px-3 py-1.5 rounded-full border"
                        style={{ backgroundColor: `${accent}10`, borderColor: `${accent}25`, color: accent }}>
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
                      <span key={f.id} className="text-xs font-semibold px-3 py-1.5 rounded-full border"
                        style={{ backgroundColor: `${accent}10`, borderColor: `${accent}25`, color: accent }}>
                        {f.name}{f.price_adjustment > 0 ? ` +£${f.price_adjustment}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* CTA cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          <Link href={`/${slug}/menu`}
            className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${accent}15` }}>
              <svg className="w-6 h-6" style={{ color: accent }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-bold text-slate-900">Browse the Menu</p>
              <p className="text-xs text-slate-400 mt-0.5">See all available cakes and products</p>
            </div>
            <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link href={`/${slug}/order`}
            className="flex items-center gap-4 p-5 rounded-2xl border transition-all hover:shadow-md hover:-translate-y-0.5"
            style={{ backgroundColor: `${accent}08`, borderColor: `${accent}30` }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${accent}20` }}>
              <svg className="w-6 h-6" style={{ color: accent }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-bold" style={{ color: accent }}>Send an Enquiry</p>
              <p className="text-xs text-slate-400 mt-0.5">For custom or bespoke orders</p>
            </div>
            <svg className="w-4 h-4" style={{ color: `${accent}60` }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

      </main>

      <footer className="bg-white border-t border-gray-100 py-8">
        <div className="max-w-4xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: accent }}>
              {baker.business_name?.charAt(0).toUpperCase()}
            </div>
            <span className="font-bold text-sm">{baker.business_name}</span>
          </div>
          <div className="flex items-center gap-3">
            {baker.instagram && (
              <a href={`https://instagram.com/${baker.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                className="text-slate-400 hover:text-slate-700 transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
            )}
            {baker.tiktok && (
              <a href={`https://tiktok.com/@${baker.tiktok.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                className="text-slate-400 hover:text-slate-700 transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.75a4.85 4.85 0 01-1.01-.06z"/>
                </svg>
              </a>
            )}
            {baker.twitter && (
              <a href={`https://twitter.com/${baker.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                className="text-slate-400 hover:text-slate-700 transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
            )}
            {baker.facebook && (
              <a href={`https://facebook.com/${baker.facebook}`} target="_blank" rel="noopener noreferrer"
                className="text-slate-400 hover:text-slate-700 transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
            )}
          </div>
          <p className="text-xs text-slate-400">Powered by CakeApp</p>
        </div>
      </footer>
    </div>
  )
}
