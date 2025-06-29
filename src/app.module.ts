import { MiddlewareConsumer, Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { OrderModule } from './order/order.module';
import { StudentCourseModule } from './student-course/student-course.module';
import { CourseModule } from './course/course.module';
import { CourseProgressModule } from './course-progress/course-progress.module';
import { ConfigModule } from '@nestjs/config';
import { CheckoutModule } from './Paypal/paypal.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { AppController } from './app.controller';
import { MailModule } from './mail/mail.module';

@Module({
  
  imports: [
    
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    UserModule, 
    OrderModule, 
    StudentCourseModule, 
    CourseModule, 
    CheckoutModule,
    CourseProgressModule,
    CloudinaryModule,
    MailModule
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {
}
