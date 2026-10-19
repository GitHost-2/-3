// Empaqueta la escena en un solo JS y genera: index.html, dist/app.js,
// un HTML autónomo (un único archivo) y la variante para publicar como Artifact.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const at = (...p) => path.join(root, ...p);

// Si existe assets/loading-birds.json (animación Lottie), se incrusta en la pantalla de carga.
let lottieJson = null;
const lottieFile = at('assets', 'loading-birds.json');
if (fs.existsSync(lottieFile)) {
  try {
    lottieJson = JSON.parse(fs.readFileSync(lottieFile, 'utf8'));
    if (!Array.isArray(lottieJson.layers)) throw new Error('no tiene "layers": ¿es un Lottie JSON?');
    console.log(`Lottie incrustado: ${path.relative(root, lottieFile)}`);
  } catch (err) {
    console.warn(`assets/loading-birds.json ignorado: ${err.message}`);
    lottieJson = null;
  }
}

const virtual = {
  name: 'virtual',
  setup(build) {
    build.onResolve({ filter: /^virtual:/ }, (a) => ({ path: a.path, namespace: 'virtual' }));
    build.onLoad({ filter: /.*/, namespace: 'virtual' }, (a) => {
      if (a.path === 'virtual:loading-lottie-data') {
        return { contents: `export default ${lottieJson ? JSON.stringify(lottieJson) : 'null'};`, loader: 'js' };
      }
      if (a.path === 'virtual:lottie-player') {
        return lottieJson
          ? { contents: "import lottie from 'lottie-web/build/player/lottie_light.min.js'; export default lottie;", loader: 'js', resolveDir: root }
          : { contents: 'export default null;', loader: 'js' };
      }
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
const template = fs.readFileSync(at('src', 'template.html'), 'utf8');
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
