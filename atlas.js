import { createScene } from "./atlas-scene.js";

const stage = document.querySelector(".atlas-stage");
if (stage) {
  createScene(stage, JSON.parse(stage.dataset.capacity), window.matchMedia("(prefers-reduced-motion: reduce)"));
}
