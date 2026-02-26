import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { Pool } from 'pg';
import { Trip } from './entities/trip.entity';

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);

  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  /* ------ Public Methods ------ */
  async findAll(): Promise<Trip[]> {
    try {
      const allPublishedTrips = `SELECT * FROM trips WHERE status = 'PUBLISHED' ORDER BY created_at DESC`;

      const result = await this.pool.query<Trip>(allPublishedTrips);

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

  async getAtRiskTrips(): Promise<any[]> {
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
      return result.rows;
    } catch (error) {
      this.logger.error('Failed to fetch at-risk trips', error.stack);
      throw error;
    }
  }

  async getTripMetrics(id: string): Promise<any> {
    try {
      // First, verify the trip exists
      await this.findOne(id);

      const query = `
        SELECT 
          COUNT(id) as total_bookings,
          -- Sum seats only for confirmed bookings
          COALESCE(SUM(CASE WHEN state = 'CONFIRMED' THEN num_seats ELSE 0 END), 0)::int as total_seats_sold,
          -- Sum revenue only for confirmed bookings
          COALESCE(SUM(CASE WHEN state = 'CONFIRMED' THEN price_at_booking ELSE 0 END), 0) as total_revenue,
          -- Count how many bookings were cancelled
          COALESCE(SUM(CASE WHEN state = 'CANCELLED' THEN 1 ELSE 0 END), 0)::int as cancellations,
          -- Total money refunded
          COALESCE(SUM(refund_amount), 0) as total_refunded
        FROM bookings
        WHERE trip_id = $1;
      `;

      const result = await this.pool.query(query, [id]);

      // We return the aggregated metrics alongside the trip ID
      return {
        trip_id: id,
        metrics: result.rows[0],
      };
    } catch (error) {
      this.logger.error(`Failed to fetch metrics for trip ${id}`, error.stack);
      throw error;
    }
  }
}
