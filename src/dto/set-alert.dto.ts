import { ApiProperty } from '@nestjs/swagger';

export class SetAlertDto {
    @ApiProperty({ example: 'ethereum', description: 'The name of the cryptocurrency' })
    chain: string;

    @ApiProperty({ example: 2000, description: 'The target price to trigger the alert' })
    price: number;

    @ApiProperty({ example: 'user@example.com', description: 'The user’s email to send the alert to' })
    email: string;
}