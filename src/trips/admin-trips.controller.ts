import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { TripsService } from './trips.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { Trip } from './entities/trip.entity';

@ApiTags('admin/trips')
@Controller('admin/trips')
export class AdminTripsController {
  constructor(private readonly tripsService: TripsService) {}

  // "Create new trip (admin only, optional auth)"
  @Post()
  @ApiOperation({ summary: 'Administrator: create a new trip' })
  @ApiBody({ type: CreateTripDto })
  @ApiResponse({ status: 201, description: 'Created trip', type: Trip })
  async createTrip(@Body() createTripDto: CreateTripDto) {
    return this.tripsService.create(createTripDto);
  }

  // "List at-risk trips"
  // Note: This must be defined before the ':id' route
  @Get('at-risk')
  @ApiOperation({ summary: 'List trips that are at risk of not filling' })
  @ApiResponse({
    status: 200,
    description: 'Array of at-risk trip summaries',
    type: [Object],
  })
  async getAtRiskTrips() {
    return this.tripsService.getAtRiskTrips();
  }

  // "Trip metrics"
  @Get(':id/metrics')
  @ApiOperation({ summary: 'Retrieve metrics for a particular trip' })
  @ApiParam({ name: 'id', description: 'Trip identifier', type: String })
  @ApiResponse({ status: 200, description: 'Metrics object' })
  async getTripMetrics(@Param('id') id: string) {
    return this.tripsService.getTripMetrics(id);
  }
}
