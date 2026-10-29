# Terning

En terning-app til hjemmeskærmen: 1–6 terninger, tryk for at slå, virker uden net.

Ingen afhængigheder – kun Node (v20.15+).

```sh
node --test        # tests
node build.mjs     # → dist/site/
python3 -m http.server 8000 -d dist/site   # prøv lokalt
```

Udgives automatisk på GitHub Pages ved push til `main` (`.github/workflows/pages.yml`).

## Installér på iPhone

Åbn siden i Safari → Del → Føj til hjemmeskærm. Appen åbner i fuld skærm og virker også i flytilstand.

Ikonerne i `assets/icons/` laves med `node scripts/icons.mjs`.
