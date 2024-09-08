import { Module } from '@nestjs/common';
import { PricesService } from './prices.service';
import { PricesController } from './prices.controller';
import { Alert } from 'src/entities/alert.entity';
import { Price } from 'src/entities/price.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    TypeOrmModule.forFeature([Price, Alert]),
    HttpModule,
  ],
  providers: [PricesService],
  controllers: [PricesController]
})
export class PricesModule { }
