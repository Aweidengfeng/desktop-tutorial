# Design System 2026

## Design Tokens

### Color Palette
```
--summit-primary: #1a5c38      /* Alpine green */
--summit-secondary: #2d7a52    /* Forest green */
--summit-accent: #f97316       /* Climbing orange */
--summit-danger: #ef4444       /* Alert red */
--summit-gold: #f59e0b         /* Badge gold */
--summit-silver: #94a3b8       /* Badge silver */
--summit-bronze: #92400e       /* Badge bronze */
--summit-platinum: #7c3aed     /* Badge platinum */
--summit-bg: #0f172a           /* Dark background */
--summit-surface: #1e293b      /* Card surface */
--summit-text: #f1f5f9         /* Primary text */
--summit-muted: #94a3b8        /* Muted text */
```

### Typography
- Display: `font-size: 2.25rem; font-weight: 700; line-height: 1.2`
- Heading 1: `font-size: 1.875rem; font-weight: 700`
- Heading 2: `font-size: 1.5rem; font-weight: 600`
- Body: `font-size: 1rem; line-height: 1.6`
- Caption: `font-size: 0.875rem; color: var(--summit-muted)`

### Spacing Scale
`4px · 8px · 12px · 16px · 24px · 32px · 48px · 64px`

### Border Radius
- Card: `12px`
- Button: `8px`
- Badge: `999px` (pill)
- Avatar: `50%`

## Component Specs

### Badge Component
```
Tiers: bronze | silver | gold | platinum
Sizes: sm (24px) | md (40px) | lg (64px)
States: locked (grayscale) | unlocked (full color) | progress (partial fill)
```

### Feed Card
```
Width: 100% (max 680px)
Image: 16:9 aspect ratio
Actions: Like | Comment | Save | Share
Cursor-based pagination (nextCursor)
```

### Mountain Detail Card
```
Hero image: full-width
Stats strip: altitude | footprints | wishlists
Tabs: Overview | Routes | Footprints | Stories
```

### Chat Bubble
```
Own: right-aligned, primary color
Other: left-aligned, surface color
Recalled: italic placeholder text
Reply: quoted block above bubble
```
