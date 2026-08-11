import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import * as THREE from 'three';

import { novaFactions, novaPalette, toColorValue } from './nova-palette.js';
import { createPlaceholder, loadPieceModel, setOwnerColor } from './tabletop-assets.js';
import type { PieceKind } from './tabletop-layout.js';

/**
 * Turntable previews of the piece models, drawn by the renderer that draws the
 * board.
 *
 * The point is not decoration. A page that claims its trailer is the real game
 * should not illustrate the pieces with renders made somewhere else, and these
 * are the same GLBs, the same `FactionAccent` tinting and the same tone mapping
 * the board uses — so a piece that changes in Blender changes here without
 * anyone remembering to re-export a PNG.
 *
 * One WebGL context, many cards. A context per card would be simpler, but
 * browsers cap the number of live contexts somewhere around eight to sixteen
 * and silently kill the oldest to make room, which on an eleven-piece grid
 * means the first cards go black as the last ones start. So this is three.js's
 * multiple-elements pattern: a single canvas laid over the grid, and one
 * scissored viewport per card.
 *
 * The canvas is positioned inside the grid rather than against the viewport,
 * and that is not a detail. Fixed to the viewport, the canvas has to be
 * repainted every frame to stay under cards that the compositor is scrolling
 * without it — so the pieces trail the page by however long a frame takes, which
 * reads as an unasked-for parallax. Placed in the scrolled content, the canvas
 * and the cards move together as one layer and there is nothing left to
 * synchronise.
 */

type PiecePreviewStageOptions = {
  /**
   * The element the canvas covers, and the coordinate space every card rect is
   * measured against. Should be the smallest box containing all the cards: its
   * size is the size of the drawing buffer.
   */
  container: HTMLElement;
  /** Turntable speed, radians per second. */
  spin?: number;
  /**
   * Frame cap. Eleven turntables have nothing to say at 60fps that they do not
   * say at 30, and the halved GPU cost is the difference between a decorative
   * grid and one that shows up in a laptop's fan.
   */
  fps?: number;
};

type PiecePreviewStage = {
  /**
   * Draws `kind` over `element` until the stage is disposed. Resolves once the
   * model has arrived and the piece is on the canvas.
   */
  add: (element: HTMLElement, kind: PieceKind) => Promise<void>;
  dispose: () => void;
};

type PreviewEntry = {
  angle: number;
  distance: number;
  element: HTMLElement;
  /** Height of the piece's own centre, so the camera looks at the piece rather than its feet. */
  focus: number;
  pivot: THREE.Group;
};

type Disposable = { dispose: () => void };

const fieldOfView = 32;

/**
 * The lighting that makes a piece look like an object rather than a diagram.
 *
 * Direct lights alone are what the board uses, and on the board they are enough:
 * a piece is small, seen from above, and surrounded by lit terrain that fills in
 * everything the key light misses. Isolated on a card at four times the size,
 * the same rig reads as flat paint, because these are PBR materials — the
 * chassis is `metalness: 0.22`, the accents are emissive — and metal with
 * nothing to reflect resolves to one dull tone no matter how many directional
 * lights are aimed at it.
 *
 * So the previews get an environment to reflect. `RoomEnvironment` is generated
 * on the GPU rather than downloaded, which keeps a feature justified by page
 * weight from quietly adding an HDRI to it, and gives every curved surface a
 * gradient across it and every edge a highlight to catch. The direct lights stay
 * on top at reduced strength: the environment supplies the material read, they
 * supply the palette and the direction.
 */
const createEnvironment = (renderer: THREE.WebGLRenderer, scene: THREE.Scene): (() => void) => {
  const generator = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = generator.fromScene(room, 0.04);
  scene.environment = environment.texture;
  // Under 1: a full-strength studio wash flattens the contrast the key light is
  // there to create, and turns the board's cold palette neutral.
  scene.environmentIntensity = 0.55;

  room.dispose();
  generator.dispose();

  return () => {
    environment.texture.dispose();
  };
};

/**
 * A hard three-point rig, deliberately more theatrical than the board's.
 *
 * The board lights a whole world, so its key has to stay soft enough that forty
 * tiles all read at once. A card holds one object against nothing, which is the
 * situation product photography is for: a bright raking key that carves the form,
 * a cold rim hard enough to cut a lit edge out of the dark, and a fill low enough
 * that the shadow side actually goes dark. The same rig on the board would look
 * lurid. Here it is what stops a piece looking like a diagram of itself.
 */
const addLighting = (scene: THREE.Scene): void => {
  // Deliberately low. The environment does the fill now, and a fill that lifts
  // the shadow side is exactly what flattens a single object.
  scene.add(new THREE.HemisphereLight(0xbcd0e0, 0x3a2e22, 0.35));

  // Raking rather than overhead: a light nearly above the piece lights the top
  // faces evenly and tells you nothing about the sides.
  const keyLight = new THREE.DirectionalLight(0xfff2dc, 3.1);
  keyLight.position.set(2.6, 2.4, 1.8);
  scene.add(keyLight);

  // Hard and cold along the far edge, opposite the key. This is what separates a
  // piece from the dark card behind it, and it is the single most dramatic light
  // in the rig — on the board there is lit terrain to do this job, and here
  // there is nothing.
  const rimLight = new THREE.DirectionalLight(0x5aa9ff, 2.3);
  rimLight.position.set(-2.8, 1.2, -2.6);
  scene.add(rimLight);

  // A warm kicker up into the underside, so the parts in shadow are dark rather
  // than black and the piece keeps its silhouette against the backdrop.
  const kicker = new THREE.DirectionalLight(0xffbe86, 0.65);
  kicker.position.set(-0.6, -1.8, 2.2);
  scene.add(kicker);
};

/**
 * The studio backdrop, parented to the camera.
 *
 * Cards are transparent otherwise, and a piece floating on the panel colour has
 * nothing behind it to separate from. This is a plane pinned just in front of the
 * near clip and scaled to exactly fill the frustum, so it fills every card
 * identically no matter how far back that card's piece pushed the camera — which
 * a backdrop placed in world space could not do, since the framing distance
 * varies by an order of magnitude between a material cache and a radar.
 *
 * Being a real object in the scene rather than a post-processed vignette is what
 * makes it cheap: no second pass, no render target, and it cannot bleed into the
 * gutters between cards the way a fullscreen effect would.
 */
const createBackdrop = (camera: THREE.PerspectiveCamera): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> => {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context) {
    // Off-centre and high: the bright part of the backdrop sits behind the
    // piece's lit shoulder, which reads as a light source in the room rather
    // than as a gradient someone applied.
    const gradient = context.createRadialGradient(size * 0.62, size * 0.34, 0, size * 0.5, size * 0.5, size * 0.72);
    gradient.addColorStop(0, '#1b2438');
    gradient.addColorStop(0.55, '#0d1322');
    gradient.addColorStop(1, '#05070f');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const distance = 8;
  const height = 2 * distance * Math.tan((camera.fov * Math.PI) / 360);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(height, height),
    // Unlit and never in the depth buffer: it is a background, and the moment it
    // takes part in depth the piece can clip into it.
    new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false, map: texture }),
  );
  mesh.position.z = -distance;
  mesh.renderOrder = -1;
  camera.add(mesh);
  return mesh;
};

/**
 * A dark, faintly polished floor.
 *
 * Roughness under 0.5 with the environment behind it means the disc reflects
 * something, and a piece standing on a surface that reflects it is the difference
 * between an object photographed and an object cut out. Kept small and faded at
 * the edge by the contact shadow that sits on top of it.
 */
const createFloor = (): THREE.Mesh<THREE.CircleGeometry, THREE.MeshStandardMaterial> => {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshStandardMaterial({ color: 0x0b1120, metalness: 0.65, roughness: 0.42 }),
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
};

const black = new THREE.Color(0x000000);

/**
 * Lifts the emissive materials slightly past their board values.
 *
 * `Energy` and `FactionAccent` are the two materials the pieces use to say they
 * are powered, and at board scale they are a couple of pixels each. Filling a
 * card, they are the only part of the model carrying a colour of its own, and a
 * small lift is enough to push them over the bloom threshold so they read as
 * lit rather than painted.
 *
 * Small is the operative word. This multiplies with the bloom pass, and the two
 * of them turned up together do not make a piece look powered — they make every
 * seam on it glow, which is a Christmas tree rather than a machine. If the
 * accents need more presence, the bloom threshold is the dial to reach for
 * first, because it decides *what* glows rather than how much everything does.
 *
 * Every material it touches is cloned first. `clone()` on a loaded model shares
 * its materials with the cached original — the same original the board is
 * drawing from — so mutating one in place would quietly relight the hero board
 * from down here.
 */
const boostEmissives = (object: THREE.Object3D): THREE.Material[] => {
  const cloned: THREE.Material[] = [];
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    child.material = materials.map((material) => {
      if (!(material instanceof THREE.MeshStandardMaterial) || material.emissive.equals(black)) {
        return material;
      }
      const copy = material.clone();
      copy.emissiveIntensity = 1.25;
      cloned.push(copy);
      return copy;
    });
    if (!Array.isArray(child.material)) {
      return;
    }
    // A single-material mesh must stay single-material: three treats an array of
    // one as a multi-material mesh and expects matching geometry groups.
    if (child.material.length === 1) {
      child.material = child.material[0] as THREE.Material;
    }
  });
  return cloned;
};

/**
 * A soft dark disc under the piece.
 *
 * Cheaper than a shadow map by a wide margin — this is one textured plane
 * instead of a second render pass per card per frame — and at this camera angle
 * a real shadow would be mostly hidden under the piece anyway. What the disc has
 * to do is stop the piece from floating, and for that a gradient is enough.
 */
const createContactShadow = (): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> => {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.62)');
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.26)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ depthWrite: false, map: texture, transparent: true }),
  );
  mesh.rotation.x = -Math.PI / 2;
  // Just above the ground plane, so it never z-fights with a model whose own
  // base sits exactly at zero.
  mesh.position.y = 0.001;
  return mesh;
};

/**
 * Centres a model over the origin, stands it on the ground, and reports how far
 * back the camera has to be to hold all of it.
 *
 * The pieces are modelled at their board scale, where a radar is several times a
 * material cache. Framing each one to its own bounding sphere is what lets every
 * card read at the same size without the models being edited.
 */
const frameModel = (object: THREE.Object3D, fov: number): { distance: number; focus: number } => {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.set(-center.x, -box.min.y, -center.z);

  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const height = box.max.y - box.min.y;
  // 1.5 rather than a tight fit: the turntable swings the widest axis towards
  // the camera twice a turn, and a frame sized to the resting pose clips it.
  const distance = (sphere.radius * 1.5) / Math.sin((fov * Math.PI) / 360);
  return { distance, focus: height / 2 };
};

const createStageCanvas = (container: HTMLElement): HTMLCanvasElement => {
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  // Inert: the canvas covers the cards and must never intercept a click meant
  // for what is underneath it.
  //
  // It starts transparent and fades up as the first piece arrives. A caller is
  // expected to have already taken its own stills down — waiting for the models
  // and cutting at the end means every card changes at once, which reads as a
  // glitch — so this fade is what covers the gap between the two.
  canvas.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:10;opacity:0;transition:opacity 500ms ease';
  container.append(canvas);
  return canvas;
};

/**
 * Sizes the drawing buffer to the grid.
 *
 * The buffer covers the whole grid rather than the viewport, so device pixel
 * ratio is capped twice: once at 2, and again by total pixels. Three rows of
 * cards on a wide screen at an uncapped ratio is a buffer well into the tens of
 * megabytes, which is not a reasonable price for a piece catalogue.
 */
const fitCanvas = (renderer: THREE.WebGLRenderer, container: HTMLElement): void => {
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (width === 0 || height === 0) {
    return;
  }
  const maxPixels = 6_000_000;
  const ratio = Math.min(window.devicePixelRatio, 2, Math.sqrt(maxPixels / (width * height)));
  renderer.setPixelRatio(ratio);
  renderer.setSize(width, height, false);
};

type CreateEntryOptions = {
  element: HTMLElement;
  index: number;
  kind: PieceKind;
  scene: THREE.Scene;
};

const createEntry = async (
  options: CreateEntryOptions,
): Promise<{ disposables: Disposable[]; entry: PreviewEntry }> => {
  const { element, index, kind, scene } = options;
  const model = (await loadPieceModel(kind)) ?? createPlaceholder(kind);
  const object = model.clone(true);

  // Cyan is the player's own colour everywhere else on the page, and these are
  // the visitor's pieces to imagine building.
  const accent = novaFactions[0]?.accent ?? novaPalette.system;
  const disposables: Disposable[] = [
    ...setOwnerColor(object, new THREE.Color(toColorValue(accent))),
    ...boostEmissives(object),
  ];

  const { distance, focus } = frameModel(object, fieldOfView);

  const pivot = new THREE.Group();
  pivot.add(object);

  const box = new THREE.Box3().setFromObject(object);
  const spread = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 1.9;

  // Both are rotationally symmetric, so riding the turntable costs nothing and
  // saves a second group to keep in step with the piece.
  const floor = createFloor();
  floor.scale.setScalar(spread * 0.62);
  pivot.add(floor);
  disposables.push(floor.geometry, floor.material);

  const shadow = createContactShadow();
  shadow.scale.set(spread, spread, 1);
  pivot.add(shadow);
  disposables.push(shadow.geometry, shadow.material);
  if (shadow.material.map) {
    disposables.push(shadow.material.map);
  }

  // Every piece lives in the shared scene and is shown only during its own
  // pass, which keeps this to one scene graph rather than eleven.
  pivot.visible = false;
  scene.add(pivot);

  return {
    disposables,
    // Staggered so a grid of eleven turntables does not read as one rotating
    // object repeated, which is exactly what a synchronised grid looks like.
    entry: { angle: index * 0.9, distance, element, focus, pivot },
  };
};

type DrawEntryOptions = {
  camera: THREE.PerspectiveCamera;
  entry: PreviewEntry;
  post: StagePost;
  /** The card's box in canvas coordinates, top-left origin. */
  rect: { height: number; left: number; top: number; width: number };
  renderer: THREE.WebGLRenderer;
};

/** Points the shared camera at one entry and draws it into that card's rect. */
const drawEntry = (options: DrawEntryOptions): void => {
  const { camera, entry, post, rect, renderer } = options;

  entry.pivot.rotation.y = entry.angle;
  entry.pivot.visible = true;

  camera.aspect = rect.width / rect.height;
  // Above the piece and looking slightly down: the board's own camera angle,
  // which is what makes a preview read as the same object seen up close.
  camera.position.set(0, entry.focus + entry.distance * 0.42, entry.distance * 0.9);
  camera.lookAt(0, entry.focus, 0);
  camera.updateProjectionMatrix();

  // WebGL counts from the bottom-left of the drawing buffer; DOM rects count
  // from the top-left.
  const bottom = renderer.domElement.clientHeight - (rect.top + rect.height);
  renderer.setViewport(rect.left, bottom, rect.width, rect.height);
  renderer.setScissor(rect.left, bottom, rect.width, rect.height);
  renderer.setScissorTest(true);
  // The composer's own targets are card-sized, and its final pass draws a quad
  // over the viewport set just above — which is how a fullscreen effect ends up
  // confined to one card.
  post.render();

  entry.pivot.visible = false;
};

const createStageRenderer = (canvas: HTMLCanvasElement): THREE.WebGLRenderer => {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, canvas });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // Above the board's 1.05. A single piece against a dark backdrop can carry a
  // hotter highlight than forty tiles that all have to stay readable.
  renderer.toneMappingExposure = 1.1;
  // Each card draws into its own scissor rect, so the automatic full-frame clear
  // before every render would wipe the cards drawn before it.
  renderer.autoClear = false;
  return renderer;
};

type StagePost = {
  dispose: () => void;
  /** Draws the scene through the chain into whatever viewport is currently set. */
  render: () => void;
  setSize: (width: number, height: number, pixelRatio: number) => void;
};

/**
 * Bloom, sized to one card rather than to the canvas.
 *
 * A post chain is a fullscreen quad, and the canvas here spans the whole grid —
 * so a single composer over it would bleed one card's glow across the gutter
 * into its neighbours, and into the gaps, where there is nothing to glow. Every
 * card is the same size in this grid, so one composer sized to a single card can
 * be reused for all of them: the chain renders into card-sized targets, and the
 * final pass lands inside the scissor rect of whichever card is being drawn.
 *
 * Strength is close to `createTabletopPostProcess`; the threshold is what
 * differs, and it is deliberately above 1. Below it, the metal highlights and
 * the lit edge of every panel bloom too, and a piece that glows all over reads
 * as a decoration rather than as hardware. Above it, only what the lighting has
 * already driven past white can bloom — which is the energy strips and the
 * faction accents, and nothing else on the model.
 */
const createPostProcess = (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): StagePost => {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.28, 0.4, 1.1);
  composer.addPass(bloom);
  // Owns the tone map and the colour-space conversion, which is why the chain
  // can run in linear space up to this point and still match the board's look.
  composer.addPass(new OutputPass());

  return {
    dispose: () => {
      composer.dispose();
    },
    render: () => {
      composer.render();
    },
    setSize: (width, height, pixelRatio) => {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
    },
  };
};

type StageScene = {
  camera: THREE.PerspectiveCamera;
  disposables: Disposable[];
  disposeEnvironment: () => void;
  scene: THREE.Scene;
};

const createStageScene = (renderer: THREE.WebGLRenderer): StageScene => {
  const scene = new THREE.Scene();
  addLighting(scene);
  const disposeEnvironment = createEnvironment(renderer, scene);

  const camera = new THREE.PerspectiveCamera(fieldOfView, 1, 0.1, 100);
  const backdrop = createBackdrop(camera);
  // The backdrop is parented to the camera, and a camera outside the graph is
  // never traversed, so its children would never be drawn.
  scene.add(camera);

  const disposables: Disposable[] = [backdrop.geometry, backdrop.material];
  if (backdrop.material.map) {
    disposables.push(backdrop.material.map);
  }

  return { camera, disposables, disposeEnvironment, scene };
};

/**
 * Keeps the composer's targets at the card size, reallocating only when that
 * size actually changes.
 *
 * Called before every card of every frame, and acts on almost none of them: the
 * cards in this grid are all the same size, so the size it is handed is the size
 * it already has until the grid reflows.
 */
const createPostFit = (post: StagePost, renderer: THREE.WebGLRenderer): ((width: number, height: number) => void) => {
  let current = { height: 0, width: 0 };
  return (width, height) => {
    if (current.width === width && current.height === height) {
      return;
    }
    current = { height, width };
    post.setSize(width, height, renderer.getPixelRatio());
  };
};

const createPiecePreviewStage = (options: PiecePreviewStageOptions): PiecePreviewStage => {
  const { container, fps = 30, spin = 0.35 } = options;

  const canvas = createStageCanvas(container);
  const renderer = createStageRenderer(canvas);
  const { camera, disposables, disposeEnvironment, scene } = createStageScene(renderer);
  const post = createPostProcess(renderer, scene, camera);
  const entries: PreviewEntry[] = [];

  const fitPost = createPostFit(post, renderer);

  const resize = (): void => {
    fitCanvas(renderer, container);
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  const add = async (element: HTMLElement, kind: PieceKind): Promise<void> => {
    const created = await createEntry({ element, index: entries.length, kind, scene });
    disposables.push(...created.disposables);
    entries.push(created.entry);
    canvas.style.opacity = '1';
  };

  let frame = 0;
  let lastTime = 0;
  let elapsed = 0;
  const frameInterval = 1 / fps;

  const draw = (time: number): void => {
    frame = window.requestAnimationFrame(draw);

    const delta = lastTime === 0 ? 0 : Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;
    elapsed += delta;
    if (elapsed < frameInterval || document.hidden || entries.length === 0) {
      return;
    }
    const step = elapsed;
    elapsed = 0;

    // Both boxes are read in the same frame, so the offset between them holds
    // however stale the scroll position underneath them is.
    const origin = canvas.getBoundingClientRect();
    const viewHeight = window.innerHeight;
    let drawn = 0;

    for (const entry of entries) {
      const box = entry.element.getBoundingClientRect();
      // A card off the bottom of the window keeps its angle rather than
      // advancing it, so a piece scrolled back to is where it was left instead
      // of having spun through however long the visitor was reading something
      // else. The margin starts it turning just before it is looked at.
      if (box.height === 0 || box.bottom < -200 || box.top > viewHeight + 200) {
        continue;
      }
      // A card that is still transparent — mid entry-animation, or collapsed
      // behind something — must not have a fully opaque piece drawn over it.
      // `checkVisibility` accounts for the opacity a canvas cannot inherit;
      // where it is missing, the piece simply draws as before.
      if (entry.element.checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) === false) {
        continue;
      }
      if (drawn === 0) {
        renderer.setScissorTest(false);
        renderer.clear();
      }
      drawn += 1;
      entry.angle += spin * step;
      fitPost(box.width, box.height);
      drawEntry({
        camera,
        entry,
        post,
        rect: { height: box.height, left: box.left - origin.left, top: box.top - origin.top, width: box.width },
        renderer,
      });
    }
  };

  frame = window.requestAnimationFrame(draw);

  const dispose = (): void => {
    window.cancelAnimationFrame(frame);
    observer.disconnect();
    for (const disposable of disposables) {
      disposable.dispose();
    }
    disposeEnvironment();
    post.dispose();
    // The models themselves are the loader's cached originals, shared with the
    // board and with every other preview, so they are deliberately left alone.
    renderer.dispose();
    canvas.remove();
  };

  return { add, dispose };
};

export { createPiecePreviewStage };
export type { PiecePreviewStage, PiecePreviewStageOptions };
