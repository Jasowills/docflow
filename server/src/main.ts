import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { existsSync } from 'fs';
import { join } from 'path';
import express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const allowedOrigins = getAllowedCorsOrigins(process.env.CORS_ORIGIN);

  // Allow larger payloads (recordings can include screenshots + transcript blobs).
  app.use(express.json({ limit: '30mb' }));
  app.use(express.urlencoded({ limit: '30mb', extended: true }));

  // Security
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          scriptSrc: ["'self'", 'blob:'],
          workerSrc: ["'self'", 'blob:'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: [
            "'self'",
            ...allowedOrigins,
            'https://login.microsoftonline.com',
            'https://*.microsoftonline.com',
            'https://docflow-ops.vercel.app',
            'https://graph.microsoft.com',
          ],
        },
      },
    }),
  );
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || isAllowedCorsOrigin(origin, allowedOrigins)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API prefix
  app.setGlobalPrefix('api');

  // Swagger / OpenAPI
  const swaggerConfig = new DocumentBuilder()
    .setTitle('DocFlow API')
    .setDescription('API for workflow capture, AI documentation generation, and team collaboration')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // Serve frontend SPA from the same app (single App Service deployment).
  const frontendDistPath = join(__dirname, '..', 'build');
  if (existsSync(frontendDistPath)) {
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.use(express.static(frontendDistPath));
    expressApp.use((req: { path?: string }, res: { sendFile: (path: string) => void }, next: () => void) => {
      if (req.path?.startsWith('/api')) {
        next();
        return;
      }
      res.sendFile(join(frontendDistPath, 'index.html'));
    });
    logger.log(`Serving frontend from ${frontendDistPath}`);
  } else {
    logger.warn(`Frontend dist not found at ${frontendDistPath}; API-only mode enabled.`);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`DocFlow API running on port ${port}`);
  logger.log(`Swagger UI available at http://localhost:${port}/api/docs`);
}
bootstrap();

function getAllowedCorsOrigins(configuredOrigins?: string): string[] {
  const defaults = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5173',
  ];
  const configured = (configuredOrigins || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set([...defaults, ...configured]));
}

function isAllowedCorsOrigin(origin: string, allowedOrigins: string[]): boolean {
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // Allow Chrome extension requests for recorder upload/auth flows.
  if (origin.startsWith('chrome-extension://')) {
    return true;
  }

  return false;
}
