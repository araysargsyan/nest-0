import { createParamDecorator, ExecutionContext, Logger } from '@nestjs/common';
import { Request } from 'express';
import { ITokenPayload } from '@modules/shared/auth';

export const User = createParamDecorator((data: keyof ITokenPayload, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();

    Logger.verbose(JSON.stringify(request.user), 'UserDecorator');
    // if (data) {
    //     request.user[data].constructor.validationOptions = request.user.constructor.validationOptions;
    // }

    return data ? request.user[data] : request.user;
});
