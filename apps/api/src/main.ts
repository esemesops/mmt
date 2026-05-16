import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

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

function registerTolerantJsonParser(app: NestFastifyApplication) {
  const fastify = app.getHttpAdapter().getInstance();
  fastify.removeContentTypeParser("application/json");

  app.useBodyParser("application/json", {}, (_request, body, done) => {
    const rawBody = body.toString("utf8");

    try {
      done(null, parseJsonBody(rawBody));
    } catch (error) {
      done(error as Error);
    }
  });
}

function parseJsonBody(rawBody: string) {
  try {
    return JSON.parse(rawBody) as unknown;
  } catch (originalError) {
    try {
      return JSON.parse(escapeControlCharactersInJsonStrings(rawBody)) as unknown;
    } catch {
      throw originalError;
    }
  }
}

function escapeControlCharactersInJsonStrings(value: string) {
  let result = "";
  let inString = false;
  let isEscaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (isEscaped) {
      result += character;
      isEscaped = false;
      continue;
    }

    if (character === "\\" && inString) {
      result += character;
      isEscaped = true;
      continue;
    }

    if (character === '"') {
      result += character;
      inString = !inString;
      continue;
    }

    if (inString) {
      result += escapeJsonStringCharacter(character);
      continue;
    }

    result += character;
  }

  return result;
}

function escapeJsonStringCharacter(character: string) {
  if (character === "\n") {
    return "\\n";
  }

  if (character === "\r") {
    return "\\r";
  }

  if (character === "\t") {
    return "\\t";
  }

  if (character.charCodeAt(0) < 0x20) {
    return `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`;
  }

  return character;
}

void bootstrap();
