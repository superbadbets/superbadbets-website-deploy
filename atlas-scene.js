import { clamp, makeDots, mix, rotate } from "./atlas-points.js";

const formationTime = 2.45;
const settledTime = 3.45;
const smoothstep = (t) => t * t * (3 - 2 * t);

function camera(width, height, scale, yaw, pitch) {
  const sinYaw = Math.sin(yaw);
  const cosYaw = Math.cos(yaw);
  const sinPitch = Math.sin(pitch);
  const cosPitch = Math.cos(pitch);
  return (x, y, z) => {
    const side = x * cosYaw + z * sinYaw;
    const depth = z * cosYaw - x * sinYaw;
    const forward = y * sinPitch + depth * cosPitch;
    const zoom = 8.5 / (8.5 - forward);
    return {
      x: width * 0.5 + side * scale * zoom,
      y: height * 0.47 + (y * cosPitch - depth * sinPitch) * scale * zoom,
      zoom,
      depth: forward,
    };
  };
}

function connectionPoint(from, to, relation, t) {
  const bow = Math.sin(t * Math.PI);
  return [
    mix(from[0], to[0], t),
    mix(from[1], to[1], t) - bow * 0.16,
    mix(from[2], to[2], t) + bow * (relation === "extends" ? 0.65 : -0.47),
  ];
}

function drawLinks(context, links, project, root, time, opacity, compact, palette) {
  context.save();
  context.lineWidth = 1;
  context.strokeStyle = palette.ink;
  for (const { from, to, relation, index } of links) {
    const focused = from.id === root || to.id === root;
    const structural = relation === "extends";
    const start = compact ? from.compact : from.position;
    const end = compact ? to.compact : to.position;
    const at = (t) => project(...connectionPoint(start, end, relation, t));
    context.globalAlpha = opacity * (focused ? 0.62 : 0.31);
    context.setLineDash(structural ? [4, 4] : []);
    context.beginPath();
    for (let step = 0; step <= 24; step++) {
      const { x, y } = at(step / 24);
      if (step === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
    if (time >= formationTime) {
      const pulse = at(0.17 + ((time * 0.19 + index * 0.28) % 1) * 0.66);
      context.globalAlpha = focused ? 0.84 : 0.95;
      context.fillStyle = focused ? palette.ink : palette.green;
      context.beginPath();
      context.arc(pulse.x, pulse.y, focused ? 2.1 : 1.35, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.restore();
}

function drawDots(context, nodes, project, root, time, compact, palette) {
  const projected = [];
  for (const node of nodes) {
    const [cx, cy, cz] = compact ? node.compact : node.position;
    const focused = node.id === root;
    const spin = node.shape === "ruler"
      ? 0.26 + Math.sin(time * 0.65) * 0.40
      : time * (node.index % 2 === 0 ? 0.28 : -0.23) + node.index * 0.42;
    const tilt = 0.16 + Math.sin(time * 0.85 + node.index) * 0.24;
    for (const dot of node.dots) {
      const gather = smoothstep(clamp((time - dot.delay) / 1.61, 0, 1));
      const [tx, ty, tz] = rotate(...dot.target, spin, tilt);
      const spiral = dot.height * 3.9 + dot.phase * 0.038 - time * 2.15;
      const radius = 0.38 + Math.sin(dot.phase * 0.41 + time) ** 2 * 0.82;
      const position = project(
        mix(Math.cos(spiral) * radius, cx + tx, gather),
        mix(dot.height * 2.77, cy + ty, gather),
        mix(Math.sin(spiral) * radius, cz + tz, gather),
      );
      projected.push({ ...position, focused, weight: dot.weight });
    }
  }
  projected.sort((a, b) => a.depth - b.depth);
  context.fillStyle = palette.ink;
  for (const dot of projected) {
    context.globalAlpha = clamp((dot.focused ? 0.81 : 0.52) + dot.depth * 0.13, 0.22, 0.98);
    const radius = (dot.focused ? 1.34 : 1.05) * dot.weight * dot.zoom;
    context.beginPath();
    context.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

export function createScene(canvas, nodes, links, reducedMotion) {
  const context = canvas.getContext("2d");
  if (!context) return false;
  const style = getComputedStyle(canvas);
  const palette = {
    ink: style.getPropertyValue("--ink").trim(),
    green: style.getPropertyValue("--green").trim(),
  };

  const root = nodes[0].id;
  let time = reducedMotion.matches ? settledTime : 0;
  let width = 0;
  let height = 0;
  let frame = 0;
  let previous = 0;
  let labels = new Map();

  function render() {
    if (!width || !height) return;
    const compact = width < 570;
    const scale = compact ? Math.min(width / 5.10, height / 6.26) : Math.min(width / 8.76, height / 5.32);
    const turn = 1 - smoothstep(clamp(time / settledTime, 0, 1));
    const project = camera(width, height, scale, -0.12 - turn * 0.48, 0.10 + turn * 0.24);
    const opacity = smoothstep(clamp((time - 0.85) / 1.55, 0, 1));
    context.clearRect(0, 0, width, height);
    drawLinks(context, links, project, root, time, opacity, compact, palette);
    drawDots(context, nodes, project, root, time, compact, palette);
    for (const node of nodes) {
      const position = compact ? node.compact : node.position;
      const { x, y, zoom } = project(...position);
      const halfLabel = labels.get(node.id) / 2 + 6;
      node.label.style.left = clamp(x, halfLabel, width - halfLabel) + "px";
      node.label.style.top = clamp(y + (node.shape === "orb" ? 0.75 : 0.55) * scale * zoom, 37, height - 20) + "px";
      node.label.style.opacity = String(0.50 + opacity * 0.50);
    }
  }

  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    labels = new Map(nodes.map((node) => [node.id, node.label.offsetWidth]));
    syncPlayback();
  }

  function tick(now) {
    frame = 0;
    if (!width || !height || document.hidden) return;
    if (previous) time = Math.min(settledTime, time + Math.min(0.05, (now - previous) / 1000));
    previous = now;
    render();
    if (time < settledTime) frame = requestAnimationFrame(tick);
  }

  function syncPlayback() {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
    render();
    if (width && height && time < settledTime && !document.hidden) frame = requestAnimationFrame(tick);
  }

  for (const node of nodes) node.dots = makeDots(node.shape, node.index);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  document.addEventListener("visibilitychange", syncPlayback);
  reducedMotion.addEventListener("change", (event) => {
    if (!event.matches) return;
    time = settledTime;
    syncPlayback();
  });
  resize();

  return true;
}
