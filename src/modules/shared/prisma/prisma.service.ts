import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { DB_URL } from '~/constants/global.const';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    const connectionString = configService.get<string>(DB_URL);
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    super({ adapter });
    this.pool = pool;
  }
  async onModuleInit() {
    await this.$connect();
    Logger.debug('connected','Prisma')
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
    Logger.debug('$disconnect','Prisma')
  }
}
