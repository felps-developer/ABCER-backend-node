import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../../generated/prisma/client.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly pool: Pool;

  constructor() {
    const url = new URL(process.env.DATABASE_URL ?? '');
    const schema = url.searchParams.get('schema') ?? 'public';
    url.searchParams.delete('schema');
    const pool = new Pool({ connectionString: url.toString() });
    const adapter = new PrismaPg(pool, { schema });
    super({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
