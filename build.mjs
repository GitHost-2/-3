// Empaqueta la historia en un solo JS y genera: index.html, dist/app.js,
// un HTML autónomo (un único archivo) y la variante para publicar como Artifact.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const at = (...p) => path.join(root, ...p);

// Las 4 fotos del tornado: assets/photos/*.jpg|png|webp (las primeras 4, por orden alfabético).
async function loadPhotoData() {
  const dir = at('assets', 'photos');
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort().slice(0, 4);
  let sharp = null;
  try { sharp = (await import('sharp')).default; } catch (_) { console.warn('sharp no está instalado: las fotos se incrustan sin reducir.'); }
  const out = [];
  for (const f of files) {
    const buf = fs.readFileSync(path.join(dir, f));
    let data = buf;
    let mime = /\.png$/i.test(f) ? 'image/png' : /\.webp$/i.test(f) ? 'image/webp' : 'image/jpeg';
    if (sharp) {
      data = await sharp(buf).rotate().resize({ width: 900, height: 1200, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
      mime = 'image/jpeg';
    }
    out.push(`data:${mime};base64,${data.toString('base64')}`);
    console.log(`foto incrustada: ${f} (${(data.length / 1024).toFixed(0)} KB)`);
  }
  if (out.length < 4) console.log(`Hay ${out.length} foto(s) en assets/photos; las que faltan se muestran como tarjetas de relleno.`);
  return out;
}
const photos = await loadPhotoData();

// Tipografías locales (OFL) incrustadas en base64: no dependen de internet.
const FONT_DEFS = [
  ['Cormorant Garamond', 'italic', 300, '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-300-italic.woff2'],
  ['Cormorant Garamond', 'italic', 400, '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-italic.woff2'],
  ['Cormorant Garamond', 'italic', 500, '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-italic.woff2'],
  ['Pixelify Sans', 'normal', 700, '@fontsource/pixelify-sans/files/pixelify-sans-latin-700-normal.woff2'],
];
const fontCss = FONT_DEFS.map(([family, style, weight, file]) => {
  const b64 = fs.readFileSync(at('node_modules', file)).toString('base64');
  return `@font-face{font-family:"${family}";font-style:${style};font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${b64}) format("woff2")}`;
}).join('\n');

const virtual = {
  name: 'virtual',
  setup(build) {
    build.onResolve({ filter: /^virtual:/ }, (a) => ({ path: a.path, namespace: 'virtual' }));
    build.onLoad({ filter: /.*/, namespace: 'virtual' }, (a) => {
      if (a.path === 'virtual:photos') return { contents: `export default ${JSON.stringify(photos)};`, loader: 'js' };
      return null;
    });
  },
};

fs.mkdirSync(at('dist'), { recursive: true });
await esbuild.build({
  entryPoints: [at('src', 'main.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  outfile: at('dist', 'app.js'),
  legalComments: 'none',
  plugins: [virtual],
  logLevel: 'warning',
});

const js = fs.readFileSync(at('dist', 'app.js'), 'utf8');
const inline = js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const template = fs.readFileSync(at('src', 'template.html'), 'utf8').replace('/*FONT_FACES*/', () => fontCss);
const MARK = '<!--APP_SCRIPT-->';
const head = '<!doctype html>\n<html lang="es">\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n';

// index.html: carga dist/app.js (funciona abriéndolo directamente, sin servidor).
fs.writeFileSync(at('index.html'), head + template.replace(MARK, '<script src="dist/app.js"></script>'));
// Un solo archivo, para enviarlo o abrirlo en cualquier sitio.
fs.writeFileSync(at('atardecer-en-el-campo.html'), head + template.replace(MARK, () => `<script>${inline}</script>`));
// Fragmento sin doctype/html/head/body, tal como lo pide la plataforma de Artifacts.
fs.writeFileSync(at('dist', 'artifact.html'), template.replace(MARK, () => `<script>${inline}</script>`));

const kb = (f) => (fs.statSync(f).size / 1024).toFixed(0) + ' KB';
console.log(`dist/app.js ${kb(at('dist', 'app.js'))} · atardecer-en-el-campo.html ${kb(at('atardecer-en-el-campo.html'))}`);
