import * as twgl from "twgl.js";

const Direction = {
    PX: 0x01,
    NX: 0x02,
    PY: 0x04,
    NY: 0x08,
    PZ: 0x10,
    NZ: 0x20,
    LEN: 6
} as const;
type DirVals = typeof Direction[keyof typeof Direction];

const ListState = {
    LIST_END: -1,
    IS_SPAWNED: -2
} as const;
type ListStateVals = typeof ListState[keyof typeof ListState];

const Cube = {
    SIZE: 0.05,
    PADDING: 0.0005,
    get INTERVAL() {
        return this.SIZE + this.PADDING;
    }
};

const Spawn = {
    TIME: { MIN: 0.1, MAX: 2 }, // in seconds
    RADIUS: {
        MIN: Cube.INTERVAL,
        MAX: Cube.INTERVAL * 3
    },
    LENGTH: {
        MIN: Cube.INTERVAL * 5,
        MAX: Cube.INTERVAL * 8
    },
    SPEED: {
        MIN: Cube.INTERVAL * 3,
        MAX: Cube.INTERVAL * 6
    },
};

let GRID = {};

type Freelist = [head: number, tail: number];

const CENTER = twgl.v3.create(0, 0, 0);
const EPSILON = 1e-6; // from raymath

const CUBES_X = 24;
const CUBES_Y = 24;
const CUBES_Z = 24;
const CUBES_COUNT = (CUBES_X * CUBES_Y * CUBES_Z);

// note: SIZE_X is the scaling factor for bullet speed, radius, etc.
const GETLENGTH = (x: number) => (Cube.INTERVAL * (x) - Cube.PADDING);
const SIZE_X = GETLENGTH(CUBES_X);
const SIZE_Y = GETLENGTH(CUBES_Y);
const SIZE_Z = GETLENGTH(CUBES_Z);

const X_MIN = (CENTER[0] - SIZE_X / 2);
const X_MAX = (CENTER[0] + SIZE_X / 2);
const Y_MIN = (CENTER[1] - SIZE_Y / 2);
const Y_MAX = (CENTER[1] + SIZE_Y / 2);
const Z_MIN = (CENTER[2] - SIZE_Z / 2);
const Z_MAX = (CENTER[2] + SIZE_Z / 2);

const X_MIN_CUBE_CENTER = (X_MIN + Cube.SIZE / 2);
const X_MAX_CUBE_CENTER = (X_MAX - Cube.SIZE / 2);
const Y_MIN_CUBE_CENTER = (Y_MIN + Cube.SIZE / 2);
const Y_MAX_CUBE_CENTER = (Y_MAX - Cube.SIZE / 2);
const Z_MIN_CUBE_CENTER = (Z_MIN + Cube.SIZE / 2);
const Z_MAX_CUBE_CENTER = (Z_MAX - Cube.SIZE / 2);

const CUBE_IDX = (x: number, y: number, z: number) => CUBES_X * CUBES_Y * z + CUBES_X * y + x;

const getVec4Idx = (idx: number) => {
    const base = idx * 4;
    return [base, base + 1, base + 2, base + 3];
}
const getVec3Idx = (idx: number) => {
    const base = idx * 3;
    return [base, base + 1, base + 2];
};

const POINT_COUNT = 10;
const LIST_END = -1;
const IS_SPAWNED = -2;

const initFreelist = (freelist: Freelist, points: PointBufferArray) => {
    for (let i = 0; i < POINT_COUNT - 1; i++)
        points.nextFreeOrSpawned[i] = i + 1;
    points.nextFreeOrSpawned[POINT_COUNT - 1] = LIST_END;
    freelist[0] = 0;
    freelist[1] = POINT_COUNT - 1;
};

const dirToStartPos = (idx: number, points: PointBufferArray) => {
    const offset = points.scales[points.activeIdx[idx]];
    switch (points.directions[idx]) {
        case Direction.PX: return X_MIN - offset;
        case Direction.NX: return X_MAX + offset;
        case Direction.PY: return Y_MIN - offset;
        case Direction.NY: return Y_MAX + offset;
        case Direction.PZ: return Z_MIN - offset;
        case Direction.NZ: return Z_MAX + offset;
        default: throw new Error("invalid direction, can't determine start position");
    }
};

const spawnPoint = (freelist: Freelist, points: PointBufferArray) => {
    if (freelist[0] == LIST_END) return LIST_END;
    const idx = freelist[0];
    freelist[0] = points.nextFreeOrSpawned[idx];
    if (freelist[0] == LIST_END)
        freelist[1] = LIST_END;
    points.nextFreeOrSpawned[idx] = IS_SPAWNED;
    const lerpA = PRNG.nextRange(0, 1);
    const lerpB = 1 - lerpA;
    const [pr, pg, pb, pa] = getVec4Idx(idx);
    points.colors[pr] = (0xC7 / 255) * lerpA + (0x61 / 255) * lerpB;
    points.colors[pg] = (0x51 / 255) * lerpA + (0x0C / 255) * lerpB;
    points.colors[pb] = (0x08 / 255) * lerpA + (0xCF / 255) * lerpB;
    points.colors[pa] = 1;

    const [bx, by, bz] = getVec3Idx(idx);
    points.directions[idx] = 1 << (Math.trunc(Math.random() * Direction.LEN)) as DirVals;
    points.signs[idx] = points.directions[idx] & (Direction.PX | Direction.PY | Direction.PZ) ? 1 : -1;
    points.activeIdx[idx] = points.directions[idx] & (Direction.PX | Direction.NX) ? bx
        : points.directions[idx] & (Direction.PY | Direction.NY) ? by : bz;

    points.speeds[idx] = PRNG.nextRange(Spawn.SPEED.MIN, Spawn.SPEED.MAX);

    const pointRadius = PRNG.nextRange(Spawn.RADIUS.MIN, Spawn.RADIUS.MAX);
    points.scales[bx] = pointRadius;
    points.scales[by] = pointRadius;
    points.scales[bz] = pointRadius;
    points.scales[points.activeIdx[idx]] = PRNG.nextRange(Spawn.LENGTH.MIN, Spawn.LENGTH.MAX);
    points.positions[bx] = X_MIN_CUBE_CENTER + Math.trunc(CUBES_X * Math.random()) * Cube.INTERVAL;
    points.positions[by] = Y_MIN_CUBE_CENTER + Math.trunc(CUBES_Y * Math.random()) * Cube.INTERVAL;
    points.positions[bz] = Z_MIN_CUBE_CENTER + Math.trunc(CUBES_Z * Math.random()) * Cube.INTERVAL;
    points.positions[points.activeIdx[idx]] = dirToStartPos(idx, points);
    return idx;
};

const freePoint = (freelist: Freelist, points: PointBufferArray, idx: number) => {
    const [vx, vy, vz] = getVec3Idx(idx);
    points.positions[vx] = Number.MAX_VALUE;
    points.positions[vy] = Number.MAX_VALUE;
    points.positions[vz] = Number.MAX_VALUE;
    points.nextFreeOrSpawned[idx] = LIST_END;
    if (freelist[1] != LIST_END)
        points.nextFreeOrSpawned[freelist[1]] = idx;
    else
        freelist[0] = idx;
    freelist[1] = idx;
};

const isOutOfBounds = (points: PointBufferArray, idx: number) => {
    const [vx, vy, vz] = getVec3Idx(idx);
    switch (points.directions[idx]) {
        case Direction.PX:
            return points.positions[vx] > (X_MAX + points.scales[vx]);
        case Direction.NX:
            return points.positions[vx] < (X_MIN - points.scales[vx]);
        case Direction.PY:
            return points.positions[vy] > (Y_MAX + points.scales[vy]);
        case Direction.NY:
            return points.positions[vy] < (Y_MIN - points.scales[vy]);
        case Direction.PZ:
            return points.positions[vz] > (Z_MAX + points.scales[vz]);
        case Direction.NZ:
            return points.positions[vz] < (Z_MIN - points.scales[vz]);
        default:
            return true;
    }
};

const worldToIndex = (coord: number, basePos: number, maxIdx: number) => {
    // NOTE: idk why ceilf had to be used here but it fixed an off by -1 offset
    // issue.
    const ret = Math.ceil((coord - basePos) / Cube.INTERVAL);
    return ret > maxIdx ? maxIdx : ret < 0 ? 0 : ret;
    // todo: revisit this to see what's up, why it broke, so it just naturally gives the correct val at correct range without clamping
}

const getPointBoundingBox = (points: PointBufferArray, idx: number) => {
    const [vx, vy, vz] = getVec3Idx(idx);
    return {
        min_x: worldToIndex(points.positions[vx] - points.scales[vx], X_MIN_CUBE_CENTER, CUBES_X),
        max_x: worldToIndex(points.positions[vx] + points.scales[vx], X_MIN_CUBE_CENTER, CUBES_X),
        min_y: worldToIndex(points.positions[vy] - points.scales[vy], Y_MIN_CUBE_CENTER, CUBES_Y),
        max_y: worldToIndex(points.positions[vy] + points.scales[vy], Y_MIN_CUBE_CENTER, CUBES_Y),
        min_z: worldToIndex(points.positions[vz] - points.scales[vz], Z_MIN_CUBE_CENTER, CUBES_Z),
        max_z: worldToIndex(points.positions[vz] + points.scales[vz], Z_MIN_CUBE_CENTER, CUBES_Z),
    };
}

// ----------------------------------------

export const main = async () => {
    const gl = (document.getElementById("bg-canvas") as HTMLCanvasElement).getContext("webgl2");
    if (!gl) return;

    const progInfo = twgl.createProgramInfo(gl, [
        await (await fetch("shader.vs")).text(),
        await (await fetch("shader.fs")).text()
    ]);

    const cubeInstanceArray = new CubeInstanceArray(CUBES_COUNT, 3);

    const rectArrays: twgl.Arrays = {
        position: {
            numComponents: 3,
            data: [-0.5, -0.5, 0.5, //0
                0.5, -0.5, 0.5, //1
            -0.5, 0.5, 0.5, //2
                0.5, 0.5, 0.5, //3
            -0.5, -0.5, -0.5, //4
                0.5, -0.5, -0.5, //5
            -0.5, 0.5, -0.5, //6
                0.5, 0.5, -0.5] //7
        },
        indices: {
            numComponents: 2,
            data: [
                0, 1, 1, 3, 3, 2, 2, 0,
                4, 5, 5, 7, 7, 6, 6, 4,
                0, 4, 1, 5, 2, 6, 3, 7
            ]
        },
        instanceCenter: {
            divisor: 1,
            numComponents: 3,
            data: cubeInstanceArray.instanceCenters
        },
        instanceColor: {
            divisor: 1,
            numComponents: 4,
            data: cubeInstanceArray.instanceColors
        },
        instanceSize: {
            divisor: 1,
            numComponents: 1,
            data: cubeInstanceArray.instanceSizes
        },

    };

    // TODO/optimize: this runs at startup every time, once the scene gets finalized just precompute
    // all of this and throw it in a huge array.
    const gridPositions = new Float32Array(CUBES_COUNT * 3);
    const refPos = twgl.v3.create(X_MIN_CUBE_CENTER, Y_MIN_CUBE_CENTER, Z_MIN_CUBE_CENTER);
    for (let z = 0; z < CUBES_Z; z++) {
        refPos[1] = Y_MIN_CUBE_CENTER;
        for (let y = 0; y < CUBES_Y; y++) {
            refPos[0] = X_MIN_CUBE_CENTER;
            for (let x = 0; x < CUBES_X; x++) {
                const [cx, cy, cz] = getVec3Idx(CUBE_IDX(x, y, z));
                gridPositions[cx] = refPos[0]; // x
                gridPositions[cy] = refPos[1]; // y
                gridPositions[cz] = refPos[2]; // z
                refPos[0] += Cube.INTERVAL;
            }
            refPos[1] += Cube.INTERVAL;
        }
        refPos[2] += Cube.INTERVAL;
    }

    const points = new PointBufferArray(POINT_COUNT);
    const freelist: Freelist = [LIST_END, LIST_END];
    initFreelist(freelist, points);

    const rectBuff = twgl.createBufferInfoFromArrays(gl, rectArrays);
    const vao = twgl.createVAOFromBufferInfo(gl, progInfo, rectBuff);
    const maxGridSize = SIZE_X > SIZE_Y ? SIZE_X : SIZE_Y;
    const fieldOfView = 3;
    const viewMat = twgl.m4.inverse(twgl.m4.lookAt([0, 0, maxGridSize * fieldOfView], [0, 0, 0], [0, 1, 0]));
    gl.useProgram(progInfo.program);
    gl.bindVertexArray(vao);
    twgl.setUniforms(progInfo, { u_view: viewMat });

    let dt: number;
    let lastTime = 0;
    let spawnTimer = PRNG.nextRange(Spawn.TIME.MIN, Spawn.TIME.MAX);
    const render = (time: number) => {
        dt = (time - lastTime) / 1000;
        lastTime = time;
        cubeInstanceArray.reset();

        if ((spawnTimer -= dt) <= 0) {
            spawnPoint(freelist, points);
            spawnTimer = PRNG.nextRange(Spawn.TIME.MIN, Spawn.TIME.MAX);
        }

        for (let i = 0; i < POINT_COUNT; i++) {
            if (points.nextFreeOrSpawned[i] != IS_SPAWNED)
                continue;

            points.positions[points.activeIdx[i]] += dt * points.signs[i] * points.speeds[i];
            if (isOutOfBounds(points, i)) {
                freePoint(freelist, points, i);
                continue;
            }

            const bbox = getPointBoundingBox(points, i);
            const [px, py, pz] = getVec3Idx(i);
            const [pr, pg, pb, pa] = getVec4Idx(i);
            for (let z = bbox.min_z; z < bbox.max_z; z++) {
                for (let y = bbox.min_y; y < bbox.max_y; y++) {
                    for (let x = bbox.min_x; x < bbox.max_x; x++) {
                        const [cx, cy, cz] = getVec3Idx(CUBE_IDX(x, y, z));
                        const dx = Math.abs((points.positions[px] - gridPositions[cx]) / points.scales[px]);
                        const dy = Math.abs((points.positions[py] - gridPositions[cy]) / points.scales[py]);
                        const dz = Math.abs((points.positions[pz] - gridPositions[cz]) / points.scales[pz]);
                        const d = dx + dy + dz;
                        const sideLen = Math.max(0, Cube.SIZE * (1 - d));
                        if (sideLen <= EPSILON)
                            continue;
                        // debug: bypass side length calc, show all cubes
                        // const side_len = CUBE_SIZE;

                        cubeInstanceArray.setPointData(
                            [gridPositions[cx], gridPositions[cy], gridPositions[cz]],
                            [points.colors[pr], points.colors[pg], points.colors[pb], points.colors[pa]],
                            sideLen
                        );
                    }
                }
            }
        }


        if (twgl.resizeCanvasToDisplaySize(gl.canvas as HTMLCanvasElement)) {
            twgl.setUniforms(progInfo, {
                u_proj: twgl.m4.perspective(1 / fieldOfView,
                    gl.drawingBufferWidth / gl.drawingBufferHeight,
                    0.1,
                    100)
            });
        }
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        twgl.setAttribInfoBufferFromArray(gl, rectBuff.attribs!.instanceCenter, cubeInstanceArray.instanceCenters);
        twgl.setAttribInfoBufferFromArray(gl, rectBuff.attribs!.instanceSize, cubeInstanceArray.instanceSizes);
        twgl.setAttribInfoBufferFromArray(gl, rectBuff.attribs!.instanceColor, cubeInstanceArray.instanceColors);
        twgl.drawBufferInfo(gl, rectBuff, gl.LINES, undefined, undefined, cubeInstanceArray.count);
    };

    const tryRender = (time: number) => {
        try {
            requestAnimationFrame(tryRender);
            render(time);
        } catch (e) {
            console.error(e);
            return;
        }
    };
    requestAnimationFrame(tryRender);
};

// credit: https://gist.github.com/tommyettinger/46a874533244883189143505d203312c?permalink_comment_id=4370639#gistcomment-4370639
class PRNG {
    private static base = 0;
    private static readonly maxVal = 0xffff_ffff;

    // Weyl-sequence-based generator (Mulberry32 cousin)
    public static next() {
        let z = (this.base += 0x9e3779b9);
        z ^= z >>> 16;
        z = Math.imul(z, 0x21f0aaad);
        z ^= z >>> 15;
        z = Math.imul(z, 0x735a2d97);
        z ^= z >>> 15;
        return z >>> 0; // coerce to a u32 val
    }
    public static nextRange(min: number, max: number) {
        return min + (max - min) * (this.next() / this.maxVal);
    }
}

class CubeInstanceArray {
    private data: ArrayBuffer;
    public count = 0;
    public instanceCenters: Float32Array; // float vec3
    public instanceColors: Float32Array; // float vec4
    public instanceSizes: Float32Array; // float
    constructor(instanceNum: number, maxCubesPerPosition: number) {
        const instances = instanceNum * maxCubesPerPosition;
        const vec4Elts = 4 * instances;
        const vec3Elts = 3 * instances;
        this.data = new ArrayBuffer((vec3Elts + vec4Elts + instances) * Float32Array.BYTES_PER_ELEMENT);
        let offset = 0;
        this.instanceCenters = new Float32Array(this.data, offset, vec3Elts);
        offset += vec3Elts * Float32Array.BYTES_PER_ELEMENT;
        this.instanceColors = new Float32Array(this.data, offset, vec4Elts);
        offset += vec4Elts * Float32Array.BYTES_PER_ELEMENT;
        this.instanceSizes = new Float32Array(this.data, offset, instances);
    }

    public setPointData(position: [number, number, number], color: [number, number, number, number], size: number) {
        this.instanceCenters.set(position, this.count * 3);
        this.instanceColors.set(color, this.count * 4);
        this.instanceSizes[this.count] = size;
        this.count++;
    }

    public reset() { this.count = 0; }
}

class PointBufferArray {
    private data: ArrayBuffer;

    public positions: Float32Array; // float vec3
    public colors: Float32Array; // float vec4 (TODO: SHOULD BE VEC4)
    public scales: Float32Array; // float vec3
    public speeds: Float32Array; // float
    public nextFreeOrSpawned: Int32Array; // int32
    public activeIdx: Int32Array; // int32
    public directions: Int8Array; // char
    public signs: Int8Array; // char (signed)

    constructor(poolSize: number) {
        const floatBytes = Float32Array.BYTES_PER_ELEMENT * poolSize;
        const vec3Bytes = 3 * floatBytes;
        const vec4Bytes = 4 * floatBytes;
        const int32Bytes = Int32Array.BYTES_PER_ELEMENT * poolSize;
        const int8Bytes = Int8Array.BYTES_PER_ELEMENT * poolSize;
        this.data = new ArrayBuffer(
            vec4Bytes + // colors
            vec3Bytes * 2 + // positions, scales
            floatBytes + // speeds
            int32Bytes * 2 + // nextFreeOrSpawned, activeIdx
            int8Bytes * 2 // directions, signs
        );

        let offset = 0;
        this.positions = new Float32Array(this.data, offset, 3 * poolSize);
        offset += vec3Bytes;
        this.colors = new Float32Array(this.data, offset, 4 * poolSize);
        offset += vec4Bytes;
        this.scales = new Float32Array(this.data, offset, 3 * poolSize);
        offset += vec3Bytes;
        this.speeds = new Float32Array(this.data, offset, poolSize);
        offset += floatBytes;
        this.nextFreeOrSpawned = new Int32Array(this.data, offset, poolSize);
        offset += int32Bytes;
        this.activeIdx = new Int32Array(this.data, offset, poolSize);
        offset += int32Bytes;
        this.directions = new Int8Array(this.data, offset, poolSize);
        offset += int8Bytes;
        this.signs = new Int8Array(this.data, offset, poolSize);
    }
}