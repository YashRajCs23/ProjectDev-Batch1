# 🚗 RideBook — Full-Stack Uber/Ola Clone

A production-ready ride booking system with Private Rides, Shared Cabs, Driver Dashboard, Admin Panel, Geoapify Maps, Razorpay Payments, Socket.io real-time tracking, and SOS emergency system.

---

## 🗂 Project Structure

```
ridebook/
├── backend/
│   ├── config/          db.js, pricing.js
│   ├── controllers/     auth, driver, ride, payment, admin (incl. chat/emergency/rating/complaint)
│   ├── middleware/       auth.middleware.js (JWT + role)
│   ├── models/          User, Driver, Ride, Payment/OTP/Message/Emergency/Rating/Complaint
│   ├── routes/          auth, ride, driver, payment, admin, chat, emergency, rating, request
│   ├── services/        otp, matching, geoapify
│   ├── sockets/         main.socket.js
│   ├── seed.js
│   ├── server.js
│   └── .env.example
│
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── rider/    RiderDashboard (map+booking), RideTrackingPage, MyRidesPage
    │   │   ├── driver/   DriverDashboard (map+jobs), DriverSetupPage, DriverRidesPage
    │   │   ├── admin/    AdminDashboard (drivers, users, rides, complaints)
    │   │   ├── ChatPage, ProfilePage, LoginPage, RegisterPage
    │   ├── components/
    │   │   ├── common/   RideLayout, SOSButton
    │   ├── context/      AuthContext, SocketContext
    │   └── utils/        api.js (Axios + JWT)
    ├── index.html        (CSS vars + Google Fonts)
    └── vite.config.js    (proxy to backend)
```

---

## ⚡ Quick Start

### Prerequisites
- Node.js >= 18
- MongoDB running locally (or Atlas URI)

### 1. Backend

```bash
cd ridebook/backend
npm install
cp .env.example .env
# Edit .env with your MongoDB URI, Razorpay keys
node seed.js          # Load sample data
npm run dev           # Starts on :5000
```

### 2. Frontend

```bash
cd ridebook/frontend
npm install
npm run dev           # Starts on :3000
```

Open: **http://localhost:3000**

---

## 🔐 Test Accounts (after seed.js)

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Admin | admin@ridebook.com | admin123 | Full admin panel |
| Rider (F) | priya@example.com | rider123 | Female rider |
| Rider (M) | rahul@example.com | rider123 | Male rider |
| Driver 1 | arjun@example.com | driver123 | Sedan, Hybrid, Any gender |
| Driver 2 | sunita@example.com | driver123 | SUV, Shared-only, Female-only |

---

## 🔑 OTP Login

1. Enter email → click "Send OTP"
2. OTP printed in **backend terminal console**
3. Enter OTP → JWT issued

---

## 🗺 Maps (Geoapify)

API Key: `42275beb38a64d1486b88a378b90a008`

Used for:
- **Autocomplete** — address search as you type
- **Geocoding** — address → lat/lng coordinates  
- **Routing** — distance, duration, polyline between two points
- **Map Tiles** — rendered via React-Leaflet

---

## 💰 Pricing (INR)

| Cab | Base | Per Km | Per Min |
|-----|------|--------|---------|
| Mini | ₹30 | ₹10 | ₹1.50 |
| Sedan | ₹50 | ₹14 | ₹2.00 |
| SUV | ₹80 | ₹18 | ₹2.50 |
| Premium | ₹120 | ₹25 | ₹3.50 |

Shared rides get 45% discount. Surge multiplier configurable via `.env`.

---

## 💳 Razorpay Setup

1. Create test account at https://dashboard.razorpay.com
2. Get test Key ID + Secret
3. Add to `.env`:
   ```
   RAZORPAY_KEY_ID=rzp_test_xxxxx
   RAZORPAY_KEY_SECRET=xxxxx
   ```
4. Add Razorpay script to frontend `index.html`:
   ```html
   <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
   ```

---

## 🔌 Socket.io Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `joinRide` | Client→Server | Join ride room |
| `sendMessage` | Client→Server | Send chat message |
| `receiveMessage` | Server→Client | New message broadcast |
| `driverLocation` | Client→Server | Driver GPS update |
| `driverLocationUpdate` | Server→Client | Broadcast to riders |
| `rideStatusUpdate` | Server→Client | Status change |
| `newRideAvailable` | Server→Client | Notify online drivers |
| `goOnline/goOffline` | Client→Server | Driver toggle |

---

## 🧠 Shared Ride Matching

```
finalScore = (routeMatch × 0.6) + (timeMatch × 0.2) + (preferenceMatch × 0.2)
```

- Gender mismatch = 0 score (disqualified)
- Route match uses Haversine distance on polyline points
- Results sorted by score descending

---

## 📡 API Reference

| Prefix | Endpoints |
|--------|-----------|
| `/api/auth` | register, login, request-otp, verify-otp, me, profile |
| `/api/rides` | estimate, create, my-rides, driver-rides, shared, accept, status, cancel, join-shared |
| `/api/drivers` | register, me, toggle-online, location, nearby |
| `/api/payment` | order, verify, cash, my |
| `/api/admin` | dashboard, users, drivers, approve, block, complaints |
| `/api/chat` | /:rideId (history) |
| `/api/emergency` | alert, my, resolve |
| `/api/ratings` | submit |
