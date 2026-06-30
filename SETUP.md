# Atmo Margin Dashboard

## Setup

1. Récupérer le token API Bexio :
   - Bexio → Paramètres → API → Générer un token

2. Copier `.env.local.example` en `.env.local` et renseigner le token :
   ```
   BEXIO_API_TOKEN=xxxx
   ```

3. Lancer :
   ```
   npm run dev
   ```

## Logique de marge (basée sur Excel Atmosphere)

| Indicateur | Cible |
|---|---|
| Matériel / HT | < 60% |
| Salaires fixes alloués | 17% |
| Bénéfice brut exploitation | > 23% |
| Charges fixes allouées | 15% |
| Bénéfice net | > 8% |

## Prérequis Bexio

Les **prix d'achat** doivent être renseignés sur les positions des offres pour que le calcul de marge soit automatique.
