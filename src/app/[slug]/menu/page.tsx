import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import BasketButton from '../BasketButton'

type Props = { params: Promise<{ slug: string }> }

async function getMenuData(slug: string) {
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

export default async function MenuPage({ params }: Props) {
  const { slug } = await params
  const data = await getMenuData(slug)
  if (!data) notFound()
  const { baker, products } = data
  const accent = baker.accent_color || '#111111'

  const TYPE_LABELS: Record<string, string> = {
    round_cake: 'Cakes', square_cake: 'Cakes', heart_cake: 'Cakes',
    character_cake: 'Specialty Cakes', drip_cake: 'Specialty Cakes',
    cupcakes: 'Cupcakes & Bento', bento: 'Cupcakes & Bento',
    set_menu: 'Sets & Bundles', custom: 'Custom Orders',
  }

  const CATEGORY_ORDER = [
    'Cakes',
    'Specialty Cakes',
    'Cupcakes & Bento',
    'Sets & Bundles',
    'Custom Orders',
    'Other',
  ]

  const grouped = products.reduce((acc: Record<string, any[]>, p: any) => {
    const label = TYPE_LABELS[p.product_type] || 'Other'
    if (!acc[label]) acc[label] = []
    acc[label].push(p)
    return acc
  }, {})

  const sortedGroups = CATEGORY_ORDER
    .filter(cat => grouped[cat])
    .map(cat => [cat, grouped[cat]] as [string, any[]])

  return (
    <div className="min-h-screen bg-[#f5f4f2] font-sans text-slate-900">

      {baker.custom_message && (
        <div style={{ backgroundColor: accent }} className="w-full px-4 py-2.5 text-center">
          <p className="text-white text-sm font-semibold tracking-wide">{baker.custom_message}</p>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/${slug}`}
              className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex items-center gap-2">
              {baker.logo_url ? (
                <img src={baker.logo_url} alt={baker.business_name} className="w-6 h-6 rounded-md object-cover" />
              ) : (
                <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: accent }}>
                  {baker.business_name?.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-sm font-bold text-slate-900">{baker.business_name}</span>
            </div>
          </div>
          <BasketButton slug={slug} accent={accent} />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-8 pb-24">

        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Menu</h1>
          <p className="text-slate-400 text-sm mt-1">{products.length} product{products.length !== 1 ? 's' : ''} available</p>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21l-9-4.5L3 21V9a2 2 0 012-2h14a2 2 0 012 2v12z" />
              </svg>
            </div>
            <p className="font-bold text-slate-900 mb-1">No products yet</p>
            <p className="text-sm text-slate-400">Check back soon or send an enquiry</p>
            <Link href={`/${slug}/order`}
              className="inline-block mt-4 px-6 py-2.5 rounded-xl text-white text-sm font-bold hover:opacity-90 transition-opacity"
              style={{ backgroundColor: accent }}>
              Send an Enquiry
            </Link>
          </div>
        ) : (
          <>
            {sortedGroups.map(([category, catProducts]: [string, any]) => (
              <section key={category} className="mb-12">
                <div className="flex items-center gap-3 mb-5">
                  <h2 className="text-lg font-extrabold">{category}</h2>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white border border-gray-200 text-slate-400">
                    {catProducts.length}
                  </span>
                </div>
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

            {/* Enquiry CTA at bottom */}
            <section className="rounded-2xl p-8 text-center"
              style={{ backgroundColor: `${accent}08`, border: `1px solid ${accent}20` }}>
              <div className="flex justify-center mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${accent}15` }}>
                  <svg className="w-5 h-5" style={{ color: accent }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
              </div>
              <h2 className="text-lg font-bold mb-2">Something unique in mind?</h2>
              <p className="text-slate-500 text-sm mb-5 max-w-sm mx-auto leading-relaxed">
                Can't find what you're looking for? Send an enquiry for custom or bespoke orders.
              </p>
              <Link href={`/${slug}/order`}
                className="inline-block text-white px-8 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity text-sm"
                style={{ backgroundColor: accent }}>
                Send an Enquiry
              </Link>
            </section>
          </>
        )}
      </main>

      <footer className="bg-white border-t border-gray-100 py-8">
        <div className="max-w-4xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-3">
          <Link href={`/${slug}`} className="flex items-center gap-2 hover:opacity-70 transition-opacity">
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: accent }}>
              {baker.business_name?.charAt(0).toUpperCase()}
            </div>
            <span className="font-bold text-sm">{baker.business_name}</span>
          </Link>
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
