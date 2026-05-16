import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { registerTolerantJsonParser } from "./http/tolerant-json.parser";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false
    }),
    {
      bufferLogs: true
    }
  );
  const config = app.get(ConfigService);

  registerTolerantJsonParser(app);
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("MMT API")
    .setDescription("OpenAI-compatible AI gateway for MTN Music Trivia.")
    .setVersion("0.1.0")
    .addBearerAuth()
    .addApiKey(
      {
        type: "apiKey",
        name: "x-api-key",
        in: "header"
      },
      "x-api-key"
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  const port = config.get<number>("PORT", 4000);
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
