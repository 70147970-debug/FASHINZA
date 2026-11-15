/**
 * "Liquid silk": two flowing satin scarves drawn with raw WebGL (one full-screen triangle and a small fragment
 * shader; no libraries). Loaded lazily by <LiquidHero> (liquid-hero.jsx) only after the page has loaded, and
 * never under prefers-reduced-motion.
 *
 * Each scarf is a band along a gently bowed path whose long folds drift and whose width breathes with a slow
 * twist. It is shaded as shot silk in the brand palette: forest green in the shade of a fold turning taupe where
 * the light catches it, with a broad sheen and a tight ivory satin highlight. A fine pointer nudges the light.
 * Output is premultiplied alpha, so the hero photograph shows everywhere outside the scarves; the hero's scrim
 * sits above the canvas, so the copy keeps its contrast whatever the silk does.
 *
 * Budget: at most devicePixelRatio 1.5 (×0.85 render scale; the silk is soft, so CSS upscaling is invisible),
 * paused while off-screen or while the tab is hidden, and it halves its resolution, then stops, on devices that
 * cannot keep up. Returns a dispose function; when WebGL is unavailable it returns a no-op and the host keeps
 * showing the photograph.
 */

const VERTEX = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uLight;
uniform float uNarrow;

// A satin scarf: a wide band along a gently bowed path from a0 to a1 (uv), with long folds running along it.
// Its width breathes with a slow twist; returns straight colour in .rgb and coverage in .a.
vec4 scarf(vec2 uv, float aspect, float t, vec2 a0, vec2 a1, float width, float phase, float dim) {
  vec2 p = uv * vec2(aspect, 1.0);
  vec2 s0 = a0 * vec2(aspect, 1.0);
  vec2 s1 = a1 * vec2(aspect, 1.0);
  vec2 dir = normalize(s1 - s0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float along = dot(p - s0, dir);
  float len = length(s1 - s0);
  float k = along / len;                       // 0..1 along the path
  // the path bows and drifts
  float bow = 0.10 * sin(k * 3.14159 + 0.4) + 0.035 * sin(k * 6.0 + t * 0.35 + phase) + 0.02 * sin(k * 11.0 - t * 0.27 + phase);
  float across = dot(p - s0, nrm) - bow;
  // width breathes with a slow twist (never pinches to nothing)
  float twist = k * 4.0 - t * 0.22 + phase;
  float w = width * (0.62 + 0.38 * abs(cos(twist)));
  float u = across / w;                        // -1..1 across the scarf
  // folds run along the scarf: height varies mostly across it
  float w1 = 0.9 * sin(k * 5.0 + t * 0.4 + phase);
  float w2 = 0.8 * sin(k * 3.0 - t * 0.33 + phase);
  float h = 0.55 * sin(u * 3.6 + w1 + t * 0.3)
          + 0.18 * sin(u * 6.8 - w2 - t * 0.21 + 1.3)
          + 0.04 * sin(u * 12.5 + k * 9.0 + t * 0.5);
  float dhdu = 0.55 * 3.6 * cos(u * 3.6 + w1 + t * 0.3)
             + 0.18 * 6.8 * cos(u * 6.8 - w2 - t * 0.21 + 1.3)
             + 0.04 * 12.5 * cos(u * 12.5 + k * 9.0 + t * 0.5);
  // The band bows like a cylinder across its width and tilts with the twist.
  float curve = -u * 1.05;
  vec2 g2 = nrm * (dhdu * 0.13 + curve) + dir * (0.35 * sin(twist));
  vec3 n = normalize(vec3(g2, 1.0));
  vec3 L = normalize(vec3(-0.35 + uLight.x * 0.4, 0.6 + uLight.y * 0.3, 0.75));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float diff = max(dot(n, L), 0.0);
  float nh = max(dot(n, H), 0.0);
  float spec = pow(nh, 60.0);
  float sheen = pow(nh, 12.0);
  vec3 forest = vec3(0.325, 0.420, 0.333);
  vec3 taupe = vec3(0.718, 0.659, 0.584);
  vec3 ivory = vec3(0.973, 0.965, 0.945);
  // Shot silk: forest green in the folds' shade turning to taupe where the light catches them.
  float lit = smoothstep(0.15, 0.95, diff);
  vec3 shade = forest * 0.55;
  vec3 body = mix(forest * 1.12, taupe * 1.04, smoothstep(0.45, 1.0, diff + 0.1 * sin(k * 4.0 + t * 0.2 + phase)));
  vec3 col = mix(shade, body, lit) + ivory * (spec * 0.6 + sheen * 0.22);
  col *= dim;
  // Soft edges that ripple with the folds; the ends fade out.
  float edge = 1.0 - smoothstep(0.86, 1.0, abs(u) + 0.04 * h);
  float ends = smoothstep(-0.05, 0.12, k) * (1.0 - smoothstep(0.92, 1.05, k));
  float a = edge * ends;
  return vec4(min(col, vec3(1.0)), a);
}

// Wide screens: two scarves sweep up across the lower right. Narrow screens: they cross the upper part, above
// the copy. The back scarf is thinner and dimmer (further away); "over" compositing, premultiplied output.
void main() {
  float aspect = uRes.x / uRes.y;
  float t = uTime;
  vec4 back, front;
  if (uNarrow > 0.5) {
    back = scarf(vUv, aspect, t * 0.9, vec2(-0.1, 0.62), vec2(1.1, 0.95), 0.06, 2.0, 0.6);
    front = scarf(vUv, aspect, t, vec2(-0.1, 0.82), vec2(1.1, 0.6), 0.11, 0.0, 1.0);
  } else {
    back = scarf(vUv, aspect, t * 0.9, vec2(0.25, -0.05), vec2(1.08, 0.62), 0.07, 2.0, 0.6);
    front = scarf(vUv, aspect, t, vec2(0.05, -0.12), vec2(1.08, 0.38), 0.135, 0.0, 1.0);
  }
  vec3 col = back.rgb * back.a * 0.8;
  float a = back.a * 0.8;
  col = front.rgb * front.a * 0.9 + col * (1.0 - front.a * 0.9);
  a = front.a * 0.9 + a * (1.0 - front.a * 0.9);
  gl_FragColor = vec4(col, a);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/**
 * Mounts the silk canvas inside `host` (an absolutely positioned, aria-hidden layer).
 * @param {HTMLElement} host
 * @param {{ opacity?: number }} [options]
 * @returns {() => void} dispose
 */
export function mountLiquidSilk(host, { opacity = 1 } = {}) {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity 1.8s ease";

  let gl = null;
  try {
    const attrs = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power" };
    gl = canvas.getContext("webgl", attrs) || canvas.getContext("experimental-webgl", attrs);
  } catch {
    gl = null;
  }
  if (!gl) {
    host.dataset.liquid = "unsupported";
    return () => {};
  }

  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = vs && fs ? gl.createProgram() : null;
  if (program) {
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
  }
  if (!program || !gl.getProgramParameter(program, gl.LINK_STATUS)) {
    host.dataset.liquid = "unsupported";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return () => {};
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(program, "uRes");
  const uTime = gl.getUniformLocation(program, "uTime");
  const uLight = gl.getUniformLocation(program, "uLight");
  const uNarrow = gl.getUniformLocation(program, "uNarrow");
  gl.clearColor(0, 0, 0, 0);

  host.appendChild(canvas);

  let scale = 0.85;
  let width = 0;
  let height = 0;
  const resize = () => {
    const rect = host.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5) * scale;
    const w = Math.max(1, Math.round(rect.width * ratio));
    const h = Math.max(1, Math.round(rect.height * ratio));
    if (w === width && h === height) return;
    width = w;
    height = h;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(uRes, w, h);
    gl.uniform1f(uNarrow, rect.width < rect.height * 1.15 ? 1 : 0);
  };

  // A gentle pointer-driven light (fine pointers only), eased every frame.
  const light = { x: 0, y: 0, tx: 0, ty: 0 };
  const finePointer = window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
  const onPointer = (e) => {
    light.tx = (e.clientX / window.innerWidth) * 2 - 1;
    light.ty = 1 - (e.clientY / window.innerHeight) * 2;
  };
  if (finePointer) window.addEventListener("pointermove", onPointer, { passive: true });

  let frame = 0;
  let visible = true;
  let pageVisible = document.visibilityState !== "hidden";
  let shown = false;
  let stopped = false;
  let last = 0;
  let clock = Math.random() * 40;
  let slowFrames = 0;
  let sampled = 0;

  const draw = (now) => {
    frame = 0;
    if (stopped) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    clock = (clock + dt) % 3600;

    // Adaptive quality: lower the resolution once, then give up (the photo remains) if frames stay slow.
    if (shown && dt > 0) {
      sampled += 1;
      if (dt > 0.045) slowFrames += 1;
      if (sampled >= 90) {
        if (slowFrames > 45) {
          if (scale > 0.5) {
            scale = 0.5;
            width = 0;
            resize();
          } else {
            fadeOutAndStop();
            return;
          }
        }
        sampled = 0;
        slowFrames = 0;
      }
    }

    light.x += (light.tx - light.x) * 0.04;
    light.y += (light.ty - light.y) * 0.04;
    gl.uniform1f(uTime, clock);
    gl.uniform2f(uLight, light.x, light.y);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!shown) {
      shown = true;
      canvas.style.opacity = String(opacity);
    }
    schedule();
  };
  const schedule = () => {
    if (!frame && !stopped && visible && pageVisible) frame = requestAnimationFrame(draw);
    host.dataset.liquid = stopped ? "stopped" : visible && pageVisible ? "running" : "paused";
  };
  const pause = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    host.dataset.liquid = stopped ? "stopped" : "paused";
  };

  const io =
    typeof IntersectionObserver === "function"
      ? new IntersectionObserver((entries) => {
          visible = entries.some((en) => en.isIntersecting);
          if (visible) schedule();
          else pause();
        })
      : null;
  io?.observe(host);
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  ro?.observe(host);
  const onVisibility = () => {
    pageVisible = document.visibilityState !== "hidden";
    if (pageVisible) schedule();
    else pause();
  };
  document.addEventListener("visibilitychange", onVisibility);
  const onLost = (e) => {
    e.preventDefault();
    stop();
  };
  canvas.addEventListener("webglcontextlost", onLost);

  function stop() {
    if (stopped) return;
    stopped = true;
    pause();
    io?.disconnect();
    ro?.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    if (finePointer) window.removeEventListener("pointermove", onPointer);
    canvas.removeEventListener("webglcontextlost", onLost);
    host.dataset.liquid = "stopped";
  }
  function fadeOutAndStop() {
    canvas.style.opacity = "0";
    stop();
  }

  resize();
  schedule();

  return () => {
    stop();
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    canvas.remove();
    host.dataset.liquid = "off";
  };
}
