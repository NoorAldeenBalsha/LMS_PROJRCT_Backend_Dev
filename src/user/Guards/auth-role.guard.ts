import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from "@nestjs/config";
import { UserService } from "../user.service";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { JWTPayloadType } from "utilitis/types";
import { CURRNET_USER_KEY } from "utilitis/constants";

@Injectable()
export class AuthRolesGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly userService: UserService,
        private readonly reflector: Reflector,
    ) {}

    async canActivate(context: ExecutionContext) {
        const roles = this.reflector.getAllAndOverride('roles', [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!roles || roles.length === 0) {
            return false;
        }

        const request: Request = context.switchToHttp().getRequest();
        const [type, token] = request.headers.authorization?.split(' ') ?? [];

        if (token && type === 'Bearer') {
            try {
                const payload: JWTPayloadType = await this.jwtService.verifyAsync(token, {
                    secret: this.configService.get<string>('JWT_SECRET'),
                });

                const user = await this.userService.getCurrentUser(payload.id);
                /*
                console.log('User :', user);
                console.log('=====================================================');
                console.log('User Role:', user?.role);
                console.log('=====================================================');
                console.log('Allowed Roles:', roles);
                console.log('=====================================================');
                console.log('JWT-payload: ',payload);
                console.log('=====================================================');
                */
                if (user && Array.isArray(roles) && roles.includes(user.role)) {
                    request[CURRNET_USER_KEY] = payload;
                    return true;
                }
            } catch (error) {
                throw new UnauthorizedException('Access denied, Invalid token');
            }
        } else {
            throw new UnauthorizedException('Access denied, No token provided');
        }

        return false;
    }
}