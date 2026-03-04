import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'

type Props = { params: Promise<{ slug: string }> }

async function getBakerData(slug: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: baker } = await supabase
    .from('baker_profiles')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!baker) return null

  const { data: products } = await supabase
    .from('products')
    .select('*, sizes(*)')
    .eq('baker_id', baker.id)
    .eq('is_active', true)
    .order('name')

  return { baker, products: products || [] }
}

export default async function BakerPage({ params }: Props) {
  const { slug } = await params
  const data = await getBakerData(slug)
  if (!data) notFound()

  const { baker, products } = data
  const accent = baker.accent_color || '#111111'

  return (
    <div className="min-h-screen bg-[#f8f6f6] font-sans text-slate-900">

      {/* Custom message banner */}
      {baker.custom_message && (
        <div style={{ backgroundColor: accent }} className="w-full px-4 py-2.5 text-center">
          <p className="text-white text-sm font-semibold">{baker.custom_message}</p>
        </div>
      )}

      {/* Sticky header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {baker.logo_url ? (
              <img src={baker.logo_url} alt={baker.business_name}
                className="w-8 h-8 rounded-lg object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: accent }}>
                {baker.business_name?.charAt(0).toUpperCase()}
              </div>
            )}
            <h1 className="text-lg font-bold tracking-tight">{baker.business_name}</h1>
          </div>
          <Link
            href={`/${slug}/order`}
            className="flex items-center gap-2 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
            style={{ backgroundColor: accent }}
          >
            Request an Order
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* Cover banner */}
        {baker.cover_image_url && (
          <div className="w-full h-48 md:h-64 rounded-2xl overflow-hidden mb-8">
            <img src={baker.cover_image_url} alt="Cover"
              className="w-full h-full object-cover" />
          </div>
        )}

        {/* Profile hero */}
        <section className="flex flex-col items-center text-center mb-12">
          <div className="relative mb-6">
            <div className="w-32 h-32 rounded-full p-1" style={{ border: `4px solid ${accent}30` }}>
              {baker.logo_url ? (
                <img src={baker.logo_url} alt={baker.business_name}
                  className="w-full h-full rounded-full object-cover" />
              ) : (
                <div className="w-full h-full rounded-full flex items-center justify-center text-white text-4xl font-bold"
                  style={{ backgroundColor: accent }}>
                  {baker.business_name?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            {baker.instagram && (
              <div className="absolute -bottom-2 -right-2 bg-green-500 text-white p-1.5 rounded-full shadow-lg">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </div>

          <h2 className="text-3xl font-bold mb-2">{baker.business_name}</h2>

          {baker.instagram && (
            <a href={`https://instagram.com/${baker.instagram.replace('@', '')}`}
              target="_blank" rel="noopener noreferrer"
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors mb-3 block">
              @{baker.instagram.replace('@', '')}
            </a>
          )}

          {baker.bio && (
            <p className="max-w-md text-slate-600 leading-relaxed mb-6">{baker.bio}</p>
          )}

          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href={`/${slug}/order`}
              className="text-white px-8 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
              style={{ backgroundColor: accent }}
            >
              Request an Order
            </Link>
          </div>
        </section>

        {/* Location & service */}
        {(baker.address || baker.pickup_available || baker.delivery_available) && (
          <section className="mb-12 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <svg className="w-5 h-5" style={{ color: accent }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <h3 className="text-lg font-bold">Location & Service Area</h3>
            </div>
            <div className="space-y-3">
              {baker.address && (
                <p className="text-slate-600">
                  Based in <span className="font-semibold text-slate-900">{baker.address}</span>
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                {baker.pickup_available && (
                  <div className="flex items-center gap-2 text-sm font-medium" style={{ color: accent }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    <span>Pickup available</span>
                  </div>
                )}
                {baker.delivery_available && (
                  <div className="flex items-center gap-2 text-sm font-medium" style={{ color: accent }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span>Delivery within {baker.delivery_radius || 10} miles</span>
                  </div>
                )}
                {baker.lead_time_days && (
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{baker.lead_time_days} day{baker.lead_time_days > 1 ? 's' : ''} notice required</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Products */}
        {products.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">What I Offer</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {products.map((product: any) => {
                const sizes = product.sizes || []
                const minPrice = sizes.length > 0
                  ? Math.min(...sizes.map((s: any) => s.price))
                  : product.starting_price

                return (
                  <div key={product.id}
                    className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-300">
                    {/* Product image placeholder with gradient */}
                    <div className="h-48 overflow-hidden relative"
                      style={{ background: `linear-gradient(135deg, ${accent}20, ${accent}40)` }}>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-5xl opacity-30">🎂</span>
                      </div>
                      {baker.show_prices && minPrice > 0 && (
                        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold"
                          style={{ color: accent }}>
                          From £{minPrice}
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <h4 className="text-lg font-bold mb-1">{product.name}</h4>
                      {product.description && (
                        <p className="text-sm text-slate-500 mb-4">{product.description}</p>
                      )}
                      {sizes.length > 0 && (
                        <p className="text-xs text-slate-400 mb-4">{sizes.length} size{sizes.length > 1 ? 's' : ''} available</p>
                      )}
                      <Link href={`/${slug}/order`}
                        className="w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                        style={{ backgroundColor: `${accent}15`, color: accent }}
                      >
                        Request a Quote
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Special request CTA */}
        <section className="mb-16 rounded-3xl p-8 md:p-12 text-center" style={{ backgroundColor: `${accent}08`, border: `1px solid ${accent}20` }}>
          <h2 className="text-2xl font-bold mb-4">Have a special request?</h2>
          <p className="text-slate-600 mb-8 max-w-xl mx-auto">
            Looking for something completely unique? Get in touch to discuss themes, dietary requirements, and specific flavour profiles.
          </p>
          <Link
            href={`/${slug}/order`}
            className="inline-block text-white px-10 py-4 rounded-xl font-bold hover:opacity-90 transition-opacity"
            style={{ backgroundColor: accent }}
          >
            Get in Touch
          </Link>
        </section>

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-10">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: accent }}>
                {baker.business_name?.charAt(0).toUpperCase()}
              </div>
              <span className="font-bold">{baker.business_name}</span>
            </div>
            <div className="flex gap-6">
              {baker.instagram && (
                <a href={`https://instagram.com/${baker.instagram.replace('@', '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-slate-500 hover:text-slate-900 transition-colors text-sm">
                  Instagram
                </a>
              )}
              <Link href={`/${slug}/order`}
                className="text-slate-500 hover:text-slate-900 transition-colors text-sm">
                Request an Order
              </Link>
            </div>
            <p className="text-sm text-slate-400">Powered by CakeApp</p>
          </div>
        </div>
      </footer>

    </div>
  )
}
