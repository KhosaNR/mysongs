# Design System: My Songs

## Anti-AI-Generated Design Principles

The platform must avoid all common patterns associated with AI-generated websites. These patterns create a generic, template-like appearance that fails to establish authentic brand identity.

### Prohibited Design Patterns

**Visual Elements:**
* **NO purple/blue gradient themes** - The most recognizable AI-generated aesthetic; avoid entirely
* **NO emojis or emoticons in UI** - No emoticons in buttons, headings, navigation, or form labels
* **NO generic glassmorphism** - Avoid overused frosted glass effects and transparency overlays
* **NO cookie-cutter layouts** - Every page must feel intentionally designed for the specific artist brand
* **NO generic illustration styles** - Avoid flat abstract shapes and generic vector art
* **NO overused typography** - Avoid defaulting to Inter, Roboto, or Poppins without customization

**Content Patterns:**
* **NO emoji-heavy CTAs** - Buttons and calls-to-action must use text only
* **NO buzzword-heavy copy** - Avoid sanitized, generic marketing language
* **NO stock photo aesthetics** - Use authentic artist imagery and branding
* **NO generic micro-interactions** - Animations must serve brand identity, not just decoration

## Dynamic Theming Strategy

### Core Principles
* **Default dark theme:** Pure black background (#000000) as the primary canvas
* **Light mode support:** Toggle-able light theme with WCAG AA contrast ratios (minimum 4.5:1 for text)
* **Context-aware backgrounds:** The entire page background must dynamically reflect the currently playing content
* **Smooth transitions:** Background changes must animate smoothly during track/album transitions (300-500ms ease)

### Background Adaptation Rules

The page background must respond to the currently playing media in this priority order:

1. **Currently Playing Song** (highest priority)
   - Extract dominant colors from song/album artwork
   - Apply color palette as gradient or solid background
   - Match the mood/theme of the track if metadata available

2. **Currently Playing Album** (fallback)
   - Use album artwork color palette
   - Maintain consistency across all tracks in the album

3. **Currently Playing Artist** (default)
   - Use artist's brand colors from profile
   - Apply across all artist content when no specific track is playing

4. **User Selection** (override)
   - Allow users to manually select from available artist/album/song themes
   - Persist selection in user preferences
   - Provide reset option to return to dynamic theming

### Theme Implementation Requirements

**Color Extraction:**
* Use ColorThief or similar library to extract dominant colors from album artwork
* Cache extracted palettes to avoid repeated processing
* Fallback to artist brand colors if artwork unavailable

**Accessibility:**
* All text must maintain WCAG AA contrast ratios against dynamic backgrounds
* Provide text shadow/overlay options for low-contrast situations
* Test all color combinations for readability

**Performance:**
* Pre-load color palettes for next likely track (queue-aware)
* Use CSS custom properties for theme switching (no full page reload)
* Lazy-load artwork color extraction to avoid blocking playback

## Brand Differentiation

### South African Aesthetic
* **Authentic local culture** - Reflect South African design sensibilities, not generic global templates
* **Local color palettes** - Draw inspiration from SA landscapes, township art, and local design trends
* **Cultural specificity** - Avoid generic "world music" aesthetics

### Artist-Specific Theming
* Each artist profile can define custom brand colors
* Album art integration - Extract color palettes from album artwork for dynamic theming
* Artist can upload brand assets (logos, color schemes) via admin dashboard
* Fallback to platform defaults if artist doesn't customize

### No Generic Templates
* Every design decision must serve the artist's brand identity
* Avoid one-size-fits-all component styling
* Components must adapt to different brand personalities (minimal, vibrant, retro, etc.)

## Typography Specification

**Font stack** (loaded from Google Fonts in `src/index.html` with `display=swap`):
* `--font-family-primary`: **Inter** — body/UI text (weights 400–700)
* `--font-family-display`: **Hanken Grotesk** — wordmark + all headings (weights 400–700)
* `--font-family-mono`: **Fira Code** — code/labels (weights 400–600)

**Heading rules:**
* Display headings use `--font-family-display` at **`--weight-normal` (400)** — never bold/semibold. Small non-heading labels (eyebrows, buttons, badges, table headers, stat numbers, avatar initials) may stay at their own weights.
* Headings render in **`--text-heading`** (dark `#d4d4d4`, light `#3a3a3a`, high-contrast `#ffffff`) — a grey tone leaning white, never pure `--text-primary`.
* The brand wordmark uses display 400 + `letter-spacing: var(--tracking-tight)`.
* Material M3 inherits the stack via `brand-family`/`plain-family` CSS vars (see `_material-theme.scss`).

## Implementation Notes

### Technical Approach
* Use CSS custom properties (variables) for dynamic theming
* Implement theme service using Angular Signals for reactive updates
* Store theme preferences in Firestore user document
* Preload theme data with track metadata to avoid visual lag

### Component Guidelines
* All components must support dynamic theming via CSS variables
* Avoid hardcoded colors in component styles
* Use semantic color names (e.g., `--bg-primary`, `--text-primary`) not literal values
* Test all components in both dark and light modes
* **Empty states use one standard height platform-wide** — `app-empty-state` has no size variants; every "No X found" message renders with a 56×56px icon and `space-6`/`space-4` padding on every screen

### Responsive Considerations
* Theme must work across all breakpoints (mobile, tablet, desktop)
* Ensure text remains readable on small screens with dynamic backgrounds
* Test gradient/solid background transitions on mobile GPUs