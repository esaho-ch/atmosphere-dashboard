import fs from "fs";
import path from "path";

const SETTINGS_PATH = path.join(process.cwd(), "data", "settings.json");

export interface Settings {
  ca_cible: number;
  materiel_max_ratio: number;
  salaires: {
    personnel_fixe: number;
    personnel_interimaire: number;
    personnel_administratif: number;
    charges_avs_ai_apg_ac: number;
    prevoyance_professionnelle: number;
    assurance_accident: number;
    assurance_maladie: number;
  };
  charges_fixes: {
    loyer: number;
    electricite: number;
    garantie_loyer: number;
    assurances: number;
    leasing: number;
    part_privee: number;
    assurances_vehicules: number;
    essence: number;
    service: number;
    secretariat: number;
    telephone_internet: number;
    materiel_informatique: number;
    comptabilite_honoraires: number;
    site_internet: number;
    marketing: number;
    interets_banque: number;
    impots: number;
    amortissement: number;
  };
}

export function loadSettings(): Settings {
  const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
  return JSON.parse(raw);
}

export function saveSettings(s: Settings): void {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(s, null, 2));
}

export function computeMarginTargets(s: Settings) {
  const totalSalaires = Object.values(s.salaires).reduce((a, b) => a + b, 0);
  const totalChargesFixes = Object.values(s.charges_fixes).reduce((a, b) => a + b, 0);

  const salary_ratio = totalSalaires / s.ca_cible;
  const fixed_costs_ratio = totalChargesFixes / s.ca_cible;
  const gross_profit_target = 1 - s.materiel_max_ratio - salary_ratio;
  const net_profit_target = gross_profit_target - fixed_costs_ratio;

  return {
    material_max: s.materiel_max_ratio,
    salary_ratio,
    gross_profit_target,
    fixed_costs_ratio,
    net_profit_target,
    totalSalaires,
    totalChargesFixes,
  };
}
