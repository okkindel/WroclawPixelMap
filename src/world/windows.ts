import * as THREE from 'three'

// Okna: proceduralna siatka na ścianach (aWin=1), w nocy część się zapala.
export function windowShader<M extends THREE.Material>(material: M, uniforms: Record<string, THREE.IUniform>): M {
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aWin;\nvarying float vWin;\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWin = aWin;\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz;\nvWNrm = normalize(mat3(modelMatrix) * objectNormal);')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uNight; uniform float uSnow;
varying float vWin; varying vec3 vWPos; varying vec3 vWNrm;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float winLit = 0.0;
if (vWin > 0.5 && abs(vWNrm.y) < 0.3) {
  float along = dot(vWPos.xz, normalize(vec2(-vWNrm.z, vWNrm.x)));
  vec2 cell = vec2(along / 3.4, (vWPos.y - 1.2) / 3.2);
  vec2 f = fract(cell);
  bool inWin = f.x > 0.28 && f.x < 0.72 && f.y > 0.3 && f.y < 0.8 && vWPos.y > 2.0;
  if (inWin) {
    float r = h21(floor(cell) + floor(vWPos.xz / 97.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.19, 0.27), 0.65);
    winLit = step(0.55, r) * uNight;
  }
}
if (vWNrm.y > 0.5) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.96, 1.0), uSnow * 0.85);`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.82, 0.42) * winLit * 0.9;')
  }
  return material
}
