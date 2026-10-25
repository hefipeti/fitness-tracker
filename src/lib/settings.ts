import { q1 } from './db';

export interface Settings {
  hunterName: string;
  kcalTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  startWeight: number | null;
  goalWeight: number | null;
  heightCm: number | null;
}

const DEFAULTS: Settings = {
  hunterName: 'Hunter',
  kcalTarget: 2300,
  proteinTarget: 160,
  carbsTarget: 250,
  fatTarget: 70,
  startWeight: null,
  goalWeight: null,
  heightCm: null,
};

export async function getSettings(uid: number): Promise<Settings> {
  const row = await q1<Settings>(
    `SELECT hunter_name AS "hunterName", kcal_target AS "kcalTarget", protein_target AS "proteinTarget",
            carbs_target AS "carbsTarget", fat_target AS "fatTarget", start_weight AS "startWeight",
            goal_weight AS "goalWeight", height_cm AS "heightCm"
     FROM settings WHERE user_id = $1`,
    [uid],
  );
  return row ?? DEFAULTS;
}
