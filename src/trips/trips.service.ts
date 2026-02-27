import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { Pool } from 'pg';
import { Trip } from './entities/trip.entity';
import { GetTripsFilterDto } from './dto/get-trips-filter.dto';

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);

  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) { }

  /* ------ Public Methods ------ */
  async findAll(filters: GetTripsFilterDto): Promise<Trip[]> {
    try {
      const { destination, start_date, end_date, max_price } = filters;

      // Start with the base query
      let query = "SELECT * FROM trips WHERE status = 'PUBLISHED'";
      const values: any[] = [];
      let paramIndex = 1; // Used to track $1, $2, $3 etc. dynamically

      // Dynamically append conditions and parameters
      if (destination) {
        query += ` AND destination ILIKE $${paramIndex}`;
        values.push(`%${destination}%`);
        paramIndex++;
      }

      if (start_date) {
        query += ` AND start_date >= $${paramIndex}`;
        values.push(start_date);
        paramIndex++;
      }

      if (end_date) {
        query += ` AND end_date <= $${paramIndex}`;
        values.push(end_date);
        paramIndex++;
      }

      if (max_price) {
        query += ` AND price <= $${paramIndex}`;
        values.push(max_price);
        paramIndex++;
      }

      query += ' ORDER BY start_date ASC'; // Usually better to sort by upcoming trips rather than created_at

      const result = await this.pool.query<Trip>(query, values);
      return result.rows;
    } catch (error) {
      this.logger.error('Failed to fetch trips', error.stack);
      throw error;
    }
  }

  async findOne(id: string): Promise<Trip> {
    try {
      const tripWithID = `SELECT * FROM trips WHERE id = $1`;
      const result = await this.pool.query<Trip>(tripWithID, [id]);

      if (result.rows.length === 0) {
        throw new NotFoundException(`Trip with ID ${id} not found`);
      }

      return result.rows[0];
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        this.logger.error(`Failed to fetch trip with ID ${id}`, error.stack);
      }
      throw error;
    }
  }

  /* ------ Admin Methods ------ */
  async create(createTripDto: CreateTripDto): Promise<Trip> {
    try {
      // 1. Initially available seats for a new trip equals max capacity
      const availableSeats = createTripDto.max_capacity;

      // 2. Default status if not provided
      const status = createTripDto.status || 'DRAFT';

      const newTripRecord = `
      INSERT INTO trips (
          title, destination, start_date, end_date, price, 
          max_capacity, available_seats, status, 
          refundable_until_days_before, cancellation_fee_percent
      )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *;
      `;

      const values = [
        createTripDto.title,
        createTripDto.destination,
        createTripDto.start_date,
        createTripDto.end_date,
        createTripDto.price,
        createTripDto.max_capacity,
        availableSeats,
        status,
        createTripDto.refundable_until_days_before,
        createTripDto.cancellation_fee_percent,
      ];

      const result = await this.pool.query<Trip>(newTripRecord, values);
      this.logger.log(`Created new trip: ${result.rows[0].id}`);
      return result.rows[0];
    } catch (error) {
      this.logger.error('Failed to create trip', error.stack);
      throw error;
    }
  }

  async getAtRiskTrips(): Promise<{ at_risk_trips: any[] }> {
    try {
      const query = `
        SELECT 
          id, 
          title, 
          destination, 
          start_date, 
          max_capacity, 
          available_seats,
          -- Calculate occupancy percentage
          ROUND(((max_capacity - available_seats)::numeric / max_capacity) * 100, 2) as occupancy_percentage
        FROM trips
        WHERE status = 'PUBLISHED'
          AND start_date > CURRENT_TIMESTAMP
          AND start_date <= CURRENT_TIMESTAMP + INTERVAL '7 days'
          -- Less than 50% booked means available_seats is greater than half capacity
          AND available_seats > (max_capacity / 2.0)
        ORDER BY start_date ASC;
      `;

      const result = await this.pool.query(query);

      const mappedTrips = result.rows.map(row => ({
        trip_id: row.id,
        title: row.title,
        departure_date: row.start_date,
        occupancy_percent: parseFloat(row.occupancy_percentage),
        reason: "Low occupancy with imminent departure"
      }));

      return {
        at_risk_trips: mappedTrips
      };
    } catch (error) {
      this.logger.error('Failed to fetch at-risk trips', error.stack);
      throw error;
    }
  }

  async getTripMetrics(id: string): Promise<any> {
    try {
      // First, verify the trip exists (This also gives us the base trip data)
      const trip = await this.findOne(id);

      const query = `
        SELECT 
          -- Aggregate booking states
          COALESCE(SUM(CASE WHEN state = 'CONFIRMED' THEN 1 ELSE 0 END), 0)::int as confirmed_count,
          COALESCE(SUM(CASE WHEN state = 'PENDING_PAYMENT' THEN 1 ELSE 0 END), 0)::int as pending_count,
          COALESCE(SUM(CASE WHEN state = 'CANCELLED' THEN 1 ELSE 0 END), 0)::int as cancelled_count,
          COALESCE(SUM(CASE WHEN state = 'EXPIRED' THEN 1 ELSE 0 END), 0)::int as expired_count,
          
          -- Aggregate financials and seats
          COALESCE(SUM(CASE WHEN state = 'CONFIRMED' THEN num_seats ELSE 0 END), 0)::int as booked_seats,
          COALESCE(SUM(CASE WHEN state IN ('CONFIRMED', 'CANCELLED') THEN price_at_booking ELSE 0 END), 0) as gross_revenue,
          COALESCE(SUM(refund_amount), 0) as refunds_issued
        FROM bookings
        WHERE trip_id = $1;
      `;

      const result = await this.pool.query(query, [id]);
      const metrics = result.rows[0];

      // Format financial math
      const grossRevenue = parseFloat(metrics.gross_revenue);
      const refundsIssued = parseFloat(metrics.refunds_issued);
      const netRevenue = grossRevenue - refundsIssued;

      // Format occupancy
      const totalSeats = parseInt(trip.max_capacity as any, 10);
      const bookedSeats = parseInt(metrics.booked_seats, 10);
      const occupancyPercent = totalSeats > 0 ? (bookedSeats / totalSeats) * 100 : 0;

      // Build exact response shape
      return {
        trip_id: id,
        title: trip.title,
        occupancy_percent: parseFloat(occupancyPercent.toFixed(2)),
        total_seats: totalSeats,
        booked_seats: bookedSeats,
        available_seats: parseInt(trip.available_seats as any, 10),
        booking_summary: {
          confirmed: metrics.confirmed_count,
          pending_payment: metrics.pending_count,
          cancelled: metrics.cancelled_count,
          expired: metrics.expired_count,
        },
        financial: {
          gross_revenue: grossRevenue,
          refunds_issued: refundsIssued,
          net_revenue: netRevenue,
        }
      };
    } catch (error) {
      this.logger.error(`Failed to fetch metrics for trip ${id}`, error.stack);
      throw error;
    }
  }
}
