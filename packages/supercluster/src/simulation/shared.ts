import { Quat, type Vec3Like } from "gl-matrix";

export const EPS = 1e-8;
export const WORLD_X_AXIS: Vec3Like = [1, 0, 0];
export const WORLD_Y_AXIS: Vec3Like = [0, 1, 0];

export const _q1 = Quat.create();
