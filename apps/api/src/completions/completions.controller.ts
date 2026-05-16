import { BadRequestException, Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiKeyGuard } from "../auth/api-key.guard";
import { TriviaService } from "../trivia/trivia.service";
import { ChatCompletionDto } from "./dto/chat-completion.dto";

@UseGuards(ApiKeyGuard)
@Controller("v1/chat")
export class CompletionsController {
  constructor(private readonly trivia: TriviaService) {}

  @Post("completions")
  async complete(@Body() body: ChatCompletionDto) {
    if (body.stream) {
      throw new BadRequestException("Streaming is not supported yet");
    }

    const parsed = this.parseTriviaInput(body);
    const result = await this.trivia.answer(parsed);
    const created = Math.floor(Date.now() / 1000);

    return {
      id: `chatcmpl_mmt_${created}`,
      object: "chat.completion",
      created,
      model: body.model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: result.answer
          },
          finish_reason: "stop"
        }
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 1,
        total_tokens: 1
      },
      mmt: {
        confidence: result.confidence,
        cached: result.cached,
        sources: result.sources
      }
    };
  }

  private parseTriviaInput(body: ChatCompletionDto) {
    const latestUserMessage = [...body.messages].reverse().find((message) => message.role === "user");
    const content = latestUserMessage?.content ?? "";
    const structuredOptions = this.extractStructuredOptions(body);

    if (structuredOptions) {
      return {
        question: this.extractQuestion(content),
        options: structuredOptions
      };
    }

    return this.parseTriviaPrompt(content);
  }

  private extractStructuredOptions(body: ChatCompletionDto) {
    const candidates = [
      body.options,
      this.readOptions(body.metadata),
      this.readOptions(body.extra_body),
      this.readOptions(this.readRecord(body.metadata, "mmt")),
      this.readOptions(this.readRecord(body.extra_body, "mmt"))
    ];

    return candidates.find(Boolean);
  }

  private readOptions(value: unknown) {
    const record = this.asRecord(value);
    const options = this.asRecord(record?.options ?? value);
    const optionA = typeof options?.A === "string" ? options.A.trim() : undefined;
    const optionB = typeof options?.B === "string" ? options.B.trim() : undefined;

    if (!optionA || !optionB) {
      return undefined;
    }

    return {
      A: optionA,
      B: optionB
    };
  }

  private readRecord(value: unknown, key: string) {
    return this.asRecord(value)?.[key];
  }

  private asRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  }

  private extractQuestion(content: string) {
    const labeledQuestion = this.match(content, /(?:question|q)\s*[:.)-]\s*(.+?)(?:\n|$)/i);
    const question = labeledQuestion ?? content.trim();

    if (!question) {
      throw new BadRequestException("At least one user message with a question is required");
    }

    return question;
  }

  private parseTriviaPrompt(content: string) {
    const question = this.match(content, /(?:question|q)\s*[:.)-]\s*(.+?)(?:\n|$)/i);
    const optionA = this.match(content, /^\s*A\s*[:.)-]\s*(.+?)(?:\n|$)/im);
    const optionB = this.match(content, /^\s*B\s*[:.)-]\s*(.+?)(?:\n|$)/im);

    if (!question || !optionA || !optionB) {
      throw new BadRequestException(
        "Request must include structured options at options, metadata.options, extra_body.options, or use Question/Q plus A/B lines"
      );
    }

    return {
      question,
      options: {
        A: optionA,
        B: optionB
      }
    };
  }

  private match(content: string, regex: RegExp): string | undefined {
    return regex.exec(content)?.[1]?.trim();
  }
}
