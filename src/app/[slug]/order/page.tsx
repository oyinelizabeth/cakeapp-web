'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function EnquiryPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [baker, setBaker] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [enquiry, setEnquiry] = useState('')
  const [dietary, setDietary] = useState('')
  const [allergens, setAllergens] = useState('')
  const [budget, setBudget] = useState('')
  const [inspoImage, setInspoImage] = useState<File | null>(null)
  const [inspoPreview, setInspoPreview] = useState<string | null>(null)

  useEffect(() => {
    const fetchBaker = async () => {
      const { data } = await supabase.from('baker_profiles').select('*').eq('slug', slug).single()
      if (!data) { router.push('/'); return }
      setBaker(data)
      setLoading(false)
    }
    fetchBaker()
  }, [slug])

  const accent = baker?.accent_color || '#111111'

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
    if (!customerName || !customerEmail || !enquiry) return
    setSubmitting(true)
    setError('')

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
        event_date: eventDate || null,
        budget: budget ? parseFloat(budget) : null,
        notes: enquiry,
        dietary_requirements: dietary,
        allergens,
        inspo_image_url: inspoImageUrl,
        collection_type: 'pickup',
        status: 'new',
      }).select().single()

      if (orderError || !order) {
        setError('Failed to submit. Please try again.')
        setSubmitting(false)
        return
      }

      // Insert as a single custom order item
      await supabase.from('order_items').insert({
        order_id: order.id,
        product_name: 'Custom Enquiry',
        quantity: 1,
        notes: enquiry,
      })

      setSubmitted(true)
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f6f6]">
      <div className="text-gray-400 text-sm">Loading...</div>
    </div>
  )

  if (submitted) return (
    <div className="min-h-screen bg-[#f8f6f6] flex items-center justify-center font-sans px-4">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: `${accent}15` }}>
          <svg className="w-8 h-8" style={{ color: accent }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-extrabold text-slate-900 mb-2">Enquiry sent!</h2>
        <p className="text-slate-500 text-sm mb-6">
          Thanks {customerName.split(' ')[0]}! {baker.business_name} will be in touch at {customerEmail}.
        </p>
        <button onClick={() => router.push(`/${slug}`)}
          className="w-full text-white font-bold py-3 rounded-xl text-sm"
          style={{ backgroundColor: accent }}>
          Back to Profile
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f8f6f6] font-sans">
      <div className="max-w-md mx-auto bg-white min-h-screen shadow-xl flex flex-col">

        {/* Header */}
        <header className="flex items-center bg-white px-4 py-3 sticky top-0 z-10 border-b border-slate-100">
          <button onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 text-slate-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="ml-3">
            <h2 className="text-base font-bold text-slate-900">Send an Enquiry</h2>
            <p className="text-xs text-slate-400">{baker.business_name}</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-6 pb-32 space-y-5">

          <div className="p-4 rounded-xl border border-dashed"
            style={{ borderColor: `${accent}40`, backgroundColor: `${accent}06` }}>
            <p className="text-sm font-semibold" style={{ color: accent }}>Got something specific in mind?</p>
            <p className="text-xs text-slate-500 mt-1">
              Use this form for custom orders, unusual sizes, dietary needs, or anything that doesn't fit our standard products.
              For standard products, <button onClick={() => router.push(`/${slug}`)} className="underline font-semibold">browse the menu</button> and add to your basket.
            </p>
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
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Event Date</label>
            <input type="date" value={eventDate} min={minDate()}
              onChange={e => setEventDate(e.target.value)}
              className="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none bg-slate-50" />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Tell us what you want *</label>
            <textarea
              placeholder="Describe your ideal cake — size, style, colours, theme, how many people it needs to serve, anything special..."
              value={enquiry}
              onChange={e => setEnquiry(e.target.value)}
              rows={5}
              className="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none bg-slate-50 resize-none"
            />
          </div>

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
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Inspiration Image (optional)</label>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-gray-300 transition-all overflow-hidden mt-2">
              {inspoPreview ? (
                <div className="relative w-full h-full">
                  <img src={inspoPreview} alt="Inspiration" className="w-full h-full object-cover" />
                  <button type="button"
                    onClick={e => { e.preventDefault(); setInspoImage(null); setInspoPreview(null) }}
                    className="absolute top-2 right-2 bg-white rounded-full w-6 h-6 flex items-center justify-center shadow text-slate-500 text-xs font-bold">✕</button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-slate-400">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs font-medium">Tap to upload inspiration photo</span>
                </div>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </label>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200">
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-100 px-5 py-4 pb-6">
          <button
            onClick={handleSubmit}
            disabled={!customerName || !customerEmail || !enquiry || submitting}
            className="w-full text-white font-bold py-4 rounded-xl disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: accent }}>
            {submitting ? 'Sending...' : 'Send Enquiry'}
          </button>
        </footer>
      </div>
    </div>
  )
}
