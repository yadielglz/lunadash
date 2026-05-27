export const APP_META = {
  name: 'LunaDash',
  version: '5.2.3',
  build: '26526.2045',
  copyright: '© 2026 Glz Technical Services | Glz Tech',
  supportEmail: 'service@glztech.com',
  updateNotes: [
    'Added support for Net Revenue Calculator.',
    'Updated Store Icons with Luna Wireless',
    'Automated End of Day Performance Snapshots via Supabase Edge Functions.',
    'Normalized store IDs and access codes to uppercase across login and sync.',
    'Cleaned store access routing so assigned stores load their saved data.',
  ],
} as const
