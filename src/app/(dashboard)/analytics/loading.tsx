"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Chargement des ordres Bexio…",
  "Chargement des factures…",
  "Calcul des statuts de paiement…",
  "Répartition par groupe client…",
  "Comparaison année précédente…",
  "Finalisation des graphiques…",
];

export default function AnalyticsLoading() {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((i) => (i + 1) % STEPS.length);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <h1 className="text-lg font-bold text-slate-900">Analyse</h1>
        <p className="text-sm text-slate-400 mt-0.5">Vue d'ensemble des ventes et paiements</p>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 text-center">

          {/* Spinner custom avec double anneau */}
          <div className="relative size-16">
            <svg className="size-16 animate-spin" viewBox="0 0 64 64" style={{ animationDuration: "1.2s" }}>
              <circle cx="32" cy="32" r="26" fill="none" stroke="#e2e8f0" strokeWidth="4" />
              <circle
                cx="32" cy="32" r="26"
                fill="none" stroke="#0f172a" strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="40 124"
              />
            </svg>
          </div>

          {/* Étape en cours */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-slate-800 transition-all duration-300">
              {STEPS[stepIndex]}
            </p>
            <p className="text-xs text-slate-400">Récupération des données Bexio en cours</p>
          </div>

          {/* Indicateurs de progression (points) */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i === stepIndex
                    ? "size-2 bg-slate-800"
                    : i < stepIndex
                    ? "size-1.5 bg-slate-300"
                    : "size-1.5 bg-slate-100"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
