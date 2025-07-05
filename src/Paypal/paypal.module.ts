import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaypalService } from './paypal.service';
import { PaypalController } from './paypal.controller';
import { OrderModule } from '../order/order.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from '../order/schema/order.schema';

@Module({
    imports:[
        MongooseModule.forFeature([{name:Order.name,schema:OrderSchema}]),
        forwardRef(()=> OrderModule), 
        ConfigModule
    ],
    controllers: [PaypalController],
    providers: [PaypalService],
    exports:[PaypalService]
})
export class PaypalModule {}