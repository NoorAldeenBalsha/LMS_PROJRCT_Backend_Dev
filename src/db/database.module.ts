import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';


@Module({
    imports:[MongooseModule.forRootAsync({
        inject:[ConfigService],
        useFactory: (configService:ConfigService) => ({
            uri: configService.get<string>('DataBase_URL'),
        })
    })
]
})
export class DatabaseModule {}
