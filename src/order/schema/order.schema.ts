import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { HydratedDocument, Types } from "mongoose";

export type OrderDocument = HydratedDocument<Order>;

@Schema({ timestamps: true })
export class Order {
  @Prop({ type: mongoose.Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  userName: string;

  @Prop({ required: true })
  userEmail: string;

  @Prop({ required: true })
  orderStatus: string;

  @Prop({ required: true })
  paymentMethod: string;

  @Prop({ required: true })
  paymentStatus: string;

  @Prop({ required: true })
  orderDate: Date;

  @Prop({ required: false }) // بيجي بعد الموافقة من PayPal
  paymentId: string;

  @Prop({ required: false }) // بيجي بعد العودة من PayPal
  payerId: string;

  @Prop({ type: mongoose.Types.ObjectId, ref: 'User', required: true })
  instructorId: Types.ObjectId;

  @Prop({ required: true })
  instructorName: string;

  @Prop({ required: true })
  courseImage: string;

  @Prop({ required: true, type: Object })
  courseTitle: { en: string; ar: string };

  @Prop({ type: mongoose.Types.ObjectId, ref: 'Course', required: true })
  courseId: Types.ObjectId;

  @Prop({ required: true })
  coursePricing: number;

  @Prop({ required: true }) // ضروري للربط مع PayPal
  paypalOrderId: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);