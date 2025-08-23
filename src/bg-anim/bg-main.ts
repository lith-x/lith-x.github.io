import * as twgl from "twgl.js"

const CENTER = twgl.v3.create(0, 0, 0);
const EPSILON = 1e-6; // from raymath

const CUBE_SIZE = 1.0;
const CUBE_PADDING = 0.1;

const CUBES_X = 25;
const CUBES_Y = 25;
const CUBES_Z = 25;
const CUBES_COUNT = (CUBES_X * CUBES_Y * CUBES_Z);

// note: SIZE_X is the scaling factor for bullet speed, radius, etc.
const GETLENGTH = (x: number) => ((CUBE_SIZE + CUBE_PADDING) * (x) - CUBE_PADDING);
const SIZE_X = GETLENGTH(CUBES_X);
const SIZE_Y = GETLENGTH(CUBES_Y);
const SIZE_Z = GETLENGTH(CUBES_Z);

const X_MIN = (CENTER[0] - SIZE_X / 2.0);
const X_MAX = (CENTER[0] + SIZE_X / 2.0);
const Y_MIN = (CENTER[1] - SIZE_Y / 2.0);
const Y_MAX = (CENTER[1] + SIZE_Y / 2.0);
const Z_MIN = (CENTER[2] - SIZE_Z / 2.0);
const Z_MAX = (CENTER[2] + SIZE_Z / 2.0);

const X_MIN_CUBE_CENTER = (X_MIN + CUBE_SIZE / 2.0);
const X_MAX_CUBE_CENTER = (X_MAX - CUBE_SIZE / 2.0);
const Y_MIN_CUBE_CENTER = (Y_MIN + CUBE_SIZE / 2.0);
const Y_MAX_CUBE_CENTER = (Y_MAX - CUBE_SIZE / 2.0);
const Z_MIN_CUBE_CENTER = (Z_MIN + CUBE_SIZE / 2.0);
const Z_MAX_CUBE_CENTER = (Z_MAX - CUBE_SIZE / 2.0);

const CUBE_IDX = (x: number, y: number, z: number) => CUBES_X * CUBES_Y * z + CUBES_X * y + x;

const getVec3Idx = (idx: number) => {
    const base = idx * 3;
    return [base, base + 1, base + 2];
}

const BULLET_COUNT = 5;
const LIST_END = -1;
const IS_SPAWNED = -2;

// --------------------------------------------

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

type Freelist = { head: number, tail: number }

// ------------------------------------------

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

// ----------------------------------------

const initFreelist = (frie: Freelist, bullets: PointBufferArray) => {
    for (let i = 0; i < BULLET_COUNT - 1; i++)
        bullets.nextFreeOrSpawned[i] = i + 1;
    bullets.nextFreeOrSpawned[BULLET_COUNT - 1] = LIST_END;
    frie.head = 0;
    frie.tail = BULLET_COUNT - 1;
};

const spawnPoint = (freelist: Freelist, points: PointBufferArray) => {
    if (freelist.head == LIST_END) return LIST_END;
    const idx = freelist.head;
    freelist.head = points.nextFreeOrSpawned[idx];
    if (freelist.head == LIST_END)
        freelist.tail = LIST_END;
    points.nextFreeOrSpawned[idx] = IS_SPAWNED;

    const [bx, by, bz] = getVec3Idx(idx);
    const lerpA = PRNG.nextRange(0, 1); // todo: this is correct, don't change. just remove this when the other consts are handled
    const lerpB = 1 - lerpA;
    points.colors[bx] = (0xC7 / 255) * lerpA + (0x61 / 255) * lerpB;
    points.colors[by] = (0x51 / 255) * lerpA + (0x0C / 255) * lerpB;
    points.colors[bz] = (0x08 / 255) * lerpA + (0xCF / 255) * lerpB;

    points.directions[idx] = (1 << (Math.floor(Math.random() * Direction.LEN))) as DirVals;
    points.signs[idx] = points.directions[idx] & (Direction.PX | Direction.PY | Direction.PZ) ? 1 : -1;
    points.activeIdx[idx] = points.directions[idx] & (Direction.PX | Direction.NX) ? bx
        : points.directions[idx] & (Direction.PY | Direction.NY) ? by : bz;

    points.speeds[idx] = PRNG.nextRange(0, 1); // todo: constants

    const bulletRadius = PRNG.nextRange(0, 1); // todo: constants
    points.scales[bx] = bulletRadius;
    points.scales[by] = bulletRadius;
    points.scales[bz] = bulletRadius;
    points.positions[bx] = X_MIN_CUBE_CENTER + Math.trunc(CUBES_X * Math.random()) * (CUBE_SIZE + CUBE_PADDING);
    points.positions[by] = Y_MIN_CUBE_CENTER + Math.trunc(CUBES_Y * Math.random()) * (CUBE_SIZE + CUBE_PADDING);
    points.positions[bz] = Z_MIN_CUBE_CENTER + Math.trunc(CUBES_Z * Math.random()) * (CUBE_SIZE + CUBE_PADDING);
    points.scales[points.activeIdx[idx]] = PRNG.nextRange(0, 1); // todo: constants
    points.positions[points.activeIdx[idx]] = PRNG.nextRange(0, 1); // todo: constants
    return idx;
};

const freeBullet = (freelist: Freelist, points: PointBufferArray, idx: number) => {
    const [vx, vy, vz] = getVec3Idx(idx);
    points.positions[vx] = Number.MAX_VALUE;
    points.positions[vy] = Number.MAX_VALUE;
    points.positions[vz] = Number.MAX_VALUE;
    points.nextFreeOrSpawned[idx] = LIST_END;
    if (freelist.tail != LIST_END)
        points.nextFreeOrSpawned[freelist.tail] = idx;
    else
        freelist.head = idx;
    freelist.tail = idx;
};

const worldToIndex = (coord: number, basePos: number, maxIdx: number) => {
    // NOTE: idk why ceilf had to be used here but it fixed an off by -1 offset
    // issue.
    const ret = Math.ceil((coord - basePos) / (CUBE_SIZE + CUBE_PADDING));
    return ret > maxIdx ? maxIdx : ret < 0 ? 0 : ret;
}

const getBulletBoundingBox = (points: PointBufferArray, idx: number) => {
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

const isOutOfBounds = (bullets: PointBufferArray, idx: number) => {
    const [vx, vy, vz] = getVec3Idx(idx);
    switch (bullets.directions[idx]) {
        case Direction.PX:
            return bullets.positions[vx] > (X_MAX + bullets.scales[vx]);
        case Direction.NX:
            return bullets.positions[vx] < (X_MIN - bullets.scales[vx]);
        case Direction.PY:
            return bullets.positions[vy] > (Y_MAX + bullets.scales[vy]);
        case Direction.NY:
            return bullets.positions[vy] < (Y_MIN - bullets.scales[vy]);
        case Direction.PZ:
            return bullets.positions[vz] > (Z_MAX + bullets.scales[vz]);
        case Direction.NZ:
            return bullets.positions[vz] < (Z_MIN - bullets.scales[vz]);
        default:
            return true;
    }
};

// ------------ Raylib ports ---------------

type Vector3 = { x: number, y: number, z: number };
type Camera = {
    position: Vector3
    target: Vector3
    up: Vector3
    fovy: number
    projection: number // could probably get rid of this, only ever use CAMERA_PERSPECTIVE
};

const UpdateCamera = (camera: Camera) => {

};

// -----------------------------------------

const main = () => {
    const gl = (document.getElementById("bg-canvas") as HTMLCanvasElement).getContext("webgl2");
    if (!gl) return;

    const points = new PointBufferArray(BULLET_COUNT);
    const freelist: Freelist = { head: LIST_END, tail: LIST_END };
    initFreelist(freelist, points);

    const cubePositions = new Float32Array(CUBES_COUNT * 3);
    const refPos = twgl.v3.create(0, 0, Z_MIN_CUBE_CENTER);
    for (let z = 0; z < CUBES_Z; z++) {
        refPos[1] = Y_MIN_CUBE_CENTER;
        for (let y = 0; y < CUBES_Y; y++) {
            refPos[0] = X_MIN_CUBE_CENTER;
            for (let x = 0; x < CUBES_X; x++) {
                const [cx, cy, cz] = getVec3Idx(CUBE_IDX(x, y, z));
                cubePositions[cx] = refPos[0]; // x
                cubePositions[cy] = refPos[1]; // y
                cubePositions[cz] = refPos[2]; // z
                refPos[0] += CUBE_SIZE + CUBE_PADDING;
            }
            refPos[1] += CUBE_SIZE + CUBE_PADDING;
        }
        refPos[2] += CUBE_SIZE + CUBE_PADDING;
    }
    // todo: upload cubePositions to VAO.

    // todo: constants
    let spawnTimer = PRNG.nextRange(0, 1);

    // ------ gl setup ------
    const progInfo = twgl.createProgramInfo(gl, ["shader.vs", "shader.fs"]);

    // todo/architecture: pass around "base index" (pointing to x component) instead of doing getVec3Indices everywhere
    const render = (dt: number) => {
        if ((spawnTimer -= dt) <= 0) {
            spawnPoint(freelist, points);
            spawnTimer = PRNG.nextRange(0, 1); // todo: constants
        }

        // todo: UpdateCamera (orbital)
        for (let i = 0; i < BULLET_COUNT; i++) {
            if (points.nextFreeOrSpawned[i] != IS_SPAWNED)
                continue;
            // debug: keep track of bullet count
            // bullet_count++;

            const dir = points.directions[i] as DirVals;
            points.positions[points.activeIdx[i]] += dt * points.signs[i] * points.speeds[i];
            if (isOutOfBounds(points, i)) {
                freeBullet(freelist, points, i);
                continue;
            }
            // debug: visualize bullet positions
            // DrawSphereEx(points.positions[i], CUBE_SIZE / 8.0f, 4, 4,
            //              ColorFromNormalized(points.colors[i]));

            const cubeData: { centerIdx: number, colorIdx: number, size: number }[] = [];

            const bbox = getBulletBoundingBox(points, i);
            const [vx, vy, vz] = getVec3Idx(i);
            for (let z = bbox.min_z; z < bbox.max_z; z++) {
                for (let y = bbox.min_y; y < bbox.max_y; y++) {
                    for (let x = bbox.min_x; x < bbox.max_x; x++) {
                        const [cx, cy, cz] = getVec3Idx(CUBE_IDX(x, y, z));
                        const dx = Math.abs((points.positions[vx] - cubePositions[cx]) / points.scales[vx]);
                        const dy = Math.abs((points.positions[vy] - cubePositions[cy]) / points.scales[vy]);
                        const dz = Math.abs((points.positions[vz] - cubePositions[cz]) / points.scales[vz]);
                        const d = dx + dy + dz;
                        const sideLen = Math.max(0, CUBE_SIZE * (1 - d));
                        if (sideLen <= EPSILON)
                            continue;
                        // debug: bypass side length calc, show all cubes
                        // const side_len = CUBE_SIZE;
                        cubeData.push({ centerIdx: cx, colorIdx: vx, size: sideLen });
                    }
                }
            }
        }
        twgl.resizeCanvasToDisplaySize(gl.canvas as HTMLCanvasElement);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        requestAnimationFrame(render);
    };

    requestAnimationFrame(render);

};

main();


class PointBufferArray {
    private data: ArrayBuffer;
    // data layout: positions(vec3float), colors(vec3float), scales(vec3float), speeds(int32), nextFreeOrSpawned(int32), directions(uint8)

    public positions: Float32Array;
    public colors: Float32Array;
    public scales: Float32Array;
    public speeds: Float32Array;
    public nextFreeOrSpawned: Int32Array;
    public activeIdx: Int32Array;
    public directions: Int8Array;
    public signs: Int8Array;

    constructor(poolSize: number) {
        const floatBytes = Float32Array.BYTES_PER_ELEMENT * poolSize;
        const vec3Bytes = 3 * floatBytes;
        const int32Bytes = Int32Array.BYTES_PER_ELEMENT * poolSize;
        const int8Bytes = Int8Array.BYTES_PER_ELEMENT * poolSize;
        this.data = new ArrayBuffer(
            vec3Bytes * 3 + // positions, colors, scales
            floatBytes + // speeds
            int32Bytes * 2 + // nextFreeOrSpawned, activeIdx
            int8Bytes * 2 // directions, signs
        );

        let offset = 0;
        this.positions = new Float32Array(this.data, offset, 3 * poolSize);
        offset += vec3Bytes;
        this.colors = new Float32Array(this.data, offset, 3 * poolSize);
        offset += vec3Bytes;
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