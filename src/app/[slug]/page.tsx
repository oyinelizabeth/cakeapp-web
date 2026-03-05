import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import BasketButton from './BasketButton'

type Props = { params: Promise<{ slug: string }> }

async function getBakerData(slug: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: baker } = await supabase
    .from('baker_profiles').select('*').eq('slug', slug).single()
  if (!baker) return null
  const { data: products } = await supabase
    .from('products').select('*, sizes(*)')
    .eq('baker_id', baker.id).eq('is_active', true).order('name')
  return { baker, products: products || [] }
}

export default async function BakerPage({ params }: Props) {
  const { slug } = await params
  const data = await getBakerData(slug)
  if (!data) notFound()
  const { baker, products } = data
  const accent = baker.accent_color || '#111111'

  // Group products by type label
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

  return (
    <div className="min-h-screen bg-[#f8f6f6] font-sans text-slate-900">

      {baker.custom_message && (
        <div style={{ backgroundColor: accent }} className="w-full px-4 py-2.5 text-center">
          <p className="text-white text-sm font-semibold">{baker.custom_message}</p>
        </div>
      )}

      {/* Sticky header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {baker.logo_url ? (
              <img src={baker.logo_url} alt={baker.business_name} className="w-8 h-8 rounded-lg object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: accent }}>
                {baker.business_name?.charAt(0).toUpperCase()}
              </div>
            )}
            <h1 className="text-lg font-bold tracking-tight">{baker.business_name}</h1>
          </div>
          <BasketButton slug={slug} accent={accent} />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">

        {baker.cover_image_url && (
          <div className="w-full h-52 md:h-72 rounded-2xl overflow-hidden mb-8">
            <img src={baker.cover_image_url} alt="Cover" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Profile hero */}
        <section className="flex flex-col items-center text-center mb-12">
          <div className="relative mb-5">
            <div className="w-28 h-28 rounded-full" style={{ border: `4px solid ${accent}40` }}>
              {baker.logo_url ? (
                <img src={baker.logo_url} alt={baker.business_name} className="w-full h-full rounded-full object-cover" />
              ) : (
                <div className="w-full h-full rounded-full flex items-center justify-center text-white text-3xl font-bold"
                  style={{ backgroundColor: accent }}>
                  {baker.business_name?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            {baker.instagram && (
              <div className="absolute -bottom-1 -right-1 bg-green-500 text-white p-1.5 rounded-full shadow">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </div>

          <h2 className="text-3xl font-extrabold mb-1">{baker.business_name}</h2>
          {baker.instagram && (
            <a href={`https://instagram.com/${baker.instagram.replace('@', '')}`}
              target="_blank" rel="noopener noreferrer"
              className="text-sm text-gray-400 hover:text-gray-600 mb-3 block">
              @{baker.instagram.replace('@', '')}
            </a>
          )}
          {baker.bio && (
            <p className="max-w-md text-slate-500 leading-relaxed mb-5 text-sm">{baker.bio}</p>
          )}

          {/* Info pills */}
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {baker.pickup_available && (
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white border border-gray-200 text-slate-600">
                Pickup available
              </span>
            )}
            {baker.delivery_available && (
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white border border-gray-200 text-slate-600">
                Delivery available
              </span>
            )}
            {baker.lead_time_days && (
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white border border-gray-200 text-slate-600">
                {baker.lead_time_days} days notice
              </span>
            )}
          </div>
        </section>

        {/* Products grouped by category */}
        {Object.entries(grouped).map(([category, catProducts]: [string, any]) => (
          <section key={category} className="mb-12">
            <h2 className="text-xl font-extrabold mb-5">{category}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {catProducts.map((product: any) => {
                const sizes = product.sizes || []
                const minPrice = sizes.length > 0
                  ? Math.min(...sizes.map((s: any) => s.price))
                  : product.starting_price

                return (
                  <Link key={product.id} href={`/${slug}/product/${product.id}`}
                    className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-200 active:scale-[0.98]">
                    {/* Image / gradient placeholder */}
                    <div className="aspect-square overflow-hidden relative"
                      style={{ background: `linear-gradient(135deg, ${accent}18, ${accent}35)` }}>
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg className="w-12 h-12 opacity-20" style={{ color: accent }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21l-9-4.5L3 21V9a2 2 0 012-2h14a2 2 0 012 2v12z" />
                          </svg>
                        </div>
                      )}
                      {minPrice > 0 && (
                        <div className="absolute top-2.5 right-2.5 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-bold shadow-sm"
                          style={{ color: accent }}>
                          From £{minPrice}
                        </div>
                      )}
                      {product.is_enquiry_only && (
                        <div className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-bold shadow-sm text-slate-600">
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
                          {sizes.length} size{sizes.length > 1 ? 's' : ''} available →
                        </p>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        ))}

        {/* Special request CTA */}
        <section className="mb-16 rounded-2xl p-8 text-center"
          style={{ backgroundColor: `${accent}08`, border: `1px solid ${accent}20` }}>
          <h2 className="text-xl font-bold mb-2">Something unique in mind?</h2>
          <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
            Looking for something that doesn't fit a standard product? Get in touch and we'll work something out.
          </p>
          <Link href={`/${slug}/order`}
            className="inline-block text-white px-8 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity text-sm"
            style={{ backgroundColor: accent }}>
            Send an Enquiry
          </Link>
        </section>

      </main>

      <footer className="bg-white border-t border-gray-100 py-8">
        <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
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
              Instagram
            </a>
          )}
          <p className="text-xs text-slate-400">Powered by CakeApp</p>
        </div>
      </footer>
    </div>
  )
}
