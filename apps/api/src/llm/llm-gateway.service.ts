import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TriviaCompletionInput, TriviaCompletionOutput } from "./llm.types";

interface ChatCompletionChoice {
  message?: {
    content?: string;
  };
}

interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[];
}

@Injectable()
export class LlmGatewayService {
  constructor(private readonly config: ConfigService) {}

  async answerTrivia(input: TriviaCompletionInput): Promise<TriviaCompletionOutput> {
    const response = await fetch(`${this.baseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.config.get<string>("LITELLM_MODEL", "mmt-fast-lite"),
        temperature: 0,
        max_tokens: 80,
        response_format: {
          type: "json_object"
        },
        messages: [
          {
            role: "system",
            content:
              "You answer music trivia multiple choice questions. Use only the supplied evidence when possible. Return compact JSON only: {\"answer\":\"A\"|\"B\",\"confidence\":0-1,\"reason\":\"short reason\"}. The answer must be A or B."
          },
          {
            role: "user",
            content: this.buildPrompt(input)
          }
        ]
      }),
      signal: AbortSignal.timeout(15_000)
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(`LiteLLM gateway failed with ${response.status}`);
    }

    const body = (await response.json()) as ChatCompletionResponse;
    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      throw new ServiceUnavailableException("LiteLLM gateway returned an empty response");
    }

    return this.parseAnswer(content);
  }

  private buildPrompt(input: TriviaCompletionInput): string {
    const evidence = input.evidence
      .map(
        (item, index) =>
          `${index + 1}. Title: ${item.title}\nSnippet: ${item.snippet}\nSource: ${item.source}`
      )
      .join("\n\n");

    return `Question: ${input.question}
A: ${input.options.A}
B: ${input.options.B}

Evidence:
${evidence || "No external evidence available."}

Return JSON only.`;
  }

  private parseAnswer(content: string): TriviaCompletionOutput {
    const jsonStart = content.indexOf("{");
    const jsonEnd = content.lastIndexOf("}");
    const raw = jsonStart >= 0 && jsonEnd >= jsonStart ? content.slice(jsonStart, jsonEnd + 1) : content;

    try {
      const parsed = JSON.parse(raw) as Partial<TriviaCompletionOutput>;
      const answer = parsed.answer === "B" ? "B" : parsed.answer === "A" ? "A" : undefined;
      if (!answer) {
        throw new Error("missing answer");
      }

      return {
        answer,
        confidence: this.clampConfidence(parsed.confidence),
        reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 240) : undefined
      };
    } catch {
      const answer = /\bB\b/i.test(content) && !/\bA\b/i.test(content) ? "B" : "A";
      return {
        answer,
        confidence: 0.5,
        reason: "Model returned non-JSON output; answer was coerced."
      };
    }
  }

  private clampConfidence(value: unknown): number {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return 0.5;
    }

    return Math.min(1, Math.max(0, value));
  }

  private baseUrl(): string {
    return this.config.get<string>("LITELLM_BASE_URL", "http://localhost:4001").replace(/\/$/, "");
  }

  private apiKey(): string {
    return this.config.get<string>("LITELLM_API_KEY", "dev_litellm_master_key");
  }
}
