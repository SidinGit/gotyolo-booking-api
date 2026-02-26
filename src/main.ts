import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { VersioningType, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'; 

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // --- SWAGGER SETUP ---
  const config = new DocumentBuilder()
    .setTitle('GoTyolo Booking API')
    .setDescription('API documentation for the GoTyolo travel booking platform')
    .setVersion('1.0')
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  // UI will be at http://localhost:3000/api/docs
  SwaggerModule.setup('api/docs', app, document); 

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();