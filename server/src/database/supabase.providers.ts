import { Logger, Provider } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppConfig } from '../config/app-config';

export const SUPABASE_CLIENT = 'SUPABASE_CLIENT';

export const SupabaseProviders: Provider[] = [
  {
    provide: SUPABASE_CLIENT,
    useFactory: (config: AppConfig): SupabaseClient<any, any, any> => {
      const logger = new Logger('SupabaseProvider');

      if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
        logger.warn(
          'Supabase is not fully configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
        );
      }

      return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        db: {
          schema: config.supabaseDbSchema,
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    },
    inject: [AppConfig],
  },
];
