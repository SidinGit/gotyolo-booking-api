import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiParam,
} from '@nestjs/swagger';
import { TripsService } from './trips.service';
import { Trip } from './entities/trip.entity';
import { GetTripsFilterDto } from './dto/get-trips-filter.dto';

@ApiTags('trips')
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  // List all published trips
  @Get()
  @ApiOperation({ summary: 'Get all published trips' })
  @ApiOkResponse({ description: 'Array of trips', type: Trip, isArray: true })
  async findAll(@Query() filters: GetTripsFilterDto): Promise<Trip[]> {
    // Pass the entire DTO to the service
    return this.tripsService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single trip by ID' })
  @ApiParam({ name: 'id', description: 'Trip identifier', type: String })
  @ApiOkResponse({ description: 'Trip object', type: Trip })
  async findOne(@Param('id') id: string): Promise<Trip> {
    return this.tripsService.findOne(id);
  }
}
