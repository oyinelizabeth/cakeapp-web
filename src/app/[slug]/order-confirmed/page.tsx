import Link from 'next/link'

export default function OrderConfirmed() {
  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-gray-900 flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-3 tracking-tight">
          Request Submitted!
        </h1>
        <p className="text-gray-500 text-base leading-relaxed mb-8">
          Your order request has been sent to the baker. They'll review it and get back to you with a quote shortly.
        </p>
        <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100 text-left mb-8">
          <h2 className="font-bold text-gray-900 mb-3">What happens next?</h2>
          <div className="space-y-3">
            {[
              ['1', 'The baker reviews your request', 'Usually within 24–48 hours'],
              ['2', "You'll receive a quote by email", 'With the final price and deposit details'],
              ['3', 'Pay your deposit to confirm', 'Your order is secured once the deposit is paid'],
              ['4', 'Enjoy your order!', 'The baker will fulfil your order on the agreed date'],
            ].map(([num, title, sub]) => (
              <div key={num} className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {num}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{title}</p>
                  <p className="text-xs text-gray-400">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-400">
          Keep an eye on your inbox. Check your spam folder if you don't hear back.
        </p>
      </div>
    </main>
  )
}
