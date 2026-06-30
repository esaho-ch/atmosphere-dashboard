"use server";

import { revalidatePath } from "next/cache";
import { saveSettings, loadSettings, type Settings } from "@/lib/settings";

export async function updateSettings(formData: FormData) {
  const current = loadSettings();

  const updated: Settings = {
    ca_cible: parseFloat(formData.get("ca_cible") as string) || current.ca_cible,
    materiel_max_ratio: (parseFloat(formData.get("materiel_max_ratio") as string) || 60) / 100,
    salaires: {
      personnel_fixe: parseFloat(formData.get("personnel_fixe") as string) || 0,
      personnel_interimaire: parseFloat(formData.get("personnel_interimaire") as string) || 0,
      personnel_administratif: parseFloat(formData.get("personnel_administratif") as string) || 0,
      charges_avs_ai_apg_ac: parseFloat(formData.get("charges_avs_ai_apg_ac") as string) || 0,
      prevoyance_professionnelle: parseFloat(formData.get("prevoyance_professionnelle") as string) || 0,
      assurance_accident: parseFloat(formData.get("assurance_accident") as string) || 0,
      assurance_maladie: parseFloat(formData.get("assurance_maladie") as string) || 0,
    },
    charges_fixes: {
      loyer: parseFloat(formData.get("loyer") as string) || 0,
      electricite: parseFloat(formData.get("electricite") as string) || 0,
      garantie_loyer: parseFloat(formData.get("garantie_loyer") as string) || 0,
      assurances: parseFloat(formData.get("assurances") as string) || 0,
      leasing: parseFloat(formData.get("leasing") as string) || 0,
      part_privee: parseFloat(formData.get("part_privee") as string) || 0,
      assurances_vehicules: parseFloat(formData.get("assurances_vehicules") as string) || 0,
      essence: parseFloat(formData.get("essence") as string) || 0,
      service: parseFloat(formData.get("service") as string) || 0,
      secretariat: parseFloat(formData.get("secretariat") as string) || 0,
      telephone_internet: parseFloat(formData.get("telephone_internet") as string) || 0,
      materiel_informatique: parseFloat(formData.get("materiel_informatique") as string) || 0,
      comptabilite_honoraires: parseFloat(formData.get("comptabilite_honoraires") as string) || 0,
      site_internet: parseFloat(formData.get("site_internet") as string) || 0,
      marketing: parseFloat(formData.get("marketing") as string) || 0,
      interets_banque: parseFloat(formData.get("interets_banque") as string) || 0,
      impots: parseFloat(formData.get("impots") as string) || 0,
      amortissement: parseFloat(formData.get("amortissement") as string) || 0,
    },
  };

  saveSettings(updated);
  revalidatePath("/");
  revalidatePath("/settings");
}
