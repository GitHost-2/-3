// Fragmentos GLSL compartidos por los materiales propios.
export const ENV_UNIFORMS = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform vec3 uSunCol;
uniform vec3 uMoonCol;
uniform vec3 uAmbSky;
uniform vec3 uAmbGround;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uTime;
uniform float uNight;
`;

export const NOISE = /* glsl */ `
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm5(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(7.1, 3.7); a *= 0.5; }
  return s;
}
`;

export const FOG = /* glsl */ `
vec3 applyFog(vec3 c, float dist) {
  float f = 1.0 - exp(-pow(uFogDensity * dist, 2.0));
  return mix(c, uFogColor, clamp(f, 0.0, 1.0));
}
`;

// Debe coincidir con pathX() de terrain.js
export const PATH = /* glsl */ `
float pathX(float z) {
  float s = 18.0 - z;
  return 11.0 * sin(0.026 * s) * cos(0.011 * s);
}
`;

// Desplazamiento del viento en una brizna: t = 0 base, 1 punta.
export const WIND = /* glsl */ `
vec3 windBend(vec2 wp, float t, float h, float rnd) {
  float gust = sin(uTime * 0.9 + wp.x * 0.06 + wp.y * 0.045) * 0.5 + 0.5;
  float wave = sin(uTime * 2.1 + wp.x * 0.35 + wp.y * 0.22 + rnd * 6.2831) * 0.5
             + sin(uTime * 3.3 + wp.x * 0.9 - wp.y * 0.7) * 0.25;
  float bend = t * t * h * (0.10 + 0.24 * gust + 0.07 * wave);
  return vec3(bend * 0.95, -bend * bend * 0.35, bend * 0.30);
}
`;
