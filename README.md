# MMSR Publications V2 — Next.js Production Web Portal

**MMSR Publications V2** is a state-of-the-art, high-performance academic and scientific publishing web application built with Next.js 15, TypeScript, TailwindCSS, and Framer Motion. It features a luxury Midnight Navy + Royal Gold design system, open-access book & journal catalogues, conference management, an author submission portal, real-time editorial screening workflows, razorpay payment integration, and a separate Admin CMS portal.

---

## 🏛️ System Architecture

- **Frontend**: Next.js 15 App Router, React 19, TypeScript, TailwindCSS, Framer Motion, Lucide Icons.
- **Backend API**: Decoupled Django REST Framework API communicating over HTTPS via Bearer JWT.
- **State Management**: React Context API (`AuthContext`, `CartContext`, `WishlistContext`).
- **Security & Authorization**: Isolated Admin Portal guarded by `AdminGuard` (requires `is_staff: true`). User Author Dashboard guarded by `AuthGuard`.

---

## 🛠️ Technology Stack

- **Framework**: Next.js 15.5
- **Language**: TypeScript 5.x
- **Styling**: Vanilla CSS, TailwindCSS (Custom Midnight Navy `#0B1220` + Royal Gold `#D4AF37` Palette)
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Payments**: Razorpay Checkout SDK
- **SEO & Structured Data**: Server-side `generateMetadata()`, JSON-LD Schema.org, dynamic `sitemap.xml`, and `robots.txt`

---

## 📁 Repository Directory Structure

```
MMSR V2/
├── app/                        # Next.js App Router pages & layouts
│   ├── (public)                # Public web pages (Home, Books, Journals, Conferences)
│   ├── admin/                  # Separate Admin Portal (Dashboard, Users, Submissions, CMS)
│   ├── dashboard/              # Author Portal (Profile, Submissions, Orders, Notifications)
│   ├── books/                  # Books Catalogue & Detail routes
│   ├── journals/               # Journals Catalogue & Issue archives
│   ├── conference/             # Academic Conferences & Symposiums
│   ├── cart/ & checkout/       # E-Commerce Cart & Razorpay Checkout
│   ├── submit-manuscript/      # Multipart Author Manuscript Submission Portal
│   ├── sitemap.ts & robots.ts  # SEO Crawler endpoints
│   ├── layout.tsx              # Root Layout with Metadata, JsonLd & Analytics
│   └── not-found.tsx           # Global 404 Error Boundary
├── components/                 # Reusable UI & Feature Components
│   ├── admin/                  # Admin Layout, Drawers, Email Template Preview
│   ├── books/                  # Book Cards, Filters, Search, Hero, Details
│   ├── journals/               # Journal Cards, Metrics, Issues, Editorial Board
│   ├── conference/             # Conference Speakers, Tracks, Dates, Hero
│   ├── dashboard/              # Author Layout, Status Badges, Activity Feed
│   ├── layout/                 # Navbar, Footer, Mobile Drawer
│   ├── ui/                     # Toast, Button, Badge, CookieConsent, Analytics
│   └── seo/                    # JsonLd Schema Generators
├── lib/                        # Services, Context, & Type Definitions
│   ├── context/                # AuthContext, CartContext, WishlistContext
│   ├── services/               # API clients (books, journals, cms, auth, etc.)
│   └── types/                  # TypeScript Data Schemas
├── public/                     # Static Brand Assets & Favicons
├── DEPLOYMENT.md               # Production Server Deployment Guide
├── .env.example                # Safe Environment Variables Template
└── README.md                   # System Documentation
```

---

## 🚀 Local Development Setup

### 1. Prerequisites
- Node.js `v18.17+` or `v20.x`
- Running Django backend (or `NEXT_PUBLIC_API_URL` pointing to backend)

### 2. Installation
```bash
# Clone repository and navigate to folder
cd "MMSR V2"

# Install npm dependencies
npm install
```

### 3. Environment Configuration
Create a `.env.local` file based on `.env.example`:
```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
```

### 4. Running Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📦 Production Build & Testing

```bash
# Type check application
npx tsc --noEmit

# Create optimized Next.js production build
npm run build

# Start production server
npm start
```

---

## 🌐 Complete Route Inventory

### Public Web Routes
- `/` & `/home` — Luxury Homepage with Hero Carousel, Featured Books, Journals, and CTA.
- `/books` & `/books/[id]` — Books & Monographs catalogue with search, filter pills, and detail view.
- `/journals` & `/journals/[slug]` — Scientific journals catalogue with volume issue archives & metrics.
- `/conference` & `/conference/[slug]` — Academic conferences with tracks, speakers, and paper call.
- `/services` — Institutional publishing services (DOI, indexing, editing).
- `/contact` — Contact editorial office & location details.
- `/publish-chapter` — Call for book chapter submissions.
- `/submit-manuscript` — Multipart paper submission form with PDF file upload.
- `/legal/privacy` & `/legal/terms` — Editorial ethics and privacy policies.

### Authentication Routes
- `/login` & `/register` — Author & Reader account creation and login.
- `/forgot-password` & `/reset-password` — Password recovery flow.

### Author Dashboard (`/dashboard/*`)
- `/dashboard` — Overview of submissions, recent orders, and activity stream.
- `/dashboard/submissions` & `/[id]` — Author manuscript submission tracking & decision dispatches.
- `/dashboard/orders` & `/[id]` — E-commerce order tracking, logistics timeline, and tax invoices.
- `/dashboard/notifications` — Real-time notification center with category filters and unread badges.
- `/dashboard/settings/notifications` — Email communication preference toggles.

### E-Commerce & Checkout
- `/cart` — Cart drawer & itemized summary.
- `/checkout` — Shipping address input & Razorpay gateway integration.
- `/payment/processing/[id]` & `/payment/success/[id]` — Razorpay verification callback handlers.
- `/wishlist` — Saved books and journals.

### Admin Portal (`/admin/*`)
- `/admin/login` — Isolated staff login.
- `/admin/dashboard` — Platform overview, editorial review metrics, and submission activity feed.
- `/admin/submissions` — Editorial screening drawer, 6 decision actions, notes editor, and Email Author panel.
- `/admin/users`, `/admin/books`, `/admin/journals`, `/admin/conferences`, `/admin/orders`, `/admin/payments`, `/admin/hero-slider`, `/admin/testimonials`, `/admin/settings`.

---

## ⚡ Known Backend Limitations & Informational States

1. **Email/SMTP Dispatch**: The frontend features a complete Email Author Panel and template preview library. Server-side email sending endpoints will be connected upon backend SMTP deployment.
2. **Conference API Availability**: If conference backend endpoints are unreachable, the UI degrades gracefully with informative fallback banners.
3. **Slider & Testimonial Mutations**: CMS management panels in the Admin Portal support frontend state editing; backend persistence endpoints will sync in backend Phase 11.

---

## 📄 License & Attribution

Copyright © MMSR Publications. All Rights Reserved.
