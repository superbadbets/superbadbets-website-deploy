const tau = Math.PI * 2;
const goldenAngle = Math.PI * (3 - Math.sqrt(5));

export const mix = (from, to, fraction) => from + (to - from) * fraction;
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function rotate(x, y, z, yaw, pitch) {
  const side = x * Math.cos(yaw) + z * Math.sin(yaw);
  const depth = z * Math.cos(yaw) - x * Math.sin(yaw);
  return [
    side,
    y * Math.cos(pitch) - depth * Math.sin(pitch),
    y * Math.sin(pitch) + depth * Math.cos(pitch),
  ];
}

function orb(index, count) {
  const theta = index * goldenAngle;
  const y = 1 - (2 * (index + 0.5)) / count;
  const radial = Math.sqrt(1 - y * y);
  return [0.58 * radial * Math.cos(theta), 0.58 * y, 0.58 * radial * Math.sin(theta)];
}

function rings(index, count) {
  const group = index % 3;
  const angle = (3 * Math.floor(index / 3) * tau) / count;
  return rotate(0.52 * Math.cos(angle), 0.26 * Math.sin(angle), 0, group * 1.95, group * 0.68 - 0.4);
}

function fork(index, count) {
  const branch = index % 4;
  const along = Math.floor(index / 4) / (count / 4 - 1);
  const phi = branch * tau / 4 + 0.45;
  const flare = 0.50 * along * along;
  return [(along - 0.5) * 1.25, flare * Math.cos(phi), flare * Math.sin(phi)];
}

function windowFrame(index, count) {
  const plane = index % 2;
  const along = Math.floor(index / 2) / (count / 2);
  const edge = Math.floor(along * 4);
  const t = along * 4 - edge;
  const corners = [[-0.32, -0.32], [0.32, -0.32], [0.32, 0.32], [-0.32, 0.32], [-0.32, -0.32]];
  return [plane === 0 ? -0.56 : 0.56, mix(corners[edge][0], corners[edge + 1][0], t), mix(corners[edge][1], corners[edge + 1][1], t)];
}

function interval(index, count) {
  const along = index / count;
  if (index % 3 === 0) return [(along - 0.5) * 1.12, 0, 0];
  const end = index % 3 === 1 ? -0.56 : 0.56;
  const theta = along * tau * 4;
  return [end, 0.29 * Math.cos(theta), 0.29 * Math.sin(theta)];
}

function ruler(index) {
  const sample = index % 8;
  if (sample < 2) return [(index / 102 - 0.5) * 1.10, 0, 0];
  const mark = Math.floor(index / 8);
  const height = mark % 6 === 0 ? 0.41 : 0.19;
  const t = (sample - 2) / 5;
  return [(mark - 6) * 0.095, (t - 0.5) * height, 0];
}

const shapes = { orb, rings, fork, window: windowFrame, interval, ruler };

export function makeDots(shape, group) {
  const count = shape === "orb" ? 156 : 104;
  return Array.from({ length: count }, (_, index) => {
    const phase = index * goldenAngle + group * 1.03;
    return {
      target: shapes[shape](index, count),
      phase,
      height: 2 * ((index * 17 + group * 21) % count) / (count - 1) - 1,
      delay: 0.12 * group + 0.28 * ((index * 23) % 31) / 31,
      weight: index % 6 === 0 ? 1.4 : 1,
    };
  });
}
