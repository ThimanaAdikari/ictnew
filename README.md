# ICT Experts — Complete ICT Class Performance Management System

Premium, modern, professional educational dashboard for ICT tuition classes. Built with Node.js, Express, Supabase (PostgreSQL + Auth), Chart.js, and Bootstrap 5.

## Features

- **Two roles**: Admin and Student with secure Row Level Security
- **Admin Dashboard**: total students, papers, results, avg performance, top performers, recent results
- **Student Dashboard**: personal progress line chart, bar comparison, available papers, marks entry
- **Paper Management**: create, edit, delete, search, filter by type/date, class average per paper
- **Student Management**: add, edit, delete students, view individual profile with charts
- **Results**: students enter marks for papers, validation (0-max), duplicate handling as retake attempts
- **Charts**: progress line (chronological), performance bar, class average, distribution doughnut
- **Reports**: class average per exam, ranking, improving/declining students, papers with lowest avg, CSV export
- **Security**: Supabase RLS, role-based auth on server, no service-role keys in frontend, rate limiting, Helmet

## Tech Stack

- Frontend: HTML5, CSS3, vanilla JS, Bootstrap 5, Bootstrap Icons, Chart.js
- Backend: Node.js + Express
- Database & Auth: Supabase PostgreSQL + Supabase Auth
- Charts: Chart.js 4
- Security: Helmet, express-rate-limit, RLS policies

## Project Structure

```
ict-experts/
├── public/
│   ├── index.html              # Landing
│   ├── login.html              # Login
│   ├── admin-dashboard.html    # Admin overview
│   ├── students.html           # Student management
│   ├── papers.html             # Paper management
│   ├── student-dashboard.html  # Student home
│   ├── student-profile.html    # Admin view of student detail
│   ├── reports.html            # Class reports & CSV
│   ├── css/style.css           # Premium black-white + blue theme
│   └── js/
│       ├── config.js           # Supabase client & helpers
│       ├── auth.js             # Login/logout/protectPage
│       ├── admin.js            # Admin dashboard stats
│       ├── student.js          # Student dashboard logic
│       ├── papers.js           # Paper CRUD UI
│       ├── charts.js           # Chart.js helpers
│       └── reports.js          # Reports & CSV export
├── src/
│   ├── server.js               # Express server + Supabase clients + setup endpoint
│   ├── middleware/auth.js      # verifyAuth, requireAdmin
│   └── routes/
│       ├── students.js         # Student CRUD, stats
│       ├── papers.js           # Paper CRUD + stats
│       └── results.js          # Results CRUD + overview stats
├── supabase/
│   └── schema.sql              # Tables, triggers, RLS policies, helper functions
├── scripts/
│   └── create-admin.js         # CLI helper to create first admin
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Installation

### 1. Install Node.js

Requires Node >=18. Download from https://nodejs.org

### 2. Install dependencies

```bash
npm install
```

### 3. Create Supabase Project

- Go to https://app.supabase.com → New Project
- Copy Project URL and anon key + service_role key from Project Settings → API
- In SQL Editor, paste and run `supabase/schema.sql` (entire file)

### 4. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=3000
SESSION_SECRET=random-long-string-32chars
ADMIN_SETUP_KEY=change-me-to-secure-random-key
```

### 5. Configure Frontend Supabase URL

The frontend needs anon key + URL. You have two options:

**Option A (quick, recommended for local):**

Create `public/js/env.js` (not committed) or set localStorage in browser console:

```js
localStorage.setItem('SUPABASE_URL','https://your-project.supabase.co')
localStorage.setItem('SUPABASE_ANON_KEY','your-anon-key')
```

Or inject via `window.__ENV__` in HTML (edit `public/index.html` head):

```html
<script>window.__ENV__={SUPABASE_URL:'...',SUPABASE_ANON_KEY:'...'}</script>
```

**Option B (server injection):**

Modify `src/server.js` to serve env.js dynamically if needed.

### 6. Create First Admin Account

**Secure method 1: via API endpoint (uses ADMIN_SETUP_KEY)**

```bash
curl -X POST http://localhost:3000/api/setup/admin \
  -H "Content-Type: application/json" \
  -d '{
    "setupKey": "your-ADMIN_SETUP_KEY from .env",
    "email": "admin@ictexperts.lk",
    "password": "StrongPass123!",
    "fullName": "Admin User",
    "studentCode": "ADMIN001"
  }'
```

**Secure method 2: via Supabase Dashboard**

- Authentication → Add User → Create user with email/password
- Then in Table Editor → profiles → Insert row with same id as auth user, role='admin'

**Method 3: via CLI script**

```bash
node scripts/create-admin.js
# It will prompt for details and use service_role key
```

### 7. Start Locally

```bash
npm run dev   # with nodemon auto-reload
# or
npm start
```

Open:

- Landing: http://localhost:3000/
- Login: http://localhost:3000/login.html
- Admin: http://localhost:3000/admin-dashboard.html
- Student: http://localhost:3000/student-dashboard.html

### 8. Add Students and Papers

- Login as admin → Students → Add Student (email, password, full name, student code)
- Papers → Add Paper (name, type, category, max marks, exam date, description)
- Students login → Student Dashboard → Enter Marks → Select paper → Submit

### 9. How Students Enter Marks

1. Login with student credentials
2. Dashboard shows Available Papers (papers not yet completed)
3. Click Add Result or Enter Marks → Select paper → Enter marks (validated 0-max)
4. Charts update automatically, recent results table updates

If retake: submitting same paper again creates new attempt (attempt_number increments), clearly labeled.

### 10. Deploy Securely

- **Never commit .env** (already gitignored)
- Set env vars in hosting provider (Vercel, Render, Railway, Fly.io)
- Ensure `SUPABASE_SERVICE_ROLE_KEY` only on server, never exposed to browser
- Enable RLS (already in schema.sql)
- Use HTTPS
- Set strong SESSION_SECRET and ADMIN_SETUP_KEY
- After first admin created, disable or change ADMIN_SETUP_KEY or remove `/api/setup/admin` route in production

Example Dockerfile deploy not required; Express serves static `public/` folder.

## Security Notes

- Frontend uses anon key only, RLS enforces ownership
- Backend verifies JWT via `supabaseAdmin.auth.getUser(token)` and checks `profiles.role`
- All protected API routes use `verifyAuth` middleware, admin routes also `requireAdmin`
- Marks validation at DB trigger + API + frontend
- Rate limiting on auth endpoints
- Passwords stored only in Supabase Auth, never in profiles table

## Sample Paper Names

- ICT Model Paper 01
- ICT Past Paper 2023
- ICT Term Test 01
- Database Management Test
- Networking Revision Paper

## CSV Export

Admin → Reports → Export CSV → downloads `ict-experts-report-YYYY-MM-DD.csv` with students ranking and paper stats.

## License

MIT
