import { IsUUID, IsString, IsIn, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WebhookPayloadDto {
    @ApiProperty({
        description: 'The unique idempotency key sent by the payment provider',
        example: 'webhook-789',
    })
    @IsString()
    @IsNotEmpty()
    idempotency_key: string;

    @ApiProperty({
        description: 'The ID of the booking being paid for',
        format: 'uuid',
    })
    @IsUUID()
    @IsNotEmpty()
    booking_id: string;

    @ApiProperty({
        description: 'The final status of the payment attempt',
        enum: ['success', 'failed'],
    })
    @IsIn(['success', 'failed'])
    @IsNotEmpty()
    status: 'success' | 'failed';

    @ApiProperty({
        description: 'Optional reference ID from the payment provider (e.g. Stripe Charge ID)',
        required: false,
        example: 'ch_3MqwQyLkdIwHu7ix08b4n3sJ',
    })
    @IsString()
    @IsOptional()
    payment_reference?: string;
}
