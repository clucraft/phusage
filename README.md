# CallCulator

A web application for tracking Microsoft Teams PSTN call usage and calculating costs against Verizon geographic termination rates.

## Features

- **Teams Call Import** - Upload Microsoft Teams PSTN usage reports (CSV/Excel)
- **Verizon Rate Matrix** - Import Verizon geographic termination rate sheets
- **Cost Calculation** - Automatically match calls to rates by country code
- **Dashboard Analytics**
  - Monthly cost trends
  - Top 10 users by cost
  - Top destinations by cost and volume
  - Average cost per user/call metrics
- **User Search** - Look up individual user call history with detailed breakdowns
- **Export Reports** - Download usage reports as CSV or PDF
- **Multi-user Auth** - Role-based access control (admin/user)
- **Dark Mode** - Full dark theme support

## Tech Stack

**Backend:**
- Node.js + Express + TypeScript
- PostgreSQL with Prisma ORM
- JWT authentication

**Frontend:**
- React + TypeScript
- Vite
- Tailwind CSS
- Recharts for data visualization

## Quick Start with Docker

```bash
# Clone the repository
git clone https://github.com/clucraft/phusage.git
cd phusage

# Start with Docker Compose
docker-compose up -d

# Access the app at http://localhost:3000
```

The first user to register becomes the admin.

## Development Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### Installation

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Configure environment
cp .env.example .env
# Edit .env with your database connection string

# Run database migrations
npx prisma migrate dev

# Start development servers
npm run dev
```

The app runs at `http://localhost:5173` (frontend) with API at `http://localhost:3000`.

## Configuration

Create a `.env` file in the root directory:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/callculator"
JWT_SECRET="your-secret-key-here"
PORT=3000
```

## Usage

### 1. Upload Verizon Rates

Navigate to **Rates** and upload your Verizon geographic termination rate Excel file. The app expects a sheet named "Usage Geographic Termination" with columns:
- Originating Country
- Destination
- Call Type
- Price

### 2. Upload Teams Report

Navigate to **Upload** and upload your Microsoft Teams PSTN usage export (CSV or Excel). The app processes outbound calls and matches them to rates based on phone number country codes.

Supported columns:
- Display Name / User
- UPN / Email
- Start time / Date
- Duration (seconds)
- Caller Number
- Callee Number
- Call Direction (filters for "Outbound")

### 3. View Analytics

The **Dashboard** shows:
- Total cost, calls, and minutes for the selected month
- Average cost per user and per call
- Monthly cost trend chart
- Top 10 users by cost
- Top 5 destinations

### 4. Search Users

Use **User Search** to find individual users and view their detailed call history including:
- Source and destination numbers
- Origin and destination countries
- Per-call rates and costs

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/registration-status` - Check if registration is enabled

### Usage Data
- `GET /api/usage/summary` - All users summary
- `GET /api/usage/top10` - Top 10 users by cost
- `GET /api/usage/user/:email` - Individual user details
- `GET /api/usage/monthly-costs` - Monthly cost data
- `GET /api/usage/dashboard-stats` - Dashboard statistics
- `GET /api/usage/top-destinations` - Top destinations

### Rates
- `GET /api/rates` - List rates with filtering
- `POST /api/rates` - Add a rate
- `DELETE /api/rates/:id` - Delete a rate
- `GET /api/rates/lookup` - Look up a specific rate

### Upload
- `POST /api/upload/teams-report` - Upload Teams PSTN report
- `POST /api/upload/verizon-rates` - Upload Verizon rate matrix
- `DELETE /api/upload/call-records` - Clear all call records

### Export
- `GET /api/export/csv` - Download CSV report
- `GET /api/export/pdf` - Download PDF report

### Admin
- `GET /api/admin/users` - List users
- `POST /api/admin/users` - Create user
- `PATCH /api/admin/users/:id/role` - Update user role
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/settings` - Get settings
- `PATCH /api/admin/settings` - Update settings

## License

MIT
