import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { OrderDto } from './dto/create-order.dto';
import { Order } from './schema/order.schema';
import { User } from '../user/schemas/user.schema';
import { CourseService } from '../course/course.service';
import { PaypalService } from '../Paypal/paypal.service';

@Injectable()
export class OrderService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly configService: ConfigService,
    private readonly courseService: CourseService,
    private readonly paypalService: PaypalService,
  ) {}

  public async createOrder(orderDto: OrderDto, userId: Types.ObjectId, lang: 'en' | 'ar' = 'en') {
    lang = ['en', 'ar'].includes(lang) ? lang : 'en';

    try {
      const DOMAIN = this.configService.get<string>('DOMAIN');
      if (!DOMAIN) {
        throw new InternalServerErrorException(
          lang === 'ar' ? 'DOMAIN غير مضبوط' : 'DOMAIN is not configured',
        );
      }

      // تحقق من المستخدم
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException(lang === 'ar' ? 'المستخدم غير موجود' : 'User not found');
      }

      // تحقق من الكورس
      const course = await this.courseService.getCourseDetailsByID(orderDto.courseId);
      if (!course) {
        throw new NotFoundException(lang === 'ar' ? 'الكورس غير موجود' : 'Course not found');
      }

      // إنشاء طلب الدفع لدى PayPal
      const paymentPayload = {
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: orderDto.courseId.toString(),
            description: typeof orderDto.courseTitle === 'object'
              ? orderDto.courseTitle[lang] || ''
              : orderDto.courseTitle,
            amount: {
              currency_code: 'USD',
              value: orderDto.coursePricing.toFixed(2),
            },
          },
        ],
        application_context: {
          return_url: `${DOMAIN}/payment-return`,
          cancel_url: `${DOMAIN}/payment-cancel`,
          user_action: 'PAY_NOW',
        },
      };

      const paymentResponse = await this.paypalService.createPayment(paymentPayload);
      const approveUrl = paymentResponse.links.find(l => l.rel === 'approve')?.href;

      if (!approveUrl) {
        throw new InternalServerErrorException(
          lang === 'ar' ? 'رابط الموافقة غير موجود' : 'Approval link not found',
        );
      }

      // إنشاء الطلب وحفظه في قاعدة البيانات بالحالة PENDING
      const newOrder = new this.orderModel({
        userId,
        userName: user.userName,
        userEmail: user.userEmail,
        orderStatus: 'PENDING',
        paymentMethod: 'paypal',
        paymentStatus: 'PENDING',
        orderDate: new Date(),
        paymentId: paymentResponse.id,
        payerId: '', // سيتم إضافته بعد الموافقة
        instructorId: course.instructorId,
        instructorName: course.instructorName,
        courseImage: course.image,
        courseTitle: orderDto.courseTitle,
        courseId: orderDto.courseId,
        coursePricing: orderDto.coursePricing,
        paypalOrderId: paymentResponse.id,
      });

      await newOrder.save();

      return {
        success: true,
        approveUrl,
        orderId: newOrder._id,
      };
    } catch (err) {
      console.error('Error creating order:', err);
      throw new InternalServerErrorException(
        lang === 'ar'
          ? 'حدث خطأ أثناء إنشاء الطلب'
          : 'Something went wrong while creating the order',
      );
    }
  }

  // تنفيذ الدفع (Capture) بعد الرجوع من PayPal
  public async captureOrder(paypalOrderId: string, payerId: string) {
    try {
      const captureResult = await this.paypalService.capturePayment(paypalOrderId);

      if (captureResult.status === 'COMPLETED') {
        const updatedOrder = await this.orderModel.findOneAndUpdate(
          { paypalOrderId },
          {
            paymentStatus: 'PAID',
            orderStatus: 'COMPLETED',
            payerId,
          },
          { new: true },
        );

        if (!updatedOrder) {
          throw new NotFoundException('Order not found.');
        }

        return {
          success: true,
          message: 'Payment captured and order completed successfully.',
          order: updatedOrder,
        };
      }

      return {
        success: false,
        message: 'Payment not completed.',
        status: captureResult.status,
      };
    } catch (err) {
      console.error('Error capturing PayPal payment:', err);
      throw new InternalServerErrorException('Failed to capture PayPal payment.');
    }
  }
}