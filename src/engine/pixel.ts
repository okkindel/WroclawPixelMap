// Filtr pikselowy: scena renderowana w niskiej rozdzielczości, potem kontury z głębi,
// dithering Bayera i kwantyzacja do palety. Canvas jest skalowany przez CSS (image-rendering: pixelated).
import * as THREE from 'three'
import { PALETTE } from './palette.ts'

const MAX_COLORS = 48

export class PixelPass {
  renderer: THREE.WebGLRenderer
  target: THREE.WebGLRenderTarget
  material: THREE.ShaderMaterial
  quad: THREE.Mesh
  scene: THREE.Scene
  cam: THREE.OrthographicCamera
  // obiekty podświetlone pod kursorem: rysowane do maski, filtr maluje złoty obrys wokół ich sylwetki
  highlight = new THREE.Scene()
  mask = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter })

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthTexture: new THREE.DepthTexture(1, 1),
    })
    const pal = PALETTE.map((h) => new THREE.Color(h))
    while (pal.length < MAX_COLORS) pal.push(pal[pal.length - 1])
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.target.texture },
        tDepth: { value: this.target.depthTexture },
        uRes: { value: new THREE.Vector2(1, 1) },
        uPal: { value: pal },
        uPalCount: { value: PALETTE.length },
        uPalette: { value: 1 },
        uOutline: { value: 1 },
        uMpp: { value: 1 },
        uDither: { value: 1 },
        uDepthRange: { value: 1 },
        uNight: { value: 0 },
        tMask: { value: null }, // THREE.Texture maski podświetlenia (ustawiana przy rysowaniu)
        uHighlight: { value: 0 },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 uRes;
        uniform vec3 uPal[${MAX_COLORS}]; uniform int uPalCount;
        uniform float uPalette; uniform float uOutline; uniform float uMpp; uniform float uDither; uniform float uDepthRange; uniform float uNight;
        uniform sampler2D tMask; uniform float uHighlight;
        varying vec2 vUv;
        float mk(vec2 o){ return texture2D(tMask, vUv + o / uRes).r; }
        float bayer(vec2 p){
          int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0));
          int i = x + y * 4;
          int m[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
          return float(m[i]) / 16.0 - 0.5;
        }
        float d(vec2 o){ return texture2D(tDepth, vUv + o / uRes).r * uDepthRange; }
        void main(){
          vec3 c = pow(clamp(texture2D(tColor, vUv).rgb, 0.0, 1.0), vec3(1.0 / 2.2));
          if (uOutline > 0.5) {
            float dc = d(vec2(0.0));
            float dn = min(min(d(vec2(1.0,0.0)), d(vec2(-1.0,0.0))), min(d(vec2(0.0,1.0)), d(vec2(0.0,-1.0))));
            // próg rośnie z metrami na piksel: pochylona ziemia przy oddaleniu nie liczy się jako krawędź
            if (dc - dn > 2.5 + uMpp * 1.6) c *= mix(0.55, 0.8, uNight);
          }
          if (uDither > 0.5) c += bayer(gl_FragCoord.xy) * 0.06;
          if (uPalette > 0.5) {
            vec3 best = c; float bd = 1e9;
            for (int i = 0; i < ${MAX_COLORS}; i++) {
              if (i >= uPalCount) break;
              vec3 e = (c - uPal[i]) * vec3(0.8, 1.0, 0.6);
              float dd = dot(e, e);
              if (dd < bd) { bd = dd; best = uPal[i]; }
            }
            c = best;
          }
          // obrys podświetlenia: piksel poza sylwetką, ale z sylwetką w promieniu 2 pikseli
          if (uHighlight > 0.5 && mk(vec2(0.0)) < 0.5) {
            float n = 0.0;
            for (int dx = -2; dx <= 2; dx++) for (int dy = -2; dy <= 2; dy++) {
              if (abs(float(dx)) + abs(float(dy)) <= 2.0) n = max(n, mk(vec2(float(dx), float(dy))));
            }
            if (n > 0.5) c = vec3(0.89, 0.70, 0.25);
          }
          gl_FragColor = vec4(c, 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
    })
    // paleta i obliczenia w przestrzeni sRGB (bufor sceny jest liniowy)
    for (const c of pal) c.convertLinearToSRGB()
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material)
    this.scene = new THREE.Scene()
    this.scene.add(this.quad)
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  }

  setSize(w: number, h: number) {
    this.target.setSize(w, h)
    this.mask.setSize(w, h)
    this.material.uniforms.uRes.value.set(w, h)
  }

  render(scene: THREE.Scene, camera: THREE.OrthographicCamera) {
    // kamera ortogonalna: głębia liniowa, zakres w metrach
    this.material.uniforms.uDepthRange.value = camera.far - camera.near
    this.renderer.setRenderTarget(this.target)
    this.renderer.render(scene, camera)
    const hi = this.highlight.children.length > 0
    this.material.uniforms.uHighlight.value = hi ? 1 : 0
    if (hi) {
      this.renderer.setRenderTarget(this.mask)
      this.renderer.setClearColor(0x000000, 1)
      this.renderer.clear()
      this.renderer.render(this.highlight, camera)
      this.material.uniforms.tMask.value = this.mask.texture
    }
    this.renderer.setRenderTarget(null)
    this.renderer.render(this.scene, this.cam)
  }
}
