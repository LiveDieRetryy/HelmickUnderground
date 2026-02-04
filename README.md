# Helmick Underground LLC - Enterprise Website & Admin Platform

Professional website and comprehensive admin dashboard for Helmick Underground LLC - Underground Utility Services serving Iowa since 1988.

## 🚀 Project Overview

A modern, full-stack web application featuring:
- **Public-facing website** with service information and contact forms
- **Secure admin dashboard** for customer, project, and invoice management
- **Progressive Web App (PWA)** with offline support
- **Mobile-optimized** responsive design (320px - 2560px)
- **Enterprise-grade security** with JWT authentication and CSRF protection

## ✨ Key Features

### Public Website
- 🎨 Modern responsive design with smooth animations
- 📱 Mobile-first with 44px touch targets
- 🖼️ Gallery with lazy-loaded images
- 📧 Contact form with real-time validation
- 🔍 SEO optimized with schema markup
- 📊 Google Analytics integration
- ⚡ Service worker for offline access
- 📲 PWA installable on iOS and Android

### Admin Dashboard
- 🔐 JWT authentication with bcrypt password hashing
- 👥 Customer management with search and filtering
- 📂 Project tracking with file uploads
- 💰 Invoice generation and management
- 📧 Email quote builder with PDF support
- 📬 Contact form submission inbox
- 📊 Analytics dashboard with charts
- 🎨 PDF redline editor with touch support
- 📅 Schedule management
- 🔍 Fuzzy search with Fuse.js
- 📝 Activity logging for audit trail
- 🔄 Optimistic UI updates
- 📱 Full mobile optimization

### Security Features
- 🔒 JWT authentication with secure HTTP-only cookies
- 🛡️ CSRF protection on all state-changing operations
- ⏱️ Rate limiting (3-120 requests/window)
- 🔑 Bcrypt password hashing (10 rounds)
- 🌐 Security headers (CSP, HSTS, X-Frame-Options)
- 🚫 Input validation and sanitization

### Performance Optimizations
- ⚡ Vercel Edge CDN with optimized cache headers
- 🖼️ Lazy loading images (60-80% load reduction)
- 💾 Service worker caching (v1.1.0)
- 🗜️ Gzip compression via Vercel
- 🔄 Database query optimization
- 📊 Core Web Vitals tracking (LCP, FID, CLS)
- 🎯 Lighthouse score: 96/100

### Mobile Enhancements
- 📲 Pull-to-refresh on data lists
- 📡 Network status monitoring
- 📳 Haptic feedback (6 vibration patterns)
- 🍎 iOS "Add to Home Screen" guide
- 🖐️ Pinch-to-zoom canvas support
- 📱 Screen wake lock API
- 🎯 Device capability detection

## 🛠️ Technology Stack

### Frontend
- **HTML5/CSS3/JavaScript** - Vanilla JS (no framework bloat)
- **Chart.js** - Analytics visualization
- **Fuse.js** - Fuzzy search
- **PDF.js** - PDF rendering and editing

### Backend
- **Node.js** - Serverless functions (Vercel)
- **PostgreSQL** - Database (Vercel Postgres)
- **JWT** - Authentication (jsonwebtoken)
- **Bcrypt** - Password hashing (bcryptjs)

### DevOps
- **Vercel** - Hosting and deployment
- **Jest** - Unit testing
- **Git** - Version control

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- PostgreSQL database (Vercel Postgres recommended)

### Setup Steps

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/helmick-underground.git
cd helmick-underground
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
# Edit .env with your actual values
```

4. **Generate JWT secret**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

5. **Generate admin password hash**
```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('YourPassword123', 10).then(console.log)"
```

6. **Set up database**
- Create Vercel Postgres database
- Copy connection strings to .env
- Database tables will be created automatically on first API call

7. **Run tests**
```bash
npm test
```

8. **Start development server**
```bash
npm run dev
# or
vercel dev
```

## 🚀 Deployment

### Deploy to Vercel (Recommended)

1. **Install Vercel CLI**
```bash
npm i -g vercel
```

2. **Login to Vercel**
```bash
vercel login
```

3. **Set environment variables**
```bash
# Via Vercel Dashboard: Settings > Environment Variables
# Or via CLI:
vercel env add JWT_SECRET
vercel env add ADMIN_PASSWORD_HASH
vercel env add POSTGRES_URL
```

4. **Deploy to production**
```bash
vercel --prod
```

5. **Verify deployment**
- Check service worker: DevTools → Application → Service Workers
- Test PWA install prompt (Chrome, Safari)
- Verify admin login works
- Check analytics tracking

## 📚 Documentation

- **[OPTIMIZATION_SUMMARY.txt](OPTIMIZATION_SUMMARY.txt)** - Complete optimization report (44/45 items)
- **[MOBILE_FEATURES_GUIDE.txt](MOBILE_FEATURES_GUIDE.txt)** - Mobile feature documentation
- **[OPTIMIZATION_TODO_LIST.txt](OPTIMIZATION_TODO_LIST.txt)** - Detailed implementation notes
- **[DEPLOYMENT_INSTRUCTIONS.txt](DEPLOYMENT_INSTRUCTIONS.txt)** - Deployment guide
- **[ADMIN_GALLERY_GUIDE.txt](ADMIN_GALLERY_GUIDE.txt)** - Gallery management

## 🧪 Testing

### Run All Tests
```bash
npm test
```

### Run Specific Test Suite
```bash
npm test -- cache-manager
npm test -- form-validation
npm test -- error-handler
```

### Manual Testing Checklist
- [ ] Public website responsive (320px - 2560px)
- [ ] Contact form submission
- [ ] Admin login with JWT
- [ ] Customer CRUD operations
- [ ] Project file uploads
- [ ] Invoice generation
- [ ] Email sending
- [ ] PWA install prompt
- [ ] Offline mode
- [ ] Mobile touch interactions

## 📱 Browser Support

| Feature | Chrome | Safari | Firefox | Edge | Mobile |
|---------|--------|--------|---------|------|--------|
| Core functionality | ✅ | ✅ | ✅ | ✅ | ✅ |
| Service worker | ✅ | ✅ | ✅ | ✅ | ✅ |
| PWA install | ✅ | ✅ (iOS 16.4+) | ❌ | ✅ | ✅ |
| Push notifications | ✅ | ❌ | ✅ | ✅ | ✅ Android |
| Haptic feedback | ✅ | ✅ iOS 13+ | Limited | ✅ | ✅ |
| Wake lock | ✅ | ❌ | Experimental | ✅ | ✅ Android |

## 🔒 Security

### Authentication Flow
1. User submits credentials to `/api/auth` (login)
2. Server validates with bcrypt, generates JWT
3. JWT stored in HTTP-only secure cookie
4. CSRF token generated and sent to client
5. All mutations require valid JWT + CSRF token
6. Rate limiting prevents brute force attacks

### Security Headers
- `Content-Security-Policy` - Prevents XSS attacks
- `Strict-Transport-Security` - Forces HTTPS
- `X-Frame-Options` - Prevents clickjacking
- `X-Content-Type-Options` - Prevents MIME sniffing
- `Referrer-Policy` - Controls referrer information

### Data Protection
- Passwords hashed with bcrypt (10 rounds)
- JWT tokens expire after 24 hours
- CSRF tokens rotate on each request
- Rate limiting on sensitive endpoints
- SQL injection prevention via parameterized queries

## 📊 Performance Metrics

### Before Optimization
- Initial Load: 3.5s
- Time to Interactive: 4.2s
- Lighthouse: 72/100

### After Optimization (Current)
- Initial Load: 1.8s (-49%) ⚡
- Time to Interactive: 2.1s (-50%) ⚡
- Lighthouse: 96/100 (+33%) ⚡
- Mobile Score: 100/100 (+47%) ⚡

### Core Web Vitals
- **LCP** (Largest Contentful Paint): < 2.5s ✅
- **FID** (First Input Delay): < 100ms ✅
- **CLS** (Cumulative Layout Shift): < 0.1 ✅

## 🛠️ Development

### Project Structure
```
helmick-underground/
├── admin/              # Admin dashboard pages
│   ├── customers.html
│   ├── invoices.html
│   ├── inbox.html
│   └── ...
├── api/                # Serverless API functions
│   ├── auth.js
│   ├── customers.js
│   ├── projects.js
│   └── ...
├── services/           # Service detail pages
├── images/             # Image assets
├── videos/             # Video assets
├── tests/              # Jest unit tests
├── index.html          # Homepage
├── service-worker.js   # PWA offline support
├── manifest.json       # PWA manifest
└── package.json        # Dependencies
```

### NPM Scripts
```json
{
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "dev": "vercel dev",
  "build": "vercel build",
  "deploy": "vercel --prod"
}
```

### Code Quality
- ✅ 95%+ JSDoc coverage
- ✅ Consistent error handling
- ✅ Shared utilities (admin/utils.js)
- ✅ Unit tests for critical paths
- ✅ WCAG 2.1 AA accessibility

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

© 2026 Helmick Underground LLC. All rights reserved.

## 📞 Contact

**Helmick Underground LLC**
- 📍 Mount Vernon, Iowa 52314
- 📞 Tommy Helmick: 319-721-9925
- 📞 Travis Helmick: 319-551-4323
- 🌐 [helmickunderground.com](https://helmickunderground.com)

---

**Project Status:** ✅ Production Ready (98% Complete - 44/45 items)
**Last Updated:** February 4, 2026

