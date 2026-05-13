import {
  IsArray,
  IsBoolean,
  IsObject,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";

export class ChatMessageDto {
  @IsIn(["system", "user", "assistant"])
  role!: "system" | "user" | "assistant";

  @IsString()
  @MaxLength(4_000)
  content!: string;
}

export class ChatCompletionOptionsDto {
  @IsString()
  @MaxLength(180)
  A!: string;

  @IsString()
  @MaxLength(180)
  B!: string;
}

export class ChatCompletionDto {
  @IsString()
  @MaxLength(120)
  model!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];

  @IsOptional()
  @IsBoolean()
  stream?: boolean;

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsNumber()
  max_tokens?: number;

  @IsOptional()
  @IsNumber()
  top_p?: number;

  @IsOptional()
  @IsString()
  user?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  extra_body?: Record<string, unknown>;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChatCompletionOptionsDto)
  options?: ChatCompletionOptionsDto;
}
