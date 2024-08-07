import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.env`,
      expandVariables: true,
      isGlobal: true,
    }),
  ],
})
export class CommonModule {}
