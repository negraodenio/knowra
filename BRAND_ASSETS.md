# KNOWRA — Brand Asset Specifications & Production Guidelines

## 1. Approved Brand Identity

* **Brand Name**: KNOWRA
* **Approved Symbol**: Candidate 03 — Monolithic Gateway K
* **Primary Tagline**: *"Learn what you need. Not what everyone else gets."*
* **Product Thesis**: *"LLMs know things. Knowra knows what the learner knows."*

The approved identity combines a monolithic vertical stem with a calibrated 45° gateway facet, coupled to bold geometric diagonal arms via a stepped 45° offset notch. This conveys precision, architectural stability, and adaptive intelligence.

---

## 2. Official Brand Palette

| Role | Color Name | HEX Code | Tailwind Token | Application |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Canvas** | Deep Graphite | `#07090E` | `bg-[#07090E]` | Base application background, page container |
| **Card / Surface** | Obsidian Card | `#0C1018` | `bg-[#0C1018]` | Elevated cards, forms, modules |
| **Surface Accent** | Slate Trench | `#131824` | `bg-[#131824]` | Hover states, tab backgrounds |
| **Primary Typography**| Warm Ivory | `#F4F1EA` | `text-[#F4F1EA]` | Primary headlines, logo mark, high-contrast text |
| **Secondary Typography**| Muted Slate | `#94A3B8` | `text-slate-400` | Subtitles, descriptions, captions |
| **Restrained Accent** | Precision Copper | `#C87D55` | `text-[#C87D55]` | Subtle borders, active tags, focus indicators |
| **Subtle Border** | Translucent Rim | `rgba(255,255,255,0.08)` | `border-white/[0.08]` | Minimal division lines, card borders |

---

## 3. Production Asset Inventory

All production assets reside in `public/brand/` and are synchronized to standard application entrypoints.

| Asset Filename | Format | Dimensions / ViewBox | Intended Use |
| :--- | :--- | :--- | :--- |
| `knowra-symbol.svg` | SVG | `0 0 128 128` | Pure vector symbol, transparent background, responsive scaling |
| `knowra-symbol-mono.svg`| SVG | `0 0 128 128` | Pure black monochrome symbol for single-color print/docs |
| `knowra-wordmark.svg` | SVG | `0 0 320 64` | Pure vector geometric uppercase wordmark without font dependencies |
| `knowra-logo-horizontal.svg` | SVG | `0 0 440 64` | Master balanced horizontal lockup (Symbol + Wordmark) |
| `knowra-logo-light.svg`| SVG | `0 0 440 64` | Graphite `#07090E` mark for light surfaces and invoices |
| `knowra-logo-dark.svg` | SVG | `0 0 440 64` | Warm Ivory `#F4F1EA` mark with `#07090E` container for dark theme |
| `knowra-icon.png` | PNG | `512 x 512` | High-resolution raster app icon with squircle container |
| `apple-touch-icon.png`| PNG | `180 x 180` | iOS home screen bookmark icon |
| `favicon.svg` | SVG | `0 0 128 128` | Modern browser vector favicon |
| `favicon.ico` | ICO | `32 x 32` | Legacy browser favicon in `public/` and `app/` |

---

## 4. Vector Geometry & SVG Path Specifications

The Monolithic Gateway K is constructed on a **128 × 128 pixel grid** with mathematical 45° angle alignment:

### A. Monolithic Vertical Stem
* **Stem Width**: 38 px
* **Apex Projection**: Reaches x=52 at y=64 (14 px outward chevron)
* **Path Definition**:
  ```svg
  <path d="M 0 0 L 38 0 L 38 50 L 52 64 L 38 78 L 38 128 L 0 128 Z" fill="currentColor" />
  ```

### B. Geometric Diagonal Arms with 45° Stepped Notch
* **Arm Horizontal Width at Cap & Baseline**: 39 px (from x=89 to x=128)
* **Gateway Channel**: Uniform 10 px horizontal spacing parallel to the stem facet
* **Inner Apex Notch**: Reaches x=62 at y=64
* **Right Inner V Corner**: Reaches x=72 at y=64
* **Path Definition**:
  ```svg
  <path d="M 89 0 L 128 0 L 72 64 L 128 128 L 89 128 L 45 84 L 48 78 L 62 64 L 48 50 L 45 44 Z" fill="currentColor" />
  ```

---

## 5. Clear-Space & Minimum Size Recommendations

* **Clear Space**: Maintain a minimum exclusion zone equal to half the stem width (`19 px` on a 128px scale, or `0.15 × height`) around all sides of the mark.
* **Minimum Size (Digital)**:
  * Symbol: `16 × 16 px`
  * Horizontal Lockup: `24 px` height (`165 px` width)
* **Favicon Scaling**: Downscaled to 16px, 32px, and 48px with anti-aliasing preserved.

---

## 6. Implementation Notes & Known Boundaries

* No third-party font file is required to render the vector wordmark; all letterforms are drawn as SVG path commands.
* This documentation covers visual asset implementation and interface integration. It does not imply trademark clearance, legal uniqueness, or statutory trademark registration.
