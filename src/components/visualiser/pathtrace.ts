import * as THREE from "three";

export interface RealisticRender {
  canvas: HTMLCanvasElement;
  stop: () => void;
  toBlob: () => Promise<Blob>;
  dispose: () => void;
}

/** Soft sky dome used as the light source for the path tracer (the raster view uses a PMREM room instead). */
function makeSky() {
  const w = 128, h = 64;
  const data = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1); // 0 = zenith, 1 = nadir
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      // moderate sky: bright enough to light the room, dim enough not to blow out whites
      const k = t < 0.5 ? 1.25 - t * 0.5 : 0.5 - (t - 0.5) * 0.5;
      data[i] = k * 1.0;
      data[i + 1] = k * 0.98;
      data[i + 2] = k * (t < 0.5 ? 1.05 : 0.9);
      data[i + 3] = 1;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export async function startRealisticRender(opts: {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  width: number;
  height: number;
  samples: number;
  onProgress: (samples: number, done: boolean) => void;
}): Promise<RealisticRender> {
  const { WebGLPathTracer } = await import("three-gpu-pathtracer");
  const { scene, width, height, samples, onProgress } = opts;

  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;

  const camera = opts.camera.clone();
  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  const prevEnv = scene.environment;
  const prevBg = scene.background;
  const prevIntensity = scene.environmentIntensity;
  const sky = makeSky();
  scene.environment = sky;
  scene.environmentIntensity = 1;
  scene.background = sky;

  const tracer = new WebGLPathTracer(renderer);
  tracer.bounces = 5;
  tracer.filterGlossyFactor = 0.5; // softens fireflies (white sparkles) on glossy surfaces
  tracer.renderDelay = 0;
  tracer.fadeDuration = 0;
  tracer.minSamples = 1;
  tracer.tiles.set(2, 2);
  tracer.setScene(scene, camera);

  let raf = 0;
  let running = true;
  const loop = () => {
    if (!running) return;
    tracer.renderSample();
    const n = Math.floor(tracer.samples);
    const done = n >= samples;
    onProgress(Math.min(n, samples), done);
    if (done) {
      running = false;
      return;
    }
    raf = requestAnimationFrame(loop);
  };
  loop();

  const restore = () => {
    scene.environment = prevEnv;
    scene.environmentIntensity = prevIntensity;
    scene.background = prevBg;
  };

  return {
    canvas: renderer.domElement,
    stop: () => {
      running = false;
      cancelAnimationFrame(raf);
    },
    toBlob: () =>
      new Promise<Blob>((resolve, reject) =>
        renderer.domElement.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/png")
      ),
    dispose: () => {
      running = false;
      cancelAnimationFrame(raf);
      restore();
      sky.dispose();
      tracer.dispose();
      renderer.dispose();
    },
  };
}
