import { Controller, Post, Body, InternalServerErrorException, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { PaypalService } from './paypal.service';
import { InjectModel } from '@nestjs/mongoose';
import { Order } from 'src/order/schema/order.schema';
import { Model } from 'mongoose';

class CreatePaymentDto {
  intent: 'CAPTURE' | 'AUTHORIZE';
  purchase_units: Array<{
    amount: {
      currency_code: string;
      value: string;
    };
  }>;
}

@ApiTags('Payment')
@Controller('api/payment')
export class PaypalController {
  constructor(
  private readonly paypalService: PaypalService,
  @InjectModel(Order.name) private readonly orderModel: Model<Order>,
) {}

  /**
   * Initiate a new PayPal order (Sandbox).
   * Receives JSON payload for order creation.
   */
  @Post('paypal')
  @ApiOperation({ summary: 'Create a PayPal payment order' })
  @ApiBody({ type: CreatePaymentDto })
  @ApiResponse({ status: 200, description: 'PayPal order created successfully' })
  @ApiResponse({ status: 500, description: 'Failed to create order' })
  async createPaypalPayment(@Body() paymentDto: CreatePaymentDto): Promise<any> {
  const payment = await this.paypalService.createPayment({
    intent: paymentDto.intent,
    purchase_units: paymentDto.purchase_units,
    application_context: {
      return_url: 'https://yourdomain.com/payment-return',
      cancel_url: 'https://yourdomain.com/payment-cancel',
      user_action: 'PAY_NOW',
    },
  });

  const approveUrl = payment.links.find(link => link.rel === 'approve')?.href;
  if (!approveUrl) {
    throw new InternalServerErrorException('Approval URL not found.');
  }

  return {
    success: true,
    paypalOrderId: payment.id,
    approveUrl,
  };
}

@Get('/payment-return')
@ApiOperation({ summary: 'PayPal return URL for payment capture' })
async handlePayPalReturn(@Query('token') token: string, @Query('PayerID') payerId: string) {
  try {
    const result = await this.paypalService.capturePayment(token); // token هو orderId
    if (result.status === 'COMPLETED') {
      // مثال: تحديث الطلب في قاعدة البيانات (لو خزّنت سابقاً)
      await this.orderModel.findOneAndUpdate(
        { paypalOrderId: token },
        {
          paymentStatus: 'PAID',
          orderStatus: 'COMPLETED',
          payerId,
        },
      );

      return { success: true, message: 'Payment completed successfully.' };
    } else {
      return { success: false, message: 'Payment not completed.' };
    }
  } catch (error) {
    console.error('Error capturing PayPal payment:', error);
    throw new InternalServerErrorException('Failed to capture PayPal payment.');
  }
}
}

