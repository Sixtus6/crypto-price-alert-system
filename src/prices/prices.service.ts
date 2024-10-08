import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import * as nodemailer from 'nodemailer';
import { Price } from 'src/entities/price.entity';
import { Between } from 'typeorm';
import { Alert } from 'src/entities/alert.entity';
import * as mailgun from 'mailgun-js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PricesService {
    private apiKey: string;
    private apiHost: string;
    private senderEmail: string;
    private supportEmail: string;
    private moralisKey: string;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        @InjectRepository(Price)
        private readonly priceRepository: Repository<Price>,
        @InjectRepository(Alert) private readonly alertRepository: Repository<Alert>,
    ) {
        // this.mailgun = mailgun({
        //     apiKey: this.API_KEY,
        //     domain: this.DOMAIN,
        // });
        this.apiKey = this.configService.get<string>('RAPIDAPI_KEY');
        this.apiHost = this.configService.get<string>('RAPIDAPI_HOST');
        this.senderEmail = this.configService.get<string>('SENDER_EMAIL');
        this.supportEmail = this.configService.get<string>('SUPPORT_EMAIL');
        this.moralisKey = this.configService.get<string>('MORALIS-KEY');
    }

    // private mailgun;

    // private API_KEY = '';

    // private DOMAIN = '';

    // private readonly moralisApiKey = '';

    // Polygon (MATIC) contract address on Ethereum
    private readonly polygonAddress = '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0';

    // Wrapped Ethereum (WETH) contract address on Ethereum
    private readonly ethereumAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

    private async fetchCryptoPrice(contractAddress: string): Promise<number> {
        try {
            const response = await firstValueFrom(
                this.httpService.get(
                    `https://deep-index.moralis.io/api/v2.2/erc20/${contractAddress}/price`,
                    {
                        headers: {
                            'X-API-Key': this.moralisKey,
                        },
                    }
                )
            );

            const usdPrice = response.data.usdPrice;
            console.log(`USD Price for contract ${contractAddress}: ${usdPrice}`);
            return usdPrice;
        } catch (error) {
            console.error(`Error fetching price for contract ${contractAddress}:`, error);
            throw new Error('Failed to fetch token price');
        }
    }
    @Cron('*/5 * * * *')
    async savePrices() {
        const ethPrice = await this.fetchCryptoPrice(this.ethereumAddress);
        const maticPrice = await this.fetchCryptoPrice(this.polygonAddress);

        const roundedEthPrice = Math.ceil(ethPrice * 100) / 100;
        const roundedMaticPrice = Math.ceil(maticPrice * 100) / 100;

        await this.priceRepository.save([
            { chain: 'ethereum', price: roundedEthPrice },
            { chain: 'polygon', price: roundedMaticPrice },
        ]);


        await this.checkForPriceIncrease();
    }

    private async checkForPriceIncrease() {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        const recentPrices = await this.priceRepository.find({
            where: { createdAt: MoreThan(oneHourAgo) },
        });

        const chains = ['ethereum', 'polygon'];

        for (const chain of chains) {
            const currentPrice = recentPrices.find(p => p.chain === chain)?.price;

            const oldPrice = await this.priceRepository.findOne({
                where: { chain, createdAt: LessThan(oneHourAgo) },
                order: { createdAt: 'DESC' },
            });

            if (oldPrice && currentPrice && (currentPrice - oldPrice.price) / oldPrice.price > 0.03) {
                this.sendAlertEmail(chain, currentPrice, 'hyperhire_assignment@hyperhire.in', `The price of ${chain} has increased by more than 3% to $${currentPrice}.`);
            }
        }
    }

    @Cron('*/6 * * * *')
    async checkForPriceAlerts() {
        const alerts = await this.alertRepository.find();

        console.log(`checking for alerts\n${alerts}`);
        for (const alert of alerts) {
            const currentPrice = await this.priceRepository.findOne({
                where: { chain: alert.chain },
                order: { createdAt: 'DESC' },
            });

            if (currentPrice && currentPrice.price == alert.targetPrice) {
                console.log('sending price');
                console.log([currentPrice.price, alert.targetPrice, alert.email])
                this.sendAlertEmail(alert.chain, alert.targetPrice, alert.email, `Price alert set for ${alert.chain} at price $${alert.targetPrice}`);
            }
        }
    }

    private async sendAlertEmail(chain: string, price: number, email: string, msg: string) {

        /* ------------------------ THIS IS FOR MAILGUN SMTP ------------------------ */
        // const data = {
        //     from: 'Alert <info@kwiq.app>',
        //     to: email,
        //     subject: `Price Alert for ${chain}`,
        //     text: msg,
        // };
        // this.mailgun.messages().send(data, (error, body) => {
        //     if (error) {
        //         console.error('Mailgun error:', error);
        //     } else {
        //         console.log('Mail sent successfully:', body);
        //     }
        // });

        /* -------------------------- THIS IS FOR FIREBASE -------------------------- */
        const options = {
            method: 'POST',
            url: `https://${this.apiHost}/send`,
            headers: {
                'x-rapidapi-key': this.apiKey,
                'x-rapidapi-host': this.apiHost,
                'Content-Type': 'application/json',
            },
            data: {
                personalizations: [
                    {
                        to: [
                            {
                                email: email,
                                name: 'User',
                            },
                        ],
                    },
                ],
                from: {
                    email: this.supportEmail,
                    name: 'Alert',
                },
                reply_to: {
                    email: this.senderEmail,
                    name: 'Alert',
                },
                subject: `Price Alert for ${chain}`,
                content: [

                    {
                        type: 'text/plain',
                        value: msg,
                    },
                ],
            },
        };

        try {
            const response = await firstValueFrom(this.httpService.request(options))
            console.log('Email sent successfully:', response.data);
        } catch (error) {
            console.error('Error sending email:', error.response?.data || error.message);
        }


    }

    async getHourlyPrices() {
        const now = new Date(); // Current time
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const pricesByHour = [];

        for (let i = 0; i < 24; i++) {
            const startOfHour = new Date(oneDayAgo.getTime() + (i * 60 * 60 * 1000));
            const endOfHour = new Date(startOfHour.getTime() + (60 * 60 * 1000));

            const ethereumPrice = await this.priceRepository.findOne({
                where: {
                    chain: 'ethereum',
                    createdAt: Between(startOfHour, endOfHour),
                },
                order: { createdAt: 'DESC' },
            });

            const polygonPrice = await this.priceRepository.findOne({
                where: {
                    chain: 'polygon',
                    createdAt: Between(startOfHour, endOfHour),
                },
                order: { createdAt: 'DESC' },
            });

            pricesByHour.push({
                hour: startOfHour,
                ethereum: ethereumPrice?.price || 'No data',
                polygon: polygonPrice?.price || 'No data',
            });
        }

        return pricesByHour;
    }

    async setPriceAlert(chain: string, price: number, email: string) {
        //`The price for ${chain} has reached $${price}.`
        await this.sendAlertEmail(chain, price, email, `Alert set for ${chain} at price ${price}.`);
        const alert = new Alert();
        alert.chain = chain;
        alert.targetPrice = price;
        alert.email = email;
        await this.alertRepository.save(alert);
        return { message: `Alert set for ${chain} at price ${price}.` };
    }
}