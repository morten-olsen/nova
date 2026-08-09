import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

type TabletopPostProcess = {
  dispose: () => void;
  render: (elapsed: number) => void;
  resize: (width: number, height: number, pixelRatio: number) => void;
};

const frontierShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    varying vec2 vUv;
    float random(vec2 point) {
      return fract(sin(dot(point, vec2(12.9898, 78.233))) * 43758.5453);
    }
    void main() {
      vec4 sampled = texture2D(tDiffuse, vUv);
      float distanceFromCenter = distance(vUv, vec2(0.5));
      float vignette = smoothstep(0.22, 0.72, distanceFromCenter);
      float grain = random(vUv * 900.0 + time * 17.0) - 0.5;
      vec3 color = sampled.rgb * (1.0 - vignette * 0.2);
      color += grain * 0.01;
      gl_FragColor = vec4(color, sampled.a);
    }
  `,
};

const createTabletopPostProcess = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
): TabletopPostProcess => {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.22, 0.36, 0.74);
  composer.addPass(bloom);
  const frontierPass = new ShaderPass(frontierShader);
  const timeUniform = frontierPass.uniforms.time;
  if (!timeUniform) {
    throw new Error('Frontier post-process is missing its time uniform');
  }
  composer.addPass(frontierPass);
  composer.addPass(new OutputPass());

  return {
    render: (elapsed: number): void => {
      timeUniform.value = elapsed;
      composer.render();
    },
    resize: (width: number, height: number, pixelRatio: number): void => {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
    },
    dispose: (): void => composer.dispose(),
  };
};

export type { TabletopPostProcess };
export { createTabletopPostProcess };
