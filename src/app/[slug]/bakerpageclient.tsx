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
