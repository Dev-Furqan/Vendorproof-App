# VendorProof Mobile Design Source

This file is the implementation source of truth for the Expo app. It is based only on the fetched Google Stitch output from `projects/11220652658320380900` and the real VendorProof web app tokens read from `E:\vendorproof\vendorproof`.

## Stitch Source

- Project: `projects/11220652658320380900`
- URL: `https://stitch.withgoogle.com/projects/11220652658320380900`
- Project title in Stitch: `VendorProof Compliance Manager`
- Device type: `MOBILE`
- Fetched assets folder: `stitch-output`
- Manifest: `stitch-output/manifest.json`
- Design system asset: `assets/333b3ef7b3ac4197b2b8c961f2fc84b0`

## Web App Tokens

These override the broader Stitch palette wherever the Expo implementation needs brand fidelity with the existing web app.

| Token | Value |
| --- | --- |
| `background` | `#05070d` |
| `surface` | `#0b111d` |
| `surfaceMuted` | `#111827` |
| `foreground` | `#f7f8fb` |
| `muted` | `#9ba6b6` |
| `accent` | `#22f2d2` |
| `accentForeground` | `#04100e` |
| `border` | `#202938` |
| `input` | `#050912` |
| `modalNavSurface` | `#080d16` |

Fonts:

- Display/headings: Geist Sans
- Body: Inter

Spacing:

- Tailwind default 4px scale
- Common mobile/card padding: 16px
- Common card radius: 8px to 12px
- Pill controls and badges: full radius

## Stitch Theme Notes

The Stitch design system is named `Executive Compliance`. It uses a dark, high-stakes compliance workspace style with teal primary actions, off-white text, rounded cards, subtle borders, and red/amber/green status semantics.

Stitch theme values observed in the project:

- Stitch background: `#111415`
- Stitch primary container/accent: `#2dd4bf`
- Stitch primary: `#57f1db`
- Stitch cards/surfaces: `#191c1d`, `#1d2021`, `#282a2b`, `#323536`
- Stitch text: `#e1e3e4`
- Stitch muted text: `#bacac5`
- Stitch outline: `#859490`, `#3c4a46`
- Stitch input note: `#030712`
- Stitch typography: Inter, with heavier headings and light body weights

Implementation rule: use the web tokens as the app theme, but preserve Stitch layout, component hierarchy, screen composition, and teal-on-dark compliance styling.

## Fetched Screens

| Screen | Stitch screen ID | Local HTML | Local Screenshot |
| --- | --- | --- | --- |
| Login / Auth | `a043f42a00874512b6b28e44affd4f1a` | `stitch-output/login-auth-a043f42a00874512b6b28e44affd4f1a.html` | `stitch-output/login-auth-a043f42a00874512b6b28e44affd4f1a.png` |
| Compliance Dashboard | `c65c87f514044b16aa46e54d08f3078d` | `stitch-output/compliance-dashboard-c65c87f514044b16aa46e54d08f3078d.html` | `stitch-output/compliance-dashboard-c65c87f514044b16aa46e54d08f3078d.png` |
| Properties List | `7dde97ca79704f429aa8bc5620e99c7d` | `stitch-output/properties-list-7dde97ca79704f429aa8bc5620e99c7d.html` | `stitch-output/properties-list-7dde97ca79704f429aa8bc5620e99c7d.png` |
| Vendors List | `0438ba14592a45c9a40660caf8e24e6c` | `stitch-output/vendors-list-0438ba14592a45c9a40660caf8e24e6c.html` | `stitch-output/vendors-list-0438ba14592a45c9a40660caf8e24e6c.png` |
| Document Review | `b4e4526b51b2459385af5ac7fef726b4` | `stitch-output/document-review-b4e4526b51b2459385af5ac7fef726b4.html` | `stitch-output/document-review-b4e4526b51b2459385af5ac7fef726b4.png` |
| Camera Capture | `8e5a87aaf86e43c4bb0c6a86eaa62090` | `stitch-output/camera-capture-8e5a87aaf86e43c4bb0c6a86eaa62090.html` | `stitch-output/camera-capture-8e5a87aaf86e43c4bb0c6a86eaa62090.png` |
| Notifications | `543f7d819a2b45bcb7b7ae28f202c825` | `stitch-output/notifications-543f7d819a2b45bcb7b7ae28f202c825.html` | `stitch-output/notifications-543f7d819a2b45bcb7b7ae28f202c825.png` |
| Profile & Settings | `7f22cf6a596e44479fd397bd82590cca` | `stitch-output/profile-settings-7f22cf6a596e44479fd397bd82590cca.html` | `stitch-output/profile-settings-7f22cf6a596e44479fd397bd82590cca.png` |
| VendorProof Compliance Management | `08deebff06e442c3b3a0ef203cfdf238` | `stitch-output/vendorproof-compliance-management-08deebff06e442c3b3a0ef203cfdf238.html` | No screenshot in Stitch output |

## Navigation Model

Use Expo Router with a protected app shell and bottom tabs:

- `/(auth)/login`
- `/(tabs)/index` for Compliance Dashboard
- `/(tabs)/properties`
- `/(tabs)/vendors`
- `/(tabs)/notifications`
- `/(tabs)/profile`
- `/documents/[documentId]`
- `/capture`

The Stitch output repeatedly shows bottom navigation for Dashboard/Home, Properties, Vendors, and Profile, with Notifications represented as a dedicated screen. In React Native, include Notifications as a tab because it is a core mobile-native workflow.

## Component Rules

- App background: `bg-background`.
- Primary cards: `bg-surface` with `border-border`.
- Raised/muted cards: `bg-surface-muted` with subtle border.
- Inputs: `bg-input`, `border-border`, teal focus.
- Primary buttons: `bg-accent`, `text-accentForeground`, 48px minimum height.
- Secondary buttons: transparent or surface fill, teal/border treatment.
- Bottom tab bar: `bg-modalNavSurface`, top border `border-border`, compact labels.
- Header wordmark: teal `VendorProof`, not a marketing hero.
- Dashboard stat cards: three-up compact row for Compliant, Expiring, Missing.
- Status badges: pill radius, 1px border, tinted background, small leading dot or icon.
- Camera screen: full-screen camera layer, document-frame guide overlay, capture action centered, gallery/retake actions secondary.
- Document review: split visual hierarchy from Stitch where document preview is prominent, AI fields are editable and labeled `AI-extracted, please confirm`, with Approve and Request Resubmission as distinct actions.

## Status Colors

Use these semantic colors while preserving the dark VendorProof theme:

- Compliant/approved: green/emerald tint, `#6ee7b7` text where needed.
- Expiring soon/warning: amber tint, `#fcd34d` text where needed.
- Missing/deficient/rejected: rose/red tint, `#fda4af` text where needed.
- Uploaded/under review: sky tint, `#7dd3fc` text where needed.
- Neutral/never responded: low-opacity white/zinc tint.

## Screen Implementation Notes

- Login/Auth: centered auth card, VendorProof title, email/password fields, primary sign-in, Google OAuth button, support text.
- Compliance Dashboard: portfolio header, hero stats for compliant/expiring/missing, needs-attention list with urgent expiration rows, bottom tabs.
- Properties List: property cards with compliance counts such as `24/26 Compliant`, status summary, detail drill-in.
- Vendors List: searchable/filterable list with chips: All, Expiring Soon, Missing, Compliant; row badges for each vendor state.
- Document Review: document thumbnail/preview, extracted fields, checklist, internal note, approve/request resubmission actions.
- Camera Capture: full-screen capture experience with document guide, capture control, gallery fallback, preview flow.
- Notifications: grouped alerts and reminder-style events, unread emphasis, tap-through to relevant records.
- Profile & Settings: team/user profile, organization details, notification preferences, location/org info, sign out.

## Implementation Constraints

- Do not introduce a new backend. Use the same Supabase tables and RLS policies as the web app.
- Do not use direct OpenAI/Claude keys. AI extraction uses OpenRouter from the mobile upload flow.
- Do not auto-approve AI extraction results.
- Keep spacing, rounded cards, color semantics, and operational density aligned with this file and the fetched Stitch HTML.
