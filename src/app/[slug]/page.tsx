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
    <main className="min-h-screen bg-white">

      {/* Custom message banner */}
      {baker.custom_message && (
        <div style={{ backgroundColor: accent }} className="w-full px-4 py-2.5 text-center">
          <p className="text-white text-sm font-semibold">{baker.custom_message}</p>
        </div>
      )}

      {/* Cover banner */}
      {baker.cover_image_url ? (
        <div className="w-full h-48 md:h-64 overflow-hidden">
          <img src={baker.cover_image_url} alt="Cover" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-full h-32" style={{ backgroundColor: `${accent}15` }} />
      )}

      {/* Profile header */}
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex items-end gap-4 -mt-10 mb-4">
          {baker.logo_url ? (
            <img src={baker.logo_url} alt={baker.business_name}
              className="w-20 h-20 rounded-2xl object-cover border-4 border-white shadow-md" />
          ) : (
            <div className="w-20 h-20 rounded-2xl border-4 border-white shadow-md flex items-center justify-center font-bold text-2xl text-white"
              style={{ backgroundColor: accent }}>
              {baker.business_name?.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="pb-1">
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight leading-tight">
              {baker.business_name}
            </h1>
            {baker.instagram && (
              <a href={`https://instagram.com/${baker.instagram.replace('@', '')}`}
                target="_blank" rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                @{baker.instagram.replace('@', '')}
              </a>
            )}
          </div>
        </div>

        {/* Bio */}
        {baker.bio && (
          <p className="text-gray-600 text-base leading-relaxed mb-5">{baker.bio}</p>
        )}

        {/* Info pills */}
        <div className="flex flex-wrap gap-2 mb-8">
          {baker.pickup_available && (
            <span className="px-3 py-1 text-sm font-semibold rounded-full"
              style={{ backgroundColor: `${accent}15`, color: accent }}>
              Pickup available
            </span>
          )}
          {baker.delivery_available && (
            <span className="px-3 py-1 text-sm font-semibold rounded-full"
              style={{ backgroundColor: `${accent}15`, color: accent }}>
              Delivery available
            </span>
          )}
          {baker.lead_time_days && (
            <span className="px-3 py-1 text-sm font-semibold rounded-full bg-gray-100 text-gray-600">
              {baker.lead_time_days} day{baker.lead_time_days > 1 ? 's' : ''} notice required
            </span>
          )}
        </div>

        {/* Products */}
        {products.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-bold text-gray-900 mb-4">What I offer</h2>
            <div className="grid grid-cols-1 gap-3">
              {products.map((product: any) => {
                const minPrice = product.sizes?.length > 0
                  ? Math.min(...product.sizes.map((s: any) => s.price))
                  : product.starting_price

                return (
                  <div key={product.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50">
                    <div>
                      <p className="font-bold text-gray-900">{product.name}</p>
                      {product.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{product.description}</p>
                      )}
                    </div>
                    {baker.show_prices && minPrice > 0 && (
                      <p className="text-sm font-bold ml-4 shrink-0" style={{ color: accent }}>
                        From £{minPrice}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="sticky bottom-4 pb-6">
          <Link href={`/${slug}/order`}
            className="block w-full text-center text-white font-bold text-lg py-4 rounded-2xl shadow-lg transition-opacity hover:opacity-90"
            style={{ backgroundColor: accent }}>
            Request an Order
          </Link>
          <p className="text-center text-xs text-gray-400 mt-3">
            No payment required to submit a request
          </p>
        </div>
      </div>
    </main>
  )
}
