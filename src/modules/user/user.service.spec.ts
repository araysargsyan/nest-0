import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '@modules/shared/prisma/prisma.service';

describe('UserService (Unit)', () => {
  let service: UserService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isEmailUnique', () => {
    it('should return true if user with email does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.isEmailUnique('nonexistent@example.com');

      expect(result).toBe(true);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'nonexistent@example.com' },
      });
    });

    it('should return false if user with email exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 1, email: 'exists@example.com' });

      const result = await service.isEmailUnique('exists@example.com');

      expect(result).toBe(false);
    });
  });
});
