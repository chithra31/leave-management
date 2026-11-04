import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LeaveService } from '../leave/leave.service';
import type { Actor } from '../leave/leave.service';
import { AvailabilityEntry, buildPrompt, templateSummary } from './summary.logic';

export interface AvailabilitySummary {
  from: string;
  to: string;
  summary: string;
  /** 'ai' when the model wrote it, 'template' for the built-in fallback. */
  source: 'ai' | 'template';
}

@Injectable()
export class SummaryService {
  private readonly log = new Logger(SummaryService.name);

  constructor(
    private readonly leave: LeaveService,
    private readonly config: ConfigService,
  ) {}

  async availability(actor: Actor, from: string, to: string): Promise<AvailabilitySummary> {
    const entries: AvailabilityEntry[] = await this.leave.calendar(actor, from, to);
    const fallback = templateSummary(entries, from, to);

    const apiKey = this.config.get<string>('AI_API_KEY');
    if (!apiKey) return { from, to, summary: fallback, source: 'template' };

    try {
      const text = await this.askModel(apiKey, buildPrompt(entries, from, to));
      return { from, to, summary: text, source: 'ai' };
    } catch (err) {
      this.log.warn(`AI summary failed, using template: ${(err as Error).message}`);
      return { from, to, summary: fallback, source: 'template' };
    }
  }

  private async askModel(apiKey: string, prompt: string): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.get('AI_MODEL', 'claude-haiku-5-5'),
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`AI API returned ${res.status}`);
    const body = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = body.content?.find((c) => c.type === 'text')?.text?.trim();
    if (!text) throw new Error('AI API returned no text');
    return text;
  }
}
