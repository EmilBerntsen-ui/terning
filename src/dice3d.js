// 3D-terningerne: ét WebGL-lærred bag DOM'en i #table og én three.js-kontekst til alle 1–6 terninger.
// #dice holder tomme pladsholdere i CSS-layoutet; hver terning tegnes oven på sin pladsholder.
// Hver terning ses lige ovenfra fra sit eget punkt (som CSS' perspective pr. terning), så den lander helt firkantet.
// Dybden lægges i et lag pr. terning: overlapper to terninger midt i slaget, dækker den ene den anden i stedet for at skære den.
import {
  BufferGeometry, CanvasTexture, DirectionalLight, Float32BufferAttribute, Group, HemisphereLight, Matrix4, Mesh,
  MeshBasicMaterial, MeshPhysicalMaterial, NeutralToneMapping, PerspectiveCamera, PlaneGeometry, PMREMGenerator,
  Scene, ShapeUtils, Vector2, Vector4, WebGLRenderer,
} from './vendor/three.module.min.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { MAX_DICE, ROLL_MS, blur, frame, orientation, pose, turn } from './dice.js';

const DEG = Math.PI / 180;
const DISTANCE = 6; // kameraets afstand i terningstørrelser, som det gamle `perspective: 6 × størrelsen`
const RISE = 0.22, GROW = 1.08; // hoppets top: 22 % op ad skærmen og 8 % større (løftet mod kameraet)
const SLOTS = MAX_DICE + 1; // dybdelag: skyggerne nederst, så terning 1, 2, …

// Terningen i enhedsmål (sidelængde 1). Afrundede kanter; prikkerne er dybe skåle med en afrundet kant.
const EDGE = 0.1, EDGE_SEGMENTS = 5;
const PIP_AT = 0.25, PIP_R = 0.085, PIP_TILT = 52 * DEG, LIP = 0.028, RIM = 28, LIP_RINGS = 2, DISH_RINGS = 4;
// Prikkerne i sidens akser (højre, op), i enheder af PIP_AT. Som de gamle CSS-sider: 2 og 3 skråt fra øverst til højre, 6 i to søjler.
const PIPS = {
  1: [[0, 0]],
  2: [[1, 1], [-1, -1]],
  3: [[1, 1], [0, 0], [-1, -1]],
  4: [[-1, 1], [1, 1], [-1, -1], [1, -1]],
  5: [[-1, 1], [1, 1], [0, 0], [-1, -1], [1, -1]],
  6: [[-1, 1], [-1, 0], [-1, -1], [1, 1], [1, 0], [1, -1]],
};

const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Hvid krop og sorte skåle som to geometrier (trekanter med normaler). Tilsammen en lukket overflade uden revner.
export function dieGeometry() {
  const body = [], pips = [];
  // En trekant vendes, så dens forside peger samme vej som normalerne (udad).
  const tri = (out, a, b, c) => out.push(a, ...(dot(cross(sub(b.p, a.p), sub(c.p, a.p)), a.n.map((v, i) => v + b.n[i] + c.n[i])) < 0 ? [c, b] : [b, c]));
  const quad = (out, a, b, c, d) => { tri(out, a, b, c); tri(out, a, c, d); };

  // Skallen: den afrundede kasse uden de seks flade midterfelter, som siderne med huller nedenfor erstatter.
  const box = new RoundedBoxGeometry(1, 1, 1, EDGE_SEGMENTS, EDGE);
  const bp = box.attributes.position.array, bn = box.attributes.normal.array;
  const at = i => ({ p: [bp[i], bp[i + 1], bp[i + 2]], n: [bn[i], bn[i + 1], bn[i + 2]] });
  for (let i = 0; i < bp.length; i += 9) {
    const t = [at(i), at(i + 3), at(i + 6)];
    if (!t.every(v => Math.max(...v.n.map(Math.abs)) > 0.9999)) body.push(...t);
  }
  box.dispose();

  const half = 0.5 - EDGE; // den flade del af en side går fra -half til half
  const lipR = PIP_R + LIP * Math.sin(PIP_TILT), sphere = PIP_R / Math.sin(PIP_TILT);
  const circle = Array.from({ length: RIM }, (_, k) => [Math.cos((2 * Math.PI * k) / RIM), Math.sin((2 * Math.PI * k) / RIM)]);
  for (let face = 1; face <= 6; face++) {
    const { right, up, normal } = frame(face);
    // Punkt (u, v) på siden, h ind under overfladen (negativ), med normalen (nu, nv, nh) i sidens akser.
    const vertex = (u, v, h, nu, nv, nh) => ({
      p: [0, 1, 2].map(i => normal[i] * (0.5 + h) + right[i] * u + up[i] * v),
      n: [0, 1, 2].map(i => right[i] * nu + up[i] * nv + normal[i] * nh),
    });
    const centers = PIPS[face].map(([x, y]) => [x * PIP_AT, y * PIP_AT]);

    const contour = [[-half, -half], [half, -half], [half, half], [-half, half]].map(([u, v]) => new Vector2(u, v));
    const holes = centers.map(([cu, cv]) => circle.map(([c, s]) => new Vector2(cu + lipR * c, cv + lipR * s)));
    const flat = [...contour, ...holes.flat()].map(({ x, y }) => vertex(x, y, 0, 0, 0, 1));
    for (const [a, b, c] of ShapeUtils.triangulateShape(contour, holes)) tri(body, flat[a], flat[b], flat[c]);

    for (const [cu, cv] of centers) {
      // Ring med radius r i dybden h; normalen hælder `tilt` ind mod hullets midte.
      const ring = (r, h, tilt) => circle.map(([c, s]) => vertex(cu + r * c, cv + r * s, h, -Math.sin(tilt) * c, -Math.sin(tilt) * s, Math.cos(tilt)));
      const band = (out, rings) => {
        for (let j = 0; j + 1 < rings.length; j++) for (let k = 0; k < RIM; k++) {
          const k1 = (k + 1) % RIM;
          quad(out, rings[j][k], rings[j][k1], rings[j + 1][k1], rings[j + 1][k]);
        }
      };
      // Den afrundede kant ned i hullet: hvid, og den fanger lyset.
      const lip = Array.from({ length: LIP_RINGS + 1 }, (_, j) => {
        const a = PIP_TILT * (j / LIP_RINGS);
        return ring(lipR - LIP * Math.sin(a), -LIP * (1 - Math.cos(a)), a);
      });
      band(body, lip);
      // Skålen: et kugleudsnit fra kanten ned til bunden, sort. Første ring er kantens sidste, så der ingen revne er.
      const top = -LIP * (1 - Math.cos(PIP_TILT));
      const dish = [lip[LIP_RINGS], ...Array.from({ length: DISH_RINGS - 1 }, (_, j) => {
        const a = PIP_TILT * (1 - (j + 1) / DISH_RINGS);
        return ring(sphere * Math.sin(a), top - sphere * (Math.cos(a) - Math.cos(PIP_TILT)), a);
      })];
      band(pips, dish);
      const last = dish[dish.length - 1], bottom = vertex(cu, cv, top - sphere * (1 - Math.cos(PIP_TILT)), 0, 0, 1);
      for (let k = 0; k < RIM; k++) tri(pips, last[k], last[(k + 1) % RIM], bottom);
    }
  }
  return [body, pips].map(list => {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(list.flatMap(v => v.p), 3));
    g.setAttribute('normal', new Float32BufferAttribute(list.flatMap(v => v.n), 3));
    g.computeBoundingSphere();
    return g;
  });
}

// Blød, afrundet firkant til skyggen (hvid på sort; bruges som alphaMap). Firkanten tegnes uden for lærredet, kun sløringen rammer det.
function shadowTexture() {
  const size = 128, c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, size, size);
  const w = size * 0.6, r = size * 0.18, x = (size - w) / 2 - size * 2, y = (size - w) / 2;
  g.shadowColor = '#fff';
  g.shadowBlur = size * 0.12;
  g.shadowOffsetX = size * 2;
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + w, r);
  g.arcTo(x + w, y + w, x, y + w, r);
  g.arcTo(x, y + w, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.fill();
  return new CanvasTexture(c);
}

// Hver terning projiceres fra sit eget kamera lige over sig (dieShift, dieProjection) og får sit eget dybdelag (dieDepth).
const DIE_UNIFORMS = 'uniform vec2 dieShift;\nuniform mat4 dieProjection;\nuniform vec4 dieDepth;\n';
const DIE_PROJECT = `
vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
mvPosition.xy -= dieShift;
gl_Position = dieProjection * mvPosition;
gl_Position.z = ( 1.0 - 2.0 * ( dieDepth.z + clamp( ( mvPosition.z + dieDepth.x ) * dieDepth.y, 0.0, 0.999 ) ) / dieDepth.w ) * gl_Position.w;
`;
function perDie(material, uniforms) {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = DIE_UNIFORMS + shader.vertexShader.replace('#include <project_vertex>', DIE_PROJECT);
  };
  return material;
}

// Blank, kølig hvid plast med klarlak; prikkerne er næsten mat sort maling, så hullets form ses i lyset og ikke i spejlinger.
const bodyMaterial = u => perDie(new MeshPhysicalMaterial({ color: 0xf2f4f7, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.1 }), u);
const pipMaterial = u => perDie(new MeshPhysicalMaterial({ color: 0x121214, roughness: 0.8, clearcoat: 0.3, clearcoatRoughness: 0.6 }), u);

// Returnerer null, hvis WebGL (2) ikke kan startes; så bruger app.js de flade terninger.
export function createDice3D(table, diceEl) {
  const canvas = document.createElement('canvas');
  canvas.className = 'stage';
  canvas.setAttribute('aria-hidden', 'true');
  table.prepend(canvas);
  try {
    return start(canvas, table, diceEl);
  } catch {
    canvas.remove();
    return null;
  }
}

function start(canvas, table, diceEl) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  renderer.toneMapping = NeutralToneMapping;

  const scene = new Scene(), camera = new PerspectiveCamera();
  const environment = () => {
    const pmrem = new PMREMGenerator(renderer), room = new RoomEnvironment();
    scene.environment?.dispose();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
  };
  environment();
  scene.environmentIntensity = 0.45;
  // Kølig himmel ovenfra og et hovedlys skråt nedefra og forfra: den side der vender ned mod beskueren, lyser mest.
  scene.add(new HemisphereLight(0xc2d3ff, 0x4a4640, 0.55));
  const key = new DirectionalLight(0xfffbf3, 3);
  key.position.set(0.35, -0.55, 1);
  scene.add(key);

  const [bodyGeometry, pipGeometry] = dieGeometry();
  const shadowGeometry = new PlaneGeometry(1, 1), shade = shadowTexture();
  const dice = Array.from({ length: MAX_DICE }, (_, i) => {
    const view = { dieShift: { value: new Vector2() }, dieProjection: { value: new Matrix4() } };
    const u = { ...view, dieDepth: { value: new Vector4(0, 1, i + 1, SLOTS) } };
    const m = { body: bodyMaterial(u), pips: pipMaterial(u), bodyGhost: bodyMaterial(u), pipsGhost: pipMaterial(u) };
    m.bodyGhost.transparent = m.pipsGhost.transparent = true;
    const shadowUniforms = { ...view, dieDepth: { value: new Vector4(0, 1, 0, SLOTS) } };
    const shadow = new Mesh(shadowGeometry, perDie(new MeshBasicMaterial({ color: 0x000000, alphaMap: shade, transparent: true, depthWrite: false }), shadowUniforms));
    const body = new Mesh(bodyGeometry, m.body), pips = new Mesh(pipGeometry, m.pips);
    pips.renderOrder = 1; // efter kroppen, også i de gennemsigtige spøgelsesbilleder
    const die = new Group();
    die.add(body, pips);
    for (const o of [body, pips, shadow]) o.frustumCulled = false; // projektionen sker i shaderen
    scene.add(die, shadow);
    return { die, body, pips, shadow, m, u, shadowUniforms, shown: false, from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, x: 0, y: 0, size: 0, D: 0 };
  });
  // Alle shadere oversættes nu, også spøgelsesbillederne (gennemsigtige er et andet program), så første slag ikke hakker.
  for (const ghost of [true, false]) {
    for (const d of dice) {
      d.body.material = ghost ? d.m.bodyGhost : d.m.body;
      d.pips.material = ghost ? d.m.pipsGhost : d.m.pips;
    }
    renderer.compile(scene, camera);
  }

  // Pladsholdernes plads i lærredet (CSS-px; y op, nulpunkt i midten) og et kamera lige over hver.
  function measure() {
    const box = table.getBoundingClientRect(), W = box.width, H = box.height;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);
    const cells = [...diceEl.children];
    dice.forEach((d, i) => {
      if (!cells[i]) return;
      const r = cells[i].getBoundingClientRect();
      d.size = r.width;
      d.D = DISTANCE * d.size;
      d.x = r.left + r.width / 2 - box.left - W / 2;
      d.y = H / 2 - (r.top + r.height / 2 - box.top);
      const near = d.D / 2, k = near / d.D;
      d.u.dieShift.value.set(d.x, d.y);
      d.u.dieProjection.value.makePerspective((-W / 2 - d.x) * k, (W / 2 - d.x) * k, (H / 2 - d.y) * k, (-H / 2 - d.y) * k, near, d.D * 2);
      // Dybden går fra en terningstørrelse under midten til 1,6 over (drejet hjørne plus hoppet).
      for (const depth of [d.u.dieDepth.value, d.shadowUniforms.dieDepth.value]) depth.set(d.D + d.size, 1 / (2.6 * d.size), depth.z, SLOTS);
      camera.position.set(0, 0, d.D);
    });
  }

  // Terningerne i stillingen ved tiden t; `ghost` tegner dem som svage spøgelsesbilleder med den givne uigennemsigtighed.
  function place(t, ghost = 0) {
    for (const d of dice) {
      d.die.visible = d.shown;
      d.shadow.visible = d.shown && !ghost;
      if (!d.shown) continue;
      const { x, y, lift } = pose(d.from, d.to, t);
      const side = d.size / (1 + 0.5 / DISTANCE); // så forsiden fylder pladsholderen
      d.die.rotation.set(x * DEG, y * DEG, 0);
      d.die.position.set(d.x, d.y + RISE * d.size * lift, d.D * (1 - 1 / GROW) * lift);
      d.die.scale.setScalar(side);
      d.body.material = ghost ? d.m.bodyGhost : d.m.body;
      d.pips.material = ghost ? d.m.pipsGhost : d.m.pips;
      d.m.bodyGhost.opacity = d.m.pipsGhost.opacity = ghost || 1;
      // Skyggen bliver på bordet: større, blødere og svagere, mens terningen er i luften.
      d.shadow.position.set(d.x, d.y - 0.08 * side, -0.5 * side);
      d.shadow.scale.setScalar(side * 2.1 * (1 + 0.25 * lift));
      d.shadow.material.opacity = 0.6 * (1 - 0.6 * lift);
    }
  }

  // Ét billede: terningerne skarpt, og mens de drejer hurtigt, svagere billeder fra lidt tidligere i slaget oveni (blur).
  let start = 0, rolling = false, frameId = 0;
  function paint(now) {
    frameId = 0;
    const t = rolling ? Math.min(1, Math.max(0, (now - start) / ROLL_MS)) : 1;
    renderer.clear();
    place(t);
    renderer.render(scene, camera);
    for (const ghost of rolling ? blur(dice.filter(d => d.shown), t) : []) {
      place(ghost.t, ghost.alpha);
      renderer.clearDepth();
      renderer.render(scene, camera);
    }
    if (rolling && t < 1) draw();
    else rolling = false;
  }
  function draw() {
    if (!frameId) frameId = requestAnimationFrame(paint);
  }

  new ResizeObserver(() => { measure(); draw(); }).observe(table);
  canvas.addEventListener('webglcontextrestored', () => { environment(); draw(); });

  return {
    // Nyt antal: hver terning står stille med `faces[i]` frem.
    layout(faces) {
      dice.forEach((d, i) => {
        d.shown = i < faces.length;
        if (d.shown) d.from = d.to = orientation(faces[i]);
      });
      rolling = false;
      measure();
      draw();
    },
    // Slag: hver terning drejer spins[i] hele omgange om x og y og lander med faces[i] frem. `instant`: ingen bevægelse.
    roll(faces, spins, { instant = false } = {}) {
      faces.forEach((face, i) => {
        const d = dice[i];
        d.from = d.to;
        d.to = turn(d.from, face, instant ? { x: 0, y: 0 } : spins[i]);
        if (instant) d.from = d.to;
      });
      start = performance.now();
      rolling = !instant;
      draw();
    },
  };
}
