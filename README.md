# Terning

En terning-app til hjemmeskærmen: 1–6 terninger, tryk for at slå, virker uden net.

**Åbn appen: <https://emilberntsen-ui.github.io/terning/>**

Ingen npm-afhængigheder – kun Node (v20.15+). Terningerne tegnes i WebGL med three.js 0.170.0, som ligger i `src/vendor/`
(hentes med `node scripts/vendor.mjs`, committes, og precaches af service workeren, så appen virker uden net). Uden WebGL vises flade terninger.

```sh
node --test        # tests
node build.mjs     # → dist/site/
python3 -m http.server 8000 -d dist/site   # prøv lokalt
```

Udgives automatisk på GitHub Pages ved push til `main` (`.github/workflows/pages.yml`).

## Installér på iPhone

Åbn siden i Safari → Del → Føj til hjemmeskærm. Appen åbner i fuld skærm og virker også i flytilstand.

Ikonerne i `assets/icons/` laves med `node scripts/icons.mjs`.
