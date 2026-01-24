<p align="center">
  <img src="client/public/icon.svg" alt="CallCulator Logo" width="120" height="120">
</p>

<h1 align="center">CallCulator</h1>

<p align="center">
  A comprehensive Microsoft Teams PSTN call usage tracking and billing application for enterprise cost management.
</p>

> **Built with AI:** This application was created with the assistance of [Claude](https://www.anthropic.com/claude) by Anthropic.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![React](https://img.shields.io/badge/React-18-61dafb)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)

## Overview

CallCulator helps organizations track, analyze, and manage their Microsoft Teams PSTN calling costs. Upload Teams usage reports and carrier rate matrices to gain insights into call spending across users, locations, and time periods.

<!-- TODO: Add dashboard screenshot -->
![Dashboard Screenshot](screenshots/dashboard.png)

---

## Features

### Dashboard
- **Summary Cards**: Total cost, calls, minutes, and unique users at a glance
- **Average Metrics**: Cost per user and cost per call
- **Monthly Cost Trend**: 12-month area chart visualization
- **Top Destinations**: Countries ranked by cost with visual distribution bars
- **Top 10 Users**: Users ranked by cost with detailed metrics
- **Export Reports**: Download CSV or PDF reports for any period

<!-- TODO: Add dashboard overview screenshot -->
![Dashboard Overview](screenshots/dashboard-overview.png)

---

### Multi-Carrier Support
- Manage multiple carriers (Verizon, Operator Connect Fusion, etc.)
- Separate rate matrices per carrier
- Filter all views by carrier
- Automatic carrier creation during rate upload

<!-- TODO: Add carrier dropdown screenshot -->
![Carrier Selection](screenshots/carrier-selection.png)

---

### User Search
- Search users by email address
- Complete call history with sortable columns (date, duration, cost, destination)
- Cost breakdown by destination (pie chart)
- Most called and costliest numbers
- Monthly cost trend analysis
- Date range presets: Previous Year, Previous Month, This Month, This Year, Last 30/90 Days
- Custom date range picker
- Export user data to CSV

<!-- TODO: Add user search screenshot -->
![User Search](screenshots/user-search.png)

---

### Locations Analysis
- **Interactive World Map**: Choropleth visualization with cost intensity coloring
- **Hover Tooltips**: Country details on hover
- **Location Table**: Sortable metrics per location (users, calls, minutes, cost)
- **Visual Comparison**: Cost distribution bars for easy comparison

<!-- TODO: Add locations map screenshot -->
![Locations Map](screenshots/locations.png)

---

### Cost Estimator
- **Scenario Planning**: Project costs for new sites or changes
- **Historical Templates**: Pre-fill estimates based on existing country patterns
- **Destination Distribution**: Configure percentage breakdown by destination
- **Detailed Results**: Monthly/yearly costs with per-destination breakdown
- **Missing Rate Warnings**: Alerts for destinations without configured rates

<!-- TODO: Add estimator screenshot -->
![Cost Estimator](screenshots/estimator.png)

---

### Rate Management
- Upload carrier rate matrices (Excel format)
- Associate rates with specific carriers
- Manual rate entry and editing
- Search and filter rates by origin/destination
- Pagination for large rate sets
- Rate lookup for specific origin/destination pairs
- Support for Verizon geographic termination format

<!-- TODO: Add rates page screenshot -->
![Rate Management](screenshots/rates.png)

---

### Upload & Data Management
- **Teams Report Upload**: CSV, XLSX, XLS support
- **Real-Time Progress Bar**: Live processing status with record counts
- **Rate Matrix Upload**: Excel files with carrier association
- **Upload History**: Track all uploads with timestamps and record counts
- **Gap Detection**: Automatic detection of missing date ranges in your data
- **Coverage Timeline**: Visual representation of uploaded data periods
- **Data Management**: Clear all records with confirmation

<!-- TODO: Add upload page with progress bar screenshot -->
![Upload Progress](screenshots/upload-progress.png)

---

### Admin Features
- **User Management**: Create, edit, and delete users
- **Role Assignment**: Admin and user roles
- **Password Reset**: Admin can reset user passwords
- **Registration Control**: Toggle public registration on/off
- **First User**: First registered user automatically becomes admin

<!-- TODO: Add admin page screenshot -->
![Admin Panel](screenshots/admin.png)

---

### UI/UX Features
- **Dark Mode**: Full dark theme with toggle button
- **Currency Toggle**: Switch between USD and CHF with live exchange rates
- **Responsive Design**: Works on desktop and mobile devices
- **Session Persistence**: Filters and search results preserved across navigation
- **Loading States**: Clear feedback during data loading
- **Sortable Tables**: Click column headers to sort

<!-- TODO: Add dark mode screenshot -->
![Dark Mode](screenshots/dark-mode.png)

---

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Recharts for charts and graphs
- React Simple Maps for geographic visualization
- Axios for API communication

### Backend
- Node.js with Express
- TypeScript
- Prisma ORM
- PostgreSQL database
- JWT authentication
- Server-Sent Events (SSE) for real-time upload progress

---

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

---

## Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/clucraft/phusage.git
   cd phusage
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd client && npm install && cd ..
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your settings:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/callculator"
   JWT_SECRET="your-secret-key-here"
   PORT=3000
   ```

4. **Run database migrations**
   ```bash
   npx prisma migrate deploy
   ```

5. **Start development servers**
   ```bash
   npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000

---

## Usage Guide

### 1. Upload Rate Matrix

Navigate to **Rates** and upload your carrier rate Excel file.

**Verizon Format** - expects a sheet named "Usage Geographic Termination" with columns:
| Column | Description |
|--------|-------------|
| Originating Country | Call origin country |
| Destination | Destination (e.g., "Afghanistan-Mobile") |
| Call Type | Outbound/Inbound |
| Price | Price per minute |

### 2. Upload Teams Report

Navigate to **Upload** and upload your Microsoft Teams PSTN usage export.

**Supported formats**: CSV, XLSX, XLS

**Expected columns**:
| Column | Description |
|--------|-------------|
| Display Name | User's display name |
| UPN | User's email address |
| Start time | Call start timestamp |
| Duration (seconds) | Call duration |
| Caller Number | Source phone number |
| Callee Number | Destination phone number |
| Call Direction | Filters for "Outbound" only |

### 3. View Analytics

The **Dashboard** provides:
- Total cost, calls, and minutes for selected month/year
- Average cost per user and per call
- Monthly cost trend chart (12 months)
- Top 10 users by cost
- Top 5 destinations by cost

### 4. Search Users

Use **User Search** to find individual users:
- View complete call history
- See cost breakdown by destination
- Analyze monthly trends
- Export data to CSV

### 5. Analyze Locations

The **Locations** page shows:
- World map with cost intensity
- Per-location statistics
- Compare costs across regions

### 6. Estimate Costs

Use the **Estimator** to:
- Project costs for new sites
- Use templates from historical data
- Configure destination distributions
- View detailed cost breakdowns

---

## API Reference

### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | User login |
| `/api/auth/register` | POST | User registration |
| `/api/auth/registration-status` | GET | Check if registration enabled |

### Usage Data
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/usage/summary` | GET | All users summary |
| `/api/usage/top10` | GET | Top 10 users by cost |
| `/api/usage/user/:email` | GET | Individual user details |
| `/api/usage/user/:email/trend` | GET | User monthly trend |
| `/api/usage/monthly-costs` | GET | Monthly cost data |
| `/api/usage/dashboard-stats` | GET | Dashboard statistics |
| `/api/usage/top-destinations` | GET | Top destinations |
| `/api/usage/locations` | GET | Location-based data |

### Rates
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/rates` | GET | List rates with filtering |
| `/api/rates` | POST | Add/update a rate |
| `/api/rates/:id` | DELETE | Delete a rate |
| `/api/rates/lookup` | GET | Look up specific rate |
| `/api/rates/origins` | GET | List origin countries |
| `/api/rates/destinations` | GET | List destination countries |
| `/api/rates/stats` | GET | Rate statistics |

### Upload
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload/teams-report` | POST | Upload Teams report |
| `/api/upload/verizon-rates` | POST | Upload rate matrix |
| `/api/upload/progress/:jobId` | GET | SSE progress stream |
| `/api/upload/history` | GET | Upload history |
| `/api/upload/history/:id` | DELETE | Delete history entry |
| `/api/upload/call-records` | DELETE | Clear all records |

### Export
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/export/csv` | GET | Download CSV report |
| `/api/export/pdf` | GET | Download PDF report |

### Carriers
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/carriers` | GET | List all carriers |
| `/api/carriers/with-rates` | GET | Carriers with rates |

### Estimator
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/estimator/templates` | GET | Available templates |
| `/api/estimator/template/:country` | GET | Template data |
| `/api/estimator/calculate` | POST | Calculate estimate |
| `/api/estimator/origins` | GET | Origin countries |
| `/api/estimator/destinations` | GET | Destination countries |

### Admin
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/users` | GET | List all users |
| `/api/admin/users` | POST | Create user |
| `/api/admin/users/:id/role` | PATCH | Update user role |
| `/api/admin/users/:id/password` | PATCH | Reset password |
| `/api/admin/users/:id` | DELETE | Delete user |
| `/api/admin/settings` | GET | Get app settings |
| `/api/admin/settings` | PATCH | Update settings |

---

## Screenshots

### Dashboard
<!-- TODO: Add full dashboard screenshot showing all widgets -->
![Dashboard Full](screenshots/dashboard-full.png)

### User Search Details
<!-- TODO: Add user search showing call history and charts -->
![User Details](screenshots/user-details.png)

### World Map View
<!-- TODO: Add locations page with map highlighted -->
![World Map](screenshots/world-map.png)

### Cost Estimator Results
<!-- TODO: Add estimator with calculation results -->
![Estimator Results](screenshots/estimator-results.png)

### Upload with Progress
<!-- TODO: Add upload page during file processing -->
![Upload](screenshots/upload.png)

### Dark Mode
<!-- TODO: Add any page in dark mode -->
![Dark Theme](screenshots/dark-theme.png)

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- Built with assistance from [Claude](https://www.anthropic.com/claude) by Anthropic
- World map data from [Natural Earth](https://www.naturalearthdata.com/)
- Exchange rates from [Frankfurter API](https://www.frankfurter.app/)
