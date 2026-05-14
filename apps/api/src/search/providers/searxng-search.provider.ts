import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SearchInput, SearchProvider, SearchResult } from "../search.types";

interface SearxngResult {
  title?: string;
  url?: string;
  content?: string;
  engine?: string;
}

interface SearxngResponse {
  results?: SearxngResult[];
}

@Injectable()
export class SearxngSearchProvider implements SearchProvider {
  constructor(private readonly config: ConfigService) {}

  async search(input: SearchInput): Promise<SearchResult[]> {
    const baseUrl = this.config.get<string>("SEARXNG_BASE_URL", "http://localhost:8080").replace(/\/$/, "");
    const params = new URLSearchParams({
      q: input.query,
      format: "json",
      language: "en",
      safesearch: "1"
    });

    const response = await fetch(`${baseUrl}/search?${params}`, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": "MMT/0.1 (+https://github.com/esemesops/mmt)",
        "X-Forwarded-For": "127.0.0.1",
        "X-Real-IP": "127.0.0.1"
      },
      signal: AbortSignal.timeout(8_000)
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(`SearXNG failed with ${response.status}`);
    }

    const body = (await response.json()) as SearxngResponse;
    return (body.results ?? [])
      .filter((result) => result.title && result.url && result.content)
      .slice(0, input.limit)
      .map((result) => ({
        title: result.title ?? "",
        url: result.url ?? "",
        snippet: result.content ?? "",
        source: result.engine ?? this.hostname(result.url ?? "")
      }));
  }

  private hostname(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "unknown";
    }
  }
}
