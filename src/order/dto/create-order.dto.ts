import { Type } from 'class-transformer';
import {
  IsString, IsNotEmpty, IsEmail, IsDate,
  IsMongoId, IsNumber, IsObject,
  ValidateNested, IsOptional
} from 'class-validator';
import { Types } from 'mongoose';

class LocalizedTitle {
  @IsString()
  en: string;

  @IsString()
  ar: string;
}

export class OrderDto {
  @IsString()
  @IsNotEmpty()
  userName: string;

  @IsEmail()
  @IsNotEmpty()
  userEmail: string;

  @IsOptional()
  @IsString()
  orderStatus?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  orderDate?: Date;

  @IsOptional()
  @IsString()
  paymentId?: string;

  @IsOptional()
  @IsString()
  payerId?: string;

  @IsMongoId()
  @IsNotEmpty()
  instructorId: Types.ObjectId;

  @IsString()
  @IsNotEmpty()
  instructorName: string;

  @IsString()
  @IsNotEmpty()
  courseImage: string;

 @IsString()
  @IsNotEmpty()
  courseTitle: string;

  @IsMongoId()
  @IsNotEmpty()
  courseId: Types.ObjectId;

  @IsNumber()
  coursePricing: number;
}