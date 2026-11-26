import { createScene } from "./atlas-scene.js";

const vector = (value) => value.split(",").map(Number);
const stage = document.querySelector(".atlas-stage");

if (stage) {
  const nodes = Array.from(stage.querySelectorAll(".atlas-node"), (label, index) => ({
    index,
    id: label.dataset.type,
    shape: label.dataset.shape,
    position: vector(label.dataset.position),
    compact: vector(label.dataset.compact),
    label,
    targets: label.dataset.links ? label.dataset.links.split(",") : [],
  }));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const links = nodes.flatMap((from) => from.targets.map((target, index) => {
    const [id, relation] = target.split(":");
    return { from, to: byId.get(id), relation, index: from.index + index };
  }));
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (createScene(stage.querySelector("canvas"), nodes, links, motion)) stage.dataset.ready = "";
}
