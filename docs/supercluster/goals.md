# SuperCluster - Project Goals

## Concept

A simplified Super Stardust-like game running in the browser.
Twin-stick shooter on a spherical planet surface.

## Tech Stack

- **Graphics**: Three.js
- **Language**: TypeScript (C/C++ style syntax, classes when appropriate)
- **Frontend**: SvelteKit (apps/web)
- **Backend**: ElysiaJS (apps/api)
- **Shared Types**: packages/supercluster

## Core Mechanics

### World Structure (3-Layer Sphere)

Three concentric spheres, all rotate together:

1. **Game Sphere** (invisible, radius ~100) - Where ship and objects actually move
2. **Force-Field** (slightly smaller) - Visible grid/wireframe, protective shield visual
3. **Planet** (smallest) - Solid sphere, the actual planet surface

- Ship is a triangle mesh, visually at center of screen
- Camera is fixed behind ship, looking at sphere center
- **Key insight**: All spheres rotate under the ship (WASD/arrows), not ship moving

### Debug Tools

- **lil-gui**: Real-time parameter adjustment
  - Sphere radii (game, force-field, planet)
  - Ship position (phi, theta, aimAngle)
  - Force-field opacity
  - Debug toggles (axes, etc.)

### Controls

- **Movement**: WASD or Arrow keys rotate the planet (ship appears to move)
- **Aiming**: Mouse position determines aim direction (2D tangent plane)
- **Shooting**: Mouse click (future iteration)

### Coordinate System

- Use spherical coordinates (phi, theta) for tracking positions on planet
- Ship position tracked as angles, not Cartesian
- All game objects live on sphere surface

### Aiming Visual

- A line/ray from ship showing aim direction
- Length = half of sphere circumference (visible trajectory)
- Follows tangent plane of sphere at ship position

## Technical Decisions

### Performance (for many objects later)

- **InstancedMesh**: For same-geometry objects (asteroids, enemy types)
- **BatchedMesh**: If we need different geometries with same material
- Render on demand when possible

### Collision Detection (future)

- Angular distance between objects (great-circle distance)
- Object "hitbox" as angular radius
- Simpler than 3D Cartesian collision

## Code Style

- C/C++ inspired: clear structure, explicit types
- Classes for game entities (Ship, Planet, Enemy, Projectile)
- Functions for utilities and setup
- Tab indentation (matching existing codebase)

## Client-Server Architecture

- **Server-authoritative**: Game logic runs on server at 60 ticks/s
- **Client-side prediction**: Uses shared engine from packages/supercluster
- **WebSocket**: Real-time state sync between client and server

## Iterations Overview

1. Basic scene: Planet + Ship + Camera + Movement
2. Shooting mechanics
3. Moving objects on planet (no collision)
4. Collision detection
5. Enemies, asteroids, power-ups
6. Polish: effects, UI, scoring
