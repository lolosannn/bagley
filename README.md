# Bagley · concepto web

Sitio estático interactivo para Bagley (160 años). Proyecto de portfolio de Avanth Studio, no oficial.

- `index.html`, `css/styles.css`, `js/`: la web. Sin build: Lenis se carga desde jsDelivr.
- `js/hero.js`: inicio que se llena de galletitas con física mientras bajás.
- `js/crack.js`: galletitas en foto que se parten con el scroll (`assets/fotos/`).
- `js/pinata.js`: footer con galletitas que se empujan con el mouse.
- `design/`: propuesta de diseño, laboratorio 3D y demo de galletitas partidas.

## Ver en GitHub Pages

Settings → Pages → Source: *Deploy from a branch* → rama `claude/kind-turing-x2nypw`, carpeta `/ (root)`.

Para probar local: `python3 -m http.server` en la carpeta y abrir http://localhost:8000 (hace falta servidor, no abrir el archivo directo).

## Seguridad

Ver `SECURITY.md`. Para proteger el repo en GitHub (lo hace el dueño desde Settings):

- **Branches → Add rule** sobre la rama publicada: *Require a pull request before merging* y *Do not allow bypassing*.
- **Actions → General**: *Require approval for all outside collaborators* (no hay workflows, pero evita que se agreguen sin revisión).
- **Code security**: activar *Secret scanning* y *Dependabot alerts*.
