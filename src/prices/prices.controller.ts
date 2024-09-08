import { Controller, Get, Post, Body } from '@nestjs/common';
import { PricesService } from './prices.service';
import { SetAlertDto } from 'src/dto/set-alert.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('prices')
@Controller('prices')
export class PricesController {
    constructor(private readonly pricesService: PricesService) { }

    @ApiOperation({ summary: 'Get hourly prices for the last 24 hours' })
    @ApiResponse({ status: 200, description: 'Returns an array of hourly prices for the last 24 hours' })
    @Get('/hourly')
    async getHourlyPrices() {
        return this.pricesService.getHourlyPrices();
    }

    @ApiOperation({ summary: 'Set a price alert for a specific chain' })
    @ApiResponse({ status: 201, description: 'Successfully set the price alert' })
    @Post('/set-alert')
    async setAlert(@Body() setAlertDto: SetAlertDto) {
        const { chain, price, email } = setAlertDto;
        return this.pricesService.setPriceAlert(chain, price, email);
    }
}