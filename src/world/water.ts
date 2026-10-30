import type * as THREE from 'three'

// Woda: odblaski migoczące w siatce 3 m, przesuwające się z czasem.
export function waterShader(material: THREE.MeshLambertMaterial, uTime: THREE.IUniform<number>) {
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz;')
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime; varying vec3 vWPos;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
vec2 c = floor((vWPos.xz + vec2(uTime * 1.5, 0.0)) / 3.0);
float r = h21(c + floor(uTime * 1.2));
if (r > 0.985) diffuseColor.rgb = vec3(0.56, 0.76, 0.89);
else if (r > 0.95) diffuseColor.rgb *= 1.25;`,
      )
  }
  return material
}
