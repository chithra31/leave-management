import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Setting } from '../entities';

export const SETTING_DEFAULTS = {
  minNoticeDays: 1,
  maxTeamOffPerDay: 2,
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

@Injectable()
export class SettingsService {
  constructor(@InjectRepository(Setting) private readonly repo: Repository<Setting>) {}

  /** Read one numeric rule, falling back to its default. Pass `manager` to read inside a transaction. */
  async getNumber(key: SettingKey, manager?: EntityManager): Promise<number> {
    const repo = manager ? manager.getRepository(Setting) : this.repo;
    const row = await repo.findOne({ where: { key } });
    return row ? Number(row.value) : SETTING_DEFAULTS[key];
  }

  async getAll(): Promise<Record<SettingKey, number>> {
    const out = { ...SETTING_DEFAULTS } as Record<SettingKey, number>;
    for (const row of await this.repo.find()) {
      if (row.key in out) out[row.key as SettingKey] = Number(row.value);
    }
    return out;
  }

  async set(key: SettingKey, value: number): Promise<void> {
    await this.repo.save({ key, value: String(value) });
  }
}
