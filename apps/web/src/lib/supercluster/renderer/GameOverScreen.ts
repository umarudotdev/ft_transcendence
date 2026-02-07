import { GAME_CONST } from "@ft/supercluster";
import * as THREE from "three";

import { RENDERER_CONST } from "../constants/renderer";

// ============================================================================
// Game Over Screen
// Handles game over visuals: explosion effect and DOM overlay
//
// Responsibilities:
// - Creates and manages explosion visual (Three.js mesh)
// - Creates and manages game over DOM overlay
// - Provides show/hide functionality
// - Cleans up resources on dispose
// ============================================================================
export class GameOverScreen {
  private scene: THREE.Scene;
  private canvas: HTMLCanvasElement;
  private explosionCircle: THREE.Mesh | null = null;
  private overlay: HTMLDivElement | null = null;

  constructor(scene: THREE.Scene, canvas: HTMLCanvasElement) {
    this.scene = scene;
    this.canvas = canvas;
  }

  /**
   * Show the game over screen (explosion + overlay)
   */
  show(): void {
    this.createExplosion();
    this.createOverlay();
  }

  /**
   * Hide and clean up the game over screen
   */
  hide(): void {
    this.removeExplosion();
    this.removeOverlay();
  }

  /**
   * Check if game over screen is currently visible
   */
  isVisible(): boolean {
    return this.overlay !== null;
  }

  /**
   * Create red explosion circle at ship position
   */
  private createExplosion(): void {
    const geometry = new THREE.CircleGeometry(
      RENDERER_CONST.EXPLOSION_RADIUS,
      32
    );
    const material = new THREE.MeshBasicMaterial({
      color: RENDERER_CONST.EXPLOSION_COLOR,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: RENDERER_CONST.EXPLOSION_OPACITY,
    });

    this.explosionCircle = new THREE.Mesh(geometry, material);

    // Position at ship location (ship is at (0, 0, SPHERE_RADIUS) in world space)
    this.explosionCircle.position.set(0, 0, GAME_CONST.SPHERE_RADIUS);

    this.scene.add(this.explosionCircle);
  }

  /**
   * Remove explosion from scene and dispose resources
   */
  private removeExplosion(): void {
    if (this.explosionCircle) {
      this.scene.remove(this.explosionCircle);
      this.explosionCircle.geometry.dispose();
      (this.explosionCircle.material as THREE.Material).dispose();
      this.explosionCircle = null;
    }
  }

  /**
   * Create game over DOM overlay
   */
  private createOverlay(): void {
    // Create overlay container
    this.overlay = document.createElement("div");
    this.overlay.style.position = "absolute";
    this.overlay.style.top = "0";
    this.overlay.style.left = "0";
    this.overlay.style.width = "100%";
    this.overlay.style.height = "100%";
    this.overlay.style.display = "flex";
    this.overlay.style.alignItems = "center";
    this.overlay.style.justifyContent = "center";
    this.overlay.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    this.overlay.style.zIndex = "1000";
    this.overlay.style.pointerEvents = "none"; // Allow clicking through

    // Create content container
    const content = document.createElement("div");
    content.style.textAlign = "center";
    content.style.color = "white";

    // Create title
    const title = document.createElement("h1");
    title.textContent = "GAME OVER";
    title.style.fontSize = "4rem";
    title.style.fontWeight = "bold";
    title.style.color = "#ff0000";
    title.style.margin = "0 0 1rem 0";
    title.style.textShadow = "0 0 20px rgba(255, 0, 0, 0.5)";

    // Create instruction text
    const text = document.createElement("p");
    text.textContent = "Press ENTER to restart";
    text.style.fontSize = "1.5rem";
    text.style.margin = "0";
    text.style.color = "#ffffff";
    text.style.opacity = "0.9";

    content.appendChild(title);
    content.appendChild(text);
    this.overlay.appendChild(content);

    // Add to canvas parent element
    const parent = this.canvas.parentElement;
    if (parent) {
      parent.style.position = "relative"; // Ensure parent is positioned
      parent.appendChild(this.overlay);
    }
  }

  /**
   * Remove overlay from DOM
   */
  private removeOverlay(): void {
    if (this.overlay?.parentElement) {
      this.overlay.parentElement.removeChild(this.overlay);
      this.overlay = null;
    }
  }

  /**
   * Clean up all resources
   */
  dispose(): void {
    this.hide();
  }
}
