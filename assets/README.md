# Animación de la pantalla de carga (Lottie)

La pantalla de carga trae de serie una pareja de pajaritos en SVG. Para usar la animación de
LottieFiles que querías ([Bird pair love and flying sky](https://lottiefiles.com/es/free-animation/bird-pair-love-and-flying-sky-4LHUsFSYhQ)):

1. Abre esa página, pulsa **Descargar** y elige **Lottie JSON** (LottieFiles pide una cuenta gratuita).
2. Guarda el archivo aquí con el nombre exacto `assets/loading-birds.json`.
3. Ejecuta `npm install` (una vez) y `npm run build`.

El build detecta el archivo, lo incrusta en la página y reemplaza a los pajaritos SVG. Aparece
también una línea de crédito en el panel «Créditos». Si borras el archivo y vuelves a ejecutar
el build, regresan los pajaritos SVG.

Revisa la licencia que indica LottieFiles en la página de la animación antes de publicar.
