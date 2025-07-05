import { forwardRef, Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { PaypalModule } from '../Paypal/paypal.module';
import { DatabaseModule } from 'src/db/database.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from './schema/order.schema';
import { UserModule } from 'src/user/user.module';
import { StudentCourseModule } from 'src/student-course/student-course.module';
import { CourseModule } from 'src/course/course.module';


@Module({
   imports:[
    forwardRef(()=>PaypalModule),
    MongooseModule.forFeature([{name:Order.name,schema:OrderSchema}]),
    PaypalModule,
    DatabaseModule,
    StudentCourseModule,
    CourseModule,
    UserModule,
    
  ],
  controllers: [OrderController],
  providers: [OrderService],
 
  exports:[MongooseModule]
})
export class OrderModule {}
