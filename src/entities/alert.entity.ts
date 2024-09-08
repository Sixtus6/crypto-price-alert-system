import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity()
export class Alert {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    chain: string;

    @Column('decimal', { precision: 18, scale: 2 })
    targetPrice: number;

    @Column()
    email: string;

    @CreateDateColumn()
    createdAt: Date;
}