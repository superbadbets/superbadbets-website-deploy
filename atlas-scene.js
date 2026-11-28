import { capacityProfile, clamp, mix } from "./atlas-points.js";

const settledTime = 5.1;
const smooth = (value) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

function camera(width, height, time) {
  const settle = smooth(time / 3.5);
  const scale = Math.min(width / 8.8, height / 4.2);
  const yaw = mix(-0.65, -0.25, settle);
  const pitch = mix(0.35, 0.26, settle);
  return (x, y, z) => {
    const side = x * Math.cos(yaw) + z * Math.sin(yaw);
    const depth = z * Math.cos(yaw) - x * Math.sin(yaw);
    const forward = y * Math.sin(pitch) + depth * Math.cos(pitch);
    const zoom = 12 / (12 - forward);
    return {
      x: width * 0.48 + side * scale * zoom,
      y: height * 0.51 + (y * Math.cos(pitch) - depth * Math.sin(pitch)) * scale * zoom,
      zoom,
    };
  };
}

function trace(ctx, project, points, { color, opacity, width = 1, dash = [] }) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  points.forEach((point, i) => {
    const { x, y } = project(...point);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
}

function drawConnections(ctx, labels, origin, width, height, time, ink, green) {
  const step = Math.min(width * 0.28, 225);
  const y = height - 69;
  const x = labels.map((_, index) => width * 0.49 + (index - 1) * step);
  const phases = [smooth((time - 2.6) / 0.82), smooth((time - 3.42) / 0.62), smooth((time - 4.04) / 0.65)];
  const screen = (x, y) => ({ x, y });

  const approach = phases[0];
  if (approach > 0) {
    const floor = mix(origin.y, y, 0.72);
    const bend = Math.min(width * 0.08, 48);
    const curve = Array.from({ length: 33 }, (_, i) => {
      const t = i / 32 * approach;
      const s = 1 - t;
      return [
        s ** 3 * origin.x + 3 * s ** 2 * t * (origin.x + bend) + 3 * s * t ** 2 * x[0] + t ** 3 * x[0],
        s ** 3 * origin.y + 3 * s ** 2 * t * floor + 3 * s * t ** 2 * (y - 36) + t ** 3 * y,
      ];
    });
    trace(ctx, screen, curve, { color: green, opacity: 0.93, width: 1.55 });
  }

  for (const [index, label] of labels.entries()) {
    const at = x[index];
    const arrival = smooth((phases[index] - 0.65) / 0.35);
    if (index && phases[index] > 0) {
      const from = x[index - 1] + 7;
      const end = mix(from, at - 7, phases[index]);
      trace(ctx, screen, [[from, y], [end, y]], {
        color: ink, opacity: 0.38, dash: index === 2 ? [2, 4] : [],
      });
      trace(ctx, screen, [[end - 4, y - 3], [end, y], [end - 4, y + 3]], {
        color: ink, opacity: 0.52,
      });
    }
    ctx.fillStyle = index === 0 ? green : ink;
    ctx.globalAlpha = arrival * 0.87;
    ctx.beginPath();
    ctx.arc(at, y, 2.9, 0, Math.PI * 2);
    ctx.fill();
    label.style.left = at + "px";
    label.style.top = y + 10 + "px";
    label.style.opacity = String(arrival);
  }
  ctx.globalAlpha = 1;
}

export function createScene(stage, input, motion) {
  const canvas = stage.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { segments, mean } = capacityProfile(input);
  const style = getComputedStyle(stage);
  const ink = style.getPropertyValue("--ink").trim();
  const green = style.getPropertyValue("--green").trim();
  const xAt = (elapsed) => mix(-3.35, 3.35, elapsed / input.duration);
  const yAt = (rate) => 0.86 - (rate / input.reference) * 1.97;
  const point = (elapsed, rate, z = 0.43) => [xAt(elapsed), yAt(rate), z];
  const profile = segments.flatMap(({ from, until, rate }) => [point(from, rate), point(until, rate)]);
  const columns = 86;
  const points = Array.from({ length: columns }, (_, i) => {
    const elapsed = (i + 0.5) * input.duration / columns;
    const { rate } = segments.find(({ until }) => elapsed < until);
    const rows = Math.floor(25 * rate / input.reference);
    return Array.from({ length: rows }, (_, j) => ({
      x: xAt(elapsed),
      y: yAt((j + 0.5) * input.reference / 25),
      z: ((i * 11 + j * 7) % 23) / 23 * 0.8 - 0.4,
      start: (i % 11) * 0.035 + (j % 6) * 0.025,
      opacity: 0.31 + ((i * 7 + j * 3) % 9) / 30,
    }));
  }).flat();
  const labels = [
    { label: stage.querySelector(".atlas-reference"), point: point(0, input.reference, 0.43), dx: -12, dy: -12 },
    { label: stage.querySelector(".atlas-current"), point: point(input.duration * 0.55, segments.find(({ from, until }) => from <= input.duration * 0.55 && input.duration * 0.55 < until).rate), dx: 0, dy: -15 },
    { label: stage.querySelector(".atlas-mean"), point: point(input.duration, mean, 0.57), dx: 13, dy: 0 },
  ];

  const flowLabels = [...stage.querySelectorAll(".atlas-flow > div")];
  let plotHeight = 0;
  let width = 0;
  let height = 0;
  let time = motion.matches ? settledTime : 0;
  let previous = 0;
  let frame = 0;

  function render() {
    if (!width || !height) return;
    const project = camera(width, plotHeight, time);
    const draw = (points, options) => trace(ctx, project, points, options);
    ctx.clearRect(0, 0, width, height);

    const baseline = smooth(time / 0.65);
    const surface = smooth((time - 0.5) / 1.5);
    const average = smooth((time - 1.55) / 1.1);
    draw([point(0, 0), point(input.duration, 0)], { color: ink, opacity: baseline * 0.3 });
    draw([point(0, input.reference), point(input.duration, input.reference)], {
      color: ink, opacity: baseline * 0.32, dash: [2, 5],
    });

    ctx.fillStyle = ink;
    for (const dot of points) {
      const emerge = smooth((time - dot.start) / 1.7);
      const drift = 1 - emerge;
      const { x, y, zoom } = project(
        dot.x + drift * Math.sin(dot.y * 12 + dot.x * 2) * 0.18,
        mix(0.86, dot.y, emerge),
        dot.z + drift * Math.cos(dot.x * 5) * 0.42,
      );
      ctx.globalAlpha = emerge * dot.opacity;
      ctx.beginPath();
      ctx.arc(x, y, clamp(width / 890, 0.66, 1.15) * zoom, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    draw(profile, { color: ink, opacity: surface * 0.77, width: 1.2 });
    if (average > 0) {
      draw([point(0, mean, 0.57), point(input.duration * average, mean, 0.57)], {
        color: green, opacity: 0.96, width: 2,
      });
    }
    drawConnections(ctx, flowLabels, project(...point(input.duration, mean, 0.57)), width, height, time, ink, green);
    for (const [index, item] of labels.entries()) {
      const { x, y } = project(...item.point);
      item.label.style.left = x + item.dx + "px";
      item.label.style.top = y + item.dy + "px";
      item.label.style.opacity = String([baseline, surface, smooth((time - 2.35) / 0.5)][index]);
    }
  }

  function tick(now) {
    frame = 0;
    if (document.hidden) return;
    if (previous) time = Math.min(settledTime, time + Math.min(0.05, (now - previous) / 1000));
    previous = now;
    render();
    if (time < settledTime) frame = requestAnimationFrame(tick);
  }

  function syncPlayback() {
    cancelAnimationFrame(frame);
    previous = 0;
    render();
    if (width && height && time < settledTime && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    plotHeight = height - parseFloat(getComputedStyle(stage).getPropertyValue("--flow-height"));
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    syncPlayback();
  }

  stage.dataset.ready = "";
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  document.addEventListener("visibilitychange", syncPlayback);
  motion.addEventListener("change", (event) => {
    if (event.matches) {
      time = settledTime;
      syncPlayback();
    }
  });
  resize();
}
