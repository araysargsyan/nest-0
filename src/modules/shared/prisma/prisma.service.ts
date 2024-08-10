import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { DB_URL } from '~/constants/global.const';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private readonly configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.get(DB_URL),
        },
      },
    });
  }
  async onModuleInit() {
    await this.$connect();
    Logger.debug('connected','Prisma')
  }

  async onModuleDestroy() {
    await this.$disconnect();
    Logger.debug('$disconnect','Prisma')
  }
}
