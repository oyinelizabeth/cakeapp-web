'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Props = { slug: string; accent: string }

export default function BasketButton({ slug, accent }: Props) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const update = () => {
      try {
        const cart = JSON.parse(localStorage.getItem(`cart_${slug}`) || '[]')
        setCount(cart.length)
      } catch { setCount(0) }
    }
    update()
    window.addEventListener('cart_updated', update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener('cart_updated', update)
      window.removeEventListener('storage', update)
    }
  }, [slug])

  if (count === 0) return (
    <Link href={`/${slug}/order`}
      className="text-white px-4 py-2 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
      style={{ backgroundColor: accent }}>
      Request an Order
    </Link>
  )

  return (
    <Link href={`/${slug}/basket`}
      className="relative flex items-center gap-2 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
      style={{ backgroundColor: accent }}>
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      View Basket
      <span className="bg-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
        style={{ color: accent }}>{count}</span>
    </Link>
  )
}
