export const APP_META = {
  name: 'LunaDash',
  version: '*Beta* 5.1.51',
  build: '26525.B2313',
  copyright: '© 2026 Glz Technical Services | Glz Tech',
  supportEmail: 'service@glztech.com',
  updateNotes: [
    'Updated Scheduling flow per location.',
    'Automated End of Day Performance Snapshots via Supabase Edge Functions.',
    'Normalized store IDs and access codes to uppercase across login and sync.',
    'Cleaned store access routing so assigned stores load their saved data.',
  ],
} as const
