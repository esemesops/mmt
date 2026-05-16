import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { jsonrepair } from "jsonrepair";

export function registerTolerantJsonParser(app: NestFastifyApplication) {
  const fastify = app.getHttpAdapter().getInstance();
  fastify.removeContentTypeParser("application/json");

  app.useBodyParser("application/json", {}, (_request, body, done) => {
    try {
      done(null, parseJsonBody(body.toString("utf8")));
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
      return JSON.parse(jsonrepair(rawBody)) as unknown;
    } catch {
      throw originalError;
    }
  }
}
