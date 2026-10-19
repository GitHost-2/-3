# Atardecer en el campo

Una historia en movimiento que se desplaza sola, sin que haya que tocar nada. Dura unos 2 minutos y medio.

| Tiempo | Qué pasa |
| --- | --- |
| 0:01 | Pantalla negra con letras elegantes: «Jamás pensamos que nuestros caminos se unirían». |
| 0:11 | «Pero sin duda» y «repetiría esta historia una y mil veces :)». |
| 0:26 | El negro se disuelve y aparece la noche: estrellas, luciérnagas, un molino y la luna cuadrada de píxeles estilo Minecraft. |
| 0:32 | Detrás de la luna sale «Feliz cumpleaños mi amor», con el mismo color de la luna. |
| 0:47 | La cámara baja hacia el campo. |
| 0:50 | Cuatro gatitos con gorro de cumpleaños pasan en fila. En la panza llevan X, i, m, e. |
| 1:10 | La página baja sola hacia un tornado de cartas rosas sobre fondo lila. Cuatro fotos salen al frente una a una. |
| 1:53 | La página baja al final: «El amor que te tengo no se puede describir con palabras, pero sin duda quiero que seas tú con quien comparta mi presente y mi futuro» y un corazón. |

Al terminar aparece un botón discreto para volver a verla.

## Verlo

Abre `index.html` con doble clic (no necesita servidor) o `atardecer-en-el-campo.html`, que es lo mismo en un solo
archivo. Hace falta un navegador con WebGL (Chrome, Edge, Firefox, Safari).

## Poner las 4 fotos

Copia 4 fotos en `assets/photos/` (ver [`assets/photos/README.md`](assets/photos/README.md)) y ejecuta:

```
npm install
npm run build
```

Mientras no haya fotos, las cartas muestran «Tu foto aquí».

## Cambiar textos y tiempos

- Las frases de inicio y el mensaje final están en `src/template.html`.
- Todos los tiempos (cuándo sale cada cosa, cuánto dura) están juntos en el objeto `TL` de `src/main.js`.
- El texto de la luna está en `src/sky.js` (`makeTextTexture`) y las letras de los gatitos en `src/cats.js` (`LETTERS`).

## Cómo está hecho

Todo se genera en código con [three.js](https://threejs.org) (MIT). No hay modelos 3D ni texturas externas.

- `src/env.js`: luz, colores del cielo y posición de la luna.
- `src/sky.js`: cielo, nubes, estrellas cuadradas, luna de 16×16 píxeles y el texto que sale tras ella.
- `src/terrain.js`, `src/grass.js`, `src/props.js`, `src/fireflies.js`: campo, hierba con viento, flores, árboles, molino y luciérnagas.
- `src/cats.js`: gatitos de bloques con gorro escalonado, caminata y letras.
- `src/tornado.js`, `src/hearts.js`, `src/finale.js`: tornado de cartas, corazones y escena final.
- `src/main.js`: el guion. Todo es función del tiempo, así que se puede saltar a cualquier momento con `?at=60` (segundos) y `&still` para pausar. Sirve para probar.
- `build.mjs`: empaqueta, incrusta las tipografías y las fotos, y genera `index.html`, `dist/app.js` y `atardecer-en-el-campo.html`.

## Dónde descargar animaciones y recursos

Ordenado por tipo. Comprueba siempre la licencia de cada archivo antes de usarlo. Desde el entorno donde se
construyó esto solo se podía descargar de npm y GitHub, por eso las tipografías vienen de npm y lo demás se dibujó en código.

**Animaciones Lottie (JSON) y animaciones 2D**
- [LottieFiles: corazones](https://lottiefiles.com/free-animations/hearts), [amor](https://lottiefiles.com/free-animations/love) y [cumpleaños](https://lottiefiles.com/free-animations/birthday).
- [IconScout: corazones y amor](https://iconscout.com/lottie-animations/love-heart), con licencia propia por cada animación.
- Otras opciones: Lordicon (iconos animados), Creattie, Rive, Lottielab y SVGator para crear o editar; [Glaxnimate](https://glaxnimate.org) es gratuito y de código abierto.

**Modelos 3D animados (gatos y personajes)**
- [Quaternius: LowPoly Animated Animals](https://quaternius.itch.io/lowpoly-animated-animals), seis animales con caminar y correr, CC0.
- [Kenney](https://kenney.nl) y [Poly Pizza](https://poly.pizza), modelos low-poly en glTF/GLB. Kenney es CC0; en Poly Pizza la mayoría pide atribución.
- Sketchfab: [Cat Rigged & Animated Low Poly](https://sketchfab.com/3d-models/cat-rigged-animated-low-poly-7510ec711d204b5788262c6d5eb678ed) y [Low Poly Cat Walk](https://sketchfab.com/3d-models/low-poly-cat-walk-13674c3dbb074f73b6563a75c28b0fe0). Mira la licencia de cada uno.
- [Mixamo](https://www.mixamo.com): animaciones para personajes con rig, gratis con cuenta de Adobe.
- Gato de Minecraft con rig: solo lo encontré de pago ([TurboSquid](https://www.turbosquid.com/3d-models/3d-model-minecraft-cat-all-skins-and-ocelot-collection-rigged-3d-model-game-ready-4k-pbr-2617853)). Por eso los gatitos de esta página están hechos con cubos en código.

**Sprites en pixel art**
- [Cat sprites (OpenGameArt)](https://opengameart.org/content/cat-sprites), CC0, con ciclos de caminar y correr.
- [Pixel Art Hearts](https://thiagozen.itch.io/pixel-art-hearts) (CC BY 4.0) y [16x16 Animated Hearts](https://dmitriy-shmilo.itch.io/16x16-animated-hearts).

**Librerías y ejemplos de animación web**
- [10 mejores librerías de animación gratuitas](https://webdesignerdepot.com/10-best-free-animation-libraries-for-the-web): GSAP, anime.js, animate.css, Animista.
- [Codrops: experiencias de scroll 3D cinematográficas con GSAP](https://tympanus.net/codrops/2025/11/19/how-to-build-cinematic-3d-scroll-experiences-with-gsap/) y su [código en GitHub](https://github.com/JosephASG/codrops-cinematic-scroll-animations) (MIT).
- Galerías en espiral con three.js: [hilo del foro](https://discourse.threejs.org/t/create-3d-spiral-carousel/72873) y [ejemplo en CodePen](https://codepen.io/xrclub/pen/eYVdLZL).

**Tipografías**
- [Fontsource](https://fontsource.org): tipografías de Google Fonts como paquetes de npm, para alojarlas uno mismo.

## Créditos y licencias

- three.js: licencia MIT.
- Tipografías incrustadas, licencia SIL Open Font License 1.1: Cormorant Garamond y Pixelify Sans (vía Fontsource).
- La luna de píxeles y los gatitos son de dibujo propio, inspirados en Minecraft. Este proyecto no está afiliado a Mojang ni a Microsoft y no usa ninguno de sus archivos.
