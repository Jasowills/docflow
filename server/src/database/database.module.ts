import { Global, Module } from '@nestjs/common';
import { SupabaseProviders } from './supabase.providers';

@Global()
@Module({
  providers: [...SupabaseProviders],
  exports: [...SupabaseProviders],
})
export class DatabaseModule {}
