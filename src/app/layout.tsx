import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CakeApp',
  description: 'Order custom cakes from local bakers',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
