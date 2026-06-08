// Shared time-of-day buckets, used by Analytics and the Trades report builder.
// Times are "HH:MM" 24h strings (the entryTime field format).

export const TIME_BUCKETS = [
  { label: '9:30–10', from: '09:30', to: '10:00' },
  { label: '10–11', from: '10:00', to: '11:00' },
  { label: '11–12', from: '11:00', to: '12:00' },
  { label: '12–2:30', from: '12:00', to: '14:30' },
  { label: 'PM', from: '14:30', to: '16:00' },
  { label: 'Globex', from: '16:00', to: '09:30' },
]

export const TIME_BUCKET_ORDER = ['9:30–10', '10–11', '11–12', '12–2:30', 'PM', 'Globex', 'Untimed']

export function bucketForTime(time) {
  if (!time) return 'Untimed'
  for (const b of TIME_BUCKETS.slice(0, 5)) if (time >= b.from && time < b.to) return b.label
  return 'Globex'
}
