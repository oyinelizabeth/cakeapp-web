'use client'

import { useState } from 'react'

type Props = {
  slug: string
  accent: string
  blockedDates: string[]
  workingDays: string[]
  leadTimeDays: number
}

const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']
const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

export default function BakerPageClient({ slug, accent, blockedDates, workingDays, leadTimeDays }: Props) {
  const [showCalendar, setShowCalendar] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const getEarliestDate = () => {
    const d = new Date()
    d.setDate(d.getDate() + leadTimeDays)
    return d.toISOString().split('T')[0]
  }

  const earliestStr = getEarliestDate()

  const isAvailable = (dateStr: string) => {
    if (dateStr < earliestStr) return false
    if (blockedDates.includes(dateStr)) return false
    const dayName = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long' })
    return workingDays.includes(dayName)
  }

  const isBlocked = (dateStr: string) => {
    if (dateStr < earliestStr) return false
    return blockedDates.includes(dateStr)
  }

  const isWorkingDay = (dateStr: string) => {
    const dayName = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long' })
    return workingDays.includes(dayName)
  }

  const getDateStr = (day: number) =>
    `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const getDaysInMonth = () => {
    const firstDay = new Date(currentYear, currentMonth, 1)
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    let startOffset = firstDay.getDay() - 1
    if (startOffset < 0) startOffset = 6
    return { daysInMonth, startOffset }
  }

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
    else setCurrentMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
    else setCurrentMonth(m => m + 1)
  }

  const canGoPrev = () => {
    return !(currentMonth === today.getMonth() && currentYear === today.getFullYear())
  }

  const { daysInMonth, startOffset } = getDaysInMonth()

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-extrabold">Availability</h2>
        <button
          onClick={() => setShowCalendar(v => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all"
          style={showCalendar
            ? { backgroundColor: accent, color: '#fff', borderColor: accent }
            : { backgroundColor: '#fff', color: '#374151', borderColor: '#e5e7eb' }
          }
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {showCalendar ? 'Hide Calendar' : 'View Calendar'}
        </button>
      </div>

      {showCalendar && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Month navigation */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <button
              onClick={prevMonth}
              disabled={!canGoPrev()}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 disabled:opacity-30 hover:bg-gray-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="font-bold text-base">{MONTHS[currentMonth]} {currentYear}</span>
            <button
              onClick={nextMonth}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 px-3 pt-3 pb-1">
            {DAY_LABELS.map(d => (
              <div key={d} className="text-center text-xs font-bold text-gray-300 py-1">{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7 px-3 pb-4 gap-1">
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`e-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = getDateStr(day)
              const isPast = dateStr < todayStr
              const isTooSoon = dateStr >= todayStr && dateStr < earliestStr
              const available = isAvailable(dateStr)
              const blocked = isBlocked(dateStr)
              const working = isWorkingDay(dateStr)
              const isToday = dateStr === todayStr

              let cellStyle: React.CSSProperties = {}
              let textStyle: React.CSSProperties = {}
              let title = ''

              if (available) {
                cellStyle = { backgroundColor: `${accent}18`, borderRadius: '10px' }
                textStyle = { color: accent, fontWeight: 700 }
                title = 'Available'
              } else if (blocked) {
                cellStyle = { backgroundColor: '#f1f5f9', borderRadius: '10px' }
                textStyle = { color: '#94a3b8' }
                title = 'Unavailable'
              } else if (isPast || isTooSoon || !working) {
                textStyle = { color: '#d1d5db' }
              }

              if (isToday) {
                cellStyle = { ...cellStyle, outline: `2px solid ${accent}`, outlineOffset: '1px', borderRadius: '10px' }
              }

              return (
                <div key={day}
                  title={title}
                  style={cellStyle}
                  className="aspect-square flex flex-col items-center justify-center relative"
                >
                  <span className="text-sm" style={textStyle}>{day}</span>
                  {available && (
                    <span className="w-1 h-1 rounded-full mt-0.5" style={{ backgroundColor: accent }} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-5 px-5 py-3 border-t border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `${accent}60` }} />
              <span className="text-xs text-slate-500 font-medium">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-200" />
              <span className="text-xs text-slate-500 font-medium">Unavailable</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-100" />
              <span className="text-xs text-slate-500 font-medium">Not working</span>
            </div>
          </div>

          {/* Notice */}
          <div className="px-5 py-3 bg-amber-50 border-t border-amber-100">
            <p className="text-xs text-amber-700 font-medium">
              Minimum {leadTimeDays} days notice required. Select your date when placing your order.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}

export function OrderPopupButton({ slug, accent }: { slug: string; accent: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Sticky button */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden px-4 pb-6 pt-3 bg-gradient-to-t from-[#f5f4f2] to-transparent pointer-events-none">
        <button
          onClick={() => setOpen(true)}
          className="pointer-events-auto w-full flex items-center justify-center gap-2 text-white py-4 rounded-2xl font-bold text-sm shadow-xl hover:opacity-90 transition-opacity"
          style={{ backgroundColor: accent }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Place an Order
        </button>
      </div>

      {/* Popup overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center px-4 pb-6 md:pb-0"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />

            <h3 className="text-lg font-extrabold text-slate-900 mb-1">How would you like to order?</h3>
            <p className="text-sm text-slate-400 mb-6">Browse the menu to pick a product, or send an enquiry for something custom.</p>

            <div className="flex flex-col gap-3">
              <a
                href={`/${slug}/menu`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 hover:border-gray-200 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${accent}15` }}>
                  <svg className="w-5 h-5" style={{ color: accent }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-900">Browse the Menu</p>
                  <p className="text-xs text-slate-400 mt-0.5">Pick a cake from our product listings</p>
                </div>
                <svg className="w-4 h-4 text-gray-300 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>

              <a
                href={`/${slug}/order`}
                className="flex items-center gap-4 p-4 rounded-2xl border-2 transition-colors"
                style={{ borderColor: `${accent}40`, backgroundColor: `${accent}08` }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${accent}20` }}>
                  <svg className="w-5 h-5" style={{ color: accent }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-sm" style={{ color: accent }}>Send an Enquiry</p>
                  <p className="text-xs text-slate-400 mt-0.5">For custom or bespoke orders</p>
                </div>
                <svg className="w-4 h-4 ml-auto" style={{ color: `${accent}80` }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>

            <button
              onClick={() => setOpen(false)}
              className="mt-4 w-full py-3 rounded-2xl text-sm font-semibold text-slate-400 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  )
}
