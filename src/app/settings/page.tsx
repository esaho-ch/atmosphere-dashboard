import { loadSettings, computeMarginTargets } from "@/lib/settings";
import { updateSettings } from "./actions";
import Link from "next/link";

const fmt = (n: number) => n.toLocaleString("fr-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 });
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function Field({ label, name, value, note }: { label: string; name: string; value: number; note?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <label htmlFor={name} className="text-sm text-gray-800 flex-1">{label}</label>
      <div className="flex items-center gap-2">
        {note && <span className="text-xs text-gray-400">{note}</span>}
        <input
          id={name}
          name={name}
          type="number"
          step="0.01"
          defaultValue={value}
          className="w-32 text-right border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-xs text-gray-400 w-6">CHF</span>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const s = loadSettings();
  const targets = computeMarginTargets(s);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-8 py-5">
        <Link href="/" className="text-blue-600 text-sm hover:underline">← Dashboard</Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">Paramètres des charges</h1>
        <p className="text-sm text-gray-500 mt-1">Ces valeurs servent au calcul des marges sur toutes les offres.</p>
      </header>

      <main className="max-w-4xl mx-auto px-8 py-8 space-y-8">

        {/* Aperçu des ratios calculés */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-blue-900 mb-3">Ratios calculés automatiquement</h2>
          <div className="grid grid-cols-5 gap-4 text-center text-sm">
            <div>
              <div className="text-blue-600 font-bold text-lg">{pct(targets.material_max)}</div>
              <div className="text-blue-700 text-xs">Matériel max</div>
            </div>
            <div>
              <div className="text-blue-600 font-bold text-lg">{pct(targets.salary_ratio)}</div>
              <div className="text-blue-700 text-xs">Salaires ({fmt(targets.totalSalaires)})</div>
            </div>
            <div>
              <div className={`font-bold text-lg ${targets.gross_profit_target >= 0.20 ? "text-green-700" : "text-red-600"}`}>
                {pct(targets.gross_profit_target)}
              </div>
              <div className="text-blue-700 text-xs">Bénéfice brut exploit.</div>
            </div>
            <div>
              <div className="text-blue-600 font-bold text-lg">{pct(targets.fixed_costs_ratio)}</div>
              <div className="text-blue-700 text-xs">Charges fixes ({fmt(targets.totalChargesFixes)})</div>
            </div>
            <div>
              <div className={`font-bold text-lg ${targets.net_profit_target >= 0.05 ? "text-green-700" : "text-red-600"}`}>
                {pct(targets.net_profit_target)}
              </div>
              <div className="text-blue-700 text-xs">Bénéfice net</div>
            </div>
          </div>
        </div>

        <form action={updateSettings} className="space-y-6">

          {/* CA cible + seuil matériel */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Hypothèses globales</h2>
            <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
              <label htmlFor="ca_cible" className="text-sm text-gray-800 flex-1">CA annuel cible</label>
              <div className="flex items-center gap-2">
                <input
                  id="ca_cible"
                  name="ca_cible"
                  type="number"
                  step="1000"
                  defaultValue={s.ca_cible}
                  className="w-32 text-right border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400 w-6">CHF</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <label htmlFor="materiel_max_ratio" className="text-sm text-gray-800 flex-1">Seuil matériel maximum</label>
              <div className="flex items-center gap-2">
                <input
                  id="materiel_max_ratio"
                  name="materiel_max_ratio"
                  type="number"
                  step="0.5"
                  min="1"
                  max="99"
                  defaultValue={s.materiel_max_ratio * 100}
                  className="w-32 text-right border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400 w-6">%</span>
              </div>
            </div>
          </div>

          {/* Salaires */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex justify-between items-baseline mb-4">
              <h2 className="text-base font-semibold text-gray-900">Charges de personnel</h2>
              <span className="text-sm font-bold text-gray-700">Total : {fmt(targets.totalSalaires)}</span>
            </div>
            <Field label="Personnel fixe" name="personnel_fixe" value={s.salaires.personnel_fixe} />
            <Field label="Personnel intérimaire" name="personnel_interimaire" value={s.salaires.personnel_interimaire} />
            <Field label="Personnel administratif" name="personnel_administratif" value={s.salaires.personnel_administratif} />
            <Field label="Charges sociales AVS/AI/APG/AC" name="charges_avs_ai_apg_ac" value={s.salaires.charges_avs_ai_apg_ac} />
            <Field label="Prévoyance professionnelle (LPP)" name="prevoyance_professionnelle" value={s.salaires.prevoyance_professionnelle} />
            <Field label="Assurance accident (LAA)" name="assurance_accident" value={s.salaires.assurance_accident} />
            <Field label="Assurance perte de gain maladie" name="assurance_maladie" value={s.salaires.assurance_maladie} />
          </div>

          {/* Charges fixes */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex justify-between items-baseline mb-4">
              <h2 className="text-base font-semibold text-gray-900">Charges fixes</h2>
              <span className="text-sm font-bold text-gray-700">Total : {fmt(targets.totalChargesFixes)}</span>
            </div>
            <Field label="Loyer" name="loyer" value={s.charges_fixes.loyer} />
            <Field label="Électricité" name="electricite" value={s.charges_fixes.electricite} />
            <Field label="Garantie de loyer" name="garantie_loyer" value={s.charges_fixes.garantie_loyer} />
            <Field label="Assurances" name="assurances" value={s.charges_fixes.assurances} />
            <Field label="Leasing" name="leasing" value={s.charges_fixes.leasing} />
            <Field label="Part privée" name="part_privee" value={s.charges_fixes.part_privee} note="(déduction)" />
            <Field label="Assurances véhicules" name="assurances_vehicules" value={s.charges_fixes.assurances_vehicules} />
            <Field label="Essence" name="essence" value={s.charges_fixes.essence} />
            <Field label="Service / entretien" name="service" value={s.charges_fixes.service} />
            <Field label="Secrétariat" name="secretariat" value={s.charges_fixes.secretariat} />
            <Field label="Téléphone / internet" name="telephone_internet" value={s.charges_fixes.telephone_internet} />
            <Field label="Matériel informatique" name="materiel_informatique" value={s.charges_fixes.materiel_informatique} />
            <Field label="Comptabilité / honoraires" name="comptabilite_honoraires" value={s.charges_fixes.comptabilite_honoraires} />
            <Field label="Site internet" name="site_internet" value={s.charges_fixes.site_internet} />
            <Field label="Marketing" name="marketing" value={s.charges_fixes.marketing} />
            <Field label="Intérêts / banque" name="interets_banque" value={s.charges_fixes.interets_banque} />
            <Field label="Impôts" name="impots" value={s.charges_fixes.impots} />
            <Field label="Amortissement" name="amortissement" value={s.charges_fixes.amortissement} />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 transition"
            >
              Enregistrer les paramètres
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
