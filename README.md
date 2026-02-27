# GoTyolo Booking API

A robust, concurrency-safe backend API for a travel booking platform, built to handle high traffic, webhooks, and complex refund policies.

## 🚀 Tech Stack & Justification

*   ![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat&logo=nestjs&logoColor=white) Modular MVC Architecture
*   ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white) Primary ACID Datastore for pessimistic row-level locking
*   ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white) Strict Type Checking
*   ![Swagger](https://img.shields.io/badge/Swagger-85EA2D?style=flat&logo=Swagger&logoColor=black) Interactive API Documentation
*   ![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=Docker&logoColor=white) Containerization & `docker-compose` orchestration

## 🛠️ Setup Instructions

Ensure you have created a `.env` file in the root directory:
```env
DATABASE_URL=
DB_USER=
DB_PASSWORD=
DB_NAME=
DB_PORT=
PORT=
```

There are two ways to run this application:

### Option A: Fully Dockerized (Recommended)
This spun-up environment includes the API, PostgreSQL database, and Adminer UI for database management.
```bash
# Start all services (Database, Adminer, and the NestJS API)
docker-compose up --build -d
```
*   **API:** `http://localhost:3000`
*   **Adminer (DB GUI):** `http://localhost:8080`
*   **Swagger Docs:** `http://localhost:3000/api/docs`

### Option B: Local Native (Node.js)
If you prefer to run the Node.js application natively while isolating just the database in Docker.

1.  Start the database and adminer:
    ```bash
    docker-compose up db adminer -d
    ```
2.  Install Local Dependencies:
    ```bash
    npm install
    ```
3.  Run the Application:
    ```bash
    # Ensure DATABASE_URL in .env points to localhost instead of db
    npm run start:dev
    ```

### Seed Sample Data
The application includes an automatic `SeedService` in the Database module. 
When the server starts up (via either Option A or Option B), it will automatically detect if the `trips` table is empty and intelligently seed the database with sample trips, sample users, and historical bookings in various states. You do not need to hit a manual seed endpoint.

---

## 🐞 Bugs Found & Fixed During Audit

During the engineering audit, several critical flaws were identified in the original implementation and rectified:

1.  **Deadlock in Payment Webhook:**
    *   *Issue:* The webhook handler locked the `bookings` table first, then implicitly locked the `trips` table during an update. Other transactions (like Cancel) locked `trips` first, causing a classic Deadlock (Deadly Embrace).
    *   *Fix:* Rewrote the SQL transaction sequence to enforce a strict **Parent ➡️ Child** locking order. We now perform a non-blocking read to get the `trip_id`, explicitly lock the `trips` row, and *then* lock the `bookings` row.
2.  **Deadlock in Cancellation Logic:**
    *   *Issue:* Used a `JOIN` with `FOR UPDATE`. This leaves lock sequencing up to the query planner, which can result in unpredictable deadlocks under load.
    *   *Fix:* Split the `JOIN` into deterministic, sequential `SELECT ... FOR UPDATE` statements following the Parent-First locking rule.
3.  **Invalid State Cancellation:**
    *   *Issue:* The system allowed users to cancel a booking that was already in the `EXPIRED` state.
    *   *Fix:* Added guard clauses to reject cancellations for `EXPIRED` bookings.
4.  **Admin Payload Mismatches:**
    *   *Issue:* `getAtRiskTrips` and `getTripMetrics` returned flat SQL rows that did not match the strictly requested hierarchical JSON schemas.
    *   *Fix:* Implemented Application-layer mapping in TypeScript and database-layer aggregations (`COALESCE(SUM(CASE...))`) to format the metrics exactly to spec.
5.  **Missing Auto-Expiry Job:**
    *   *Issue:* Bookings in the `PENDING_PAYMENT` state were never expired after their 15-minute TTL, meaning abandoned checkouts permanently locked seats.
    *   *Fix:* Implemented a background Cron Job using `@nestjs/schedule` that runs every minute to batch update expired bookings and safely return their seats to the trip capacity.

---

## 📖 API Documentation

This application provides a fully interactive **Swagger UI** generated automatically via `@nestjs/swagger`. 

Once the application is running locally, you can explore, test, and view all endpoint schemas:
*   **UI:** **[http://localhost:3000/api/docs](http://localhost:3000/api/docs)**
*   **JSON:** **[http://localhost:3000/api/docs-json](http://localhost:3000/api/docs-json)**

### Core Endpoints Overview

**1. List Published Trips**
```http
GET /api/v1/trips
```
*   *Query Params:* `destination`, `start_date`, `end_date`, `max_price`

**2. Get Trip Details**
```http
GET /api/v1/trips/:id
```

**3. Create Booking**
```http
POST /api/v1/bookings
```
*   *Body:* `{ "trip_id": "uuid", "user_id": "uuid", "num_seats": 2 }`
*   *Response:* Returns Booking object in `PENDING_PAYMENT` state.

**4. Payment Webhook**
```http
POST /api/v1/bookings/webhook
```
*   *Body:* `{ "idempotency_key": "...", "booking_id": "...", "status": "success|failed" }`
*   *Note:* Idempotent. Safe to retry.

**5. Cancel Booking**
```http
POST /api/v1/bookings/:id/cancel
```
*   *Response:* Returns cancelled booking with calculated `refund_amount`.

**6. Get Booking Details**
```http
GET /api/v1/bookings/:id
```

### Admin Endpoints

**1. Create Trip**
```http
POST /api/v1/admin/trips
```
*   *Body:* Trip details (`title`, `price`, `max_capacity`, etc.)

**2. Trip Metrics**
```http
GET /api/v1/admin/trips/:id/metrics
```
*   *Response:* Deeply nested JSON containing occupancy percentage, revenue sums, and state counts.

**3. At-Risk Trips**
```http
GET /api/v1/admin/trips/at-risk
```
*   *Response:* Lists trips departing in < 7 days with < 50% occupancy.
