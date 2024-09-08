import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity()
export class Price {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    chain: string;

    @Column('decimal', { precision: 18, scale: 2 })
    price: number;

    @CreateDateColumn()
    createdAt: Date;
}