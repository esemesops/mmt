import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CacheService } from "../cache/cache.service";
import { LlmGatewayService } from "../llm/llm-gateway.service";
import { SearchService } from "../search/search.service";
import { SearchResult } from "../search/search.types";
import { AnswerTriviaDto } from "./dto/answer-trivia.dto";
import { TriviaAnswer } from "./trivia.types";

const LLM_EVIDENCE_LIMIT = 3;
const RESPONSE_SOURCE_LIMIT = 5;

@Injectable()
export class TriviaService {
  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
    private readonly search: SearchService,
    private readonly llm: LlmGatewayService
  ) {}

  async answer(input: AnswerTriviaDto): Promise<TriviaAnswer> {
    const normalized = this.normalize(input);
    const answerKey = `trivia:${this.hash(JSON.stringify(normalized))}`;
    const cached = await this.cache.getJson<Omit<TriviaAnswer, "cached">>(answerKey);
    if (cached) {
      return {
        ...cached,
        cached: true
      };
    }

    const limit = this.config.get<number>("SEARCH_RESULT_LIMIT", 6);
    let results = await this.search.search(
      this.buildQuery(normalized.question, normalized.options.A, normalized.options.B),
      limit
    );

    if (results.length === 0) {
      results = await this.search.search(
        this.buildFallbackQuery(normalized.question, normalized.options.A, normalized.options.B),
        limit
      );
    }

    const sources = this.rankSources(results, normalized.options.A, normalized.options.B);

    const completion = await this.llm.answerTrivia({
      ...normalized,
      evidence: sources.slice(0, LLM_EVIDENCE_LIMIT)
    });

    const answer: Omit<TriviaAnswer, "cached"> = {
      ...completion,
      sources: sources.slice(0, RESPONSE_SOURCE_LIMIT)
    };

    await this.cache.setJson(answerKey, answer);
    return {
      ...answer,
      cached: false
    };
  }

  private normalize(input: AnswerTriviaDto): AnswerTriviaDto {
    return {
      question: input.question.trim().replace(/\s+/g, " "),
      options: {
        A: input.options.A.trim().replace(/\s+/g, " "),
        B: input.options.B.trim().replace(/\s+/g, " ")
      },
      idempotencyKey: input.idempotencyKey
    };
  }

  private buildQuery(question: string, optionA: string, optionB: string): string {
    return `${question} ${optionA} ${optionB} music`;
  }

  private buildFallbackQuery(question: string, optionA: string, optionB: string): string {
    return `${optionA} ${optionB} ${question} song artist released`;
  }

  private rankSources(results: SearchResult[], optionA: string, optionB: string): SearchResult[] {
    return [...results].sort((left, right) => {
      return this.score(right, optionA, optionB) - this.score(left, optionA, optionB);
    });
  }

  private score(result: SearchResult, optionA: string, optionB: string): number {
    const text = `${result.title} ${result.snippet}`.toLowerCase();
    const optionAScore = text.includes(optionA.toLowerCase()) ? 2 : 0;
    const optionBScore = text.includes(optionB.toLowerCase()) ? 2 : 0;
    const musicScore = /\b(song|album|artist|singer|music|track|released|lyrics)\b/i.test(text) ? 1 : 0;
    return optionAScore + optionBScore + musicScore;
  }

  private hash(value: string): string {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(index);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
}
