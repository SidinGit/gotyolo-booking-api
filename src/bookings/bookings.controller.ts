import { Controller, Post, Body, Get, Param, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';

@ApiTags('Bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) { }

  @Post()
  @ApiOperation({ summary: 'Reserve seats and initiate a booking' })
  @ApiResponse({
    status: 201,
    description: 'Booking created with PENDING_PAYMENT state.',
  })
  @ApiResponse({ status: 400, description: 'Not enough available seats.' })
  async create(@Body() createBookingDto: CreateBookingDto) {
    return this.bookingsService.create(createBookingDto);
  }

  @Post('webhook')
  @HttpCode(200) // Webhooks expect 200 OK
  @ApiOperation({ summary: 'Handle payment provider webhooks (Idempotent)' })
  async handleWebhook(@Body() payload: WebhookPayloadDto) {
    return this.bookingsService.handlePaymentWebhook(payload);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Check booking status' })
  async findOne(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'User cancels a booking and calculates refund' })
  async cancel(@Param('id') id: string) {
    return this.bookingsService.cancel(id);
  }
}
