# Paquete Informativo

The downloadable PDF (`PPT_SECOYAS.pdf` at the repo root) is generated from the files in this folder. No PowerPoint is involved.

## When the figures change

1. Edit `datos.json`. All numbers are plain numbers (`25000`, not `"25.000"`); the build formats them Chilean-style.
2. Run `node paquete/build.js` from the repo root (needs Node and Chrome or Edge installed, nothing else).
3. Read the warnings: the build re-checks every sum, UF conversion and cross-page total, and that `index.html` quotes the same headline figures (ROI, payback, entrada, plazo). Warnings don't stop the build.
4. Open `paquete/paquete.html` in a browser to preview, or open the PDF directly.
5. Upload `PPT_SECOYAS.pdf` (plus `index.html` if you changed it) with FileZilla. The `paquete/` folder itself doesn't need to be on the server.

## Files

| File | What it is |
|---|---|
| `datos.json` | Every figure and text snippet that changes between versions |
| `build.js` | Checks the numbers, renders the HTML, prints the PDF |
| `estilos.css` | Layout and design (A4 landscape, site colors and fonts) |
| `img/`, `fuentes/` | Web-sized photos and the Montserrat/Raleway fonts |
| `paquete.html` | Generated preview — don't edit, it's overwritten on every build |
