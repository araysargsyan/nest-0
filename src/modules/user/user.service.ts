import { Injectable } from '@nestjs/common';
import { PrismaService } from '@modules/shared/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private readonly prismaService: PrismaService) {}

  async isEmailUnique(email: string) {
    const user = await this.findByEmail(email)
    return !Boolean(user)
  }

  create(data: Prisma.UserCreateInput) {
    return this.prismaService.user.create({ data })
  }

  findByEmail(email: string) {
    return this.prismaService.user.findUnique({
      where: {
        email,
      },
    })
  }

  async clearRtById(id: number) {
    return this.prismaService.user.updateMany({
        where: {
          id,
          NOT: {
            hashedRt: null,
          },
        },
        data: {
          hashedRt: null,
        },
      }).then((count) => count && true)
  }

  async updateRtById(id: number, hashedRt: string) {
    await this.prismaService.user.update({
      where: { id },
      data: { hashedRt },
    })
  }

  findMany(where: Prisma.UserWhereInput) {
    return this.prismaService.user.findMany({
      where,
      include: {
        products: {
          select: {id: true}
        },
      }
    })
  }

  findUnique(id: number, select: Prisma.UserSelect) {
    return this.prismaService.user.findUnique({
        where: { id },
        select
      })
  }
}
