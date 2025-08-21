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
const GET_X = (i: number) => 3 * i;
const GET_Y = (i: number) => 3 * i + 1;
const GET_Z = (i: number) => 3 * i + 2;
const getVec3Indices = (i: number) => {
    const base = 3 * i;
    return { x: base, y: base + 1, z: base + 2 };
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

type Bullets = {
    positions: Float32Array,
    colors: Float32Array,
    scales: Float32Array,
    speeds: number[],
    next_free_or_spawned: number[],
    directions: DirVals[]
};

type Freelist = { head: number, tail: number }

// ------------------------------------------

// todo: maybe port over the xorshift if this isn't giving good distributions
const nextRand = (min: number, max: number) => min + (max - min) * Math.random();

const getRandomGridPos = (count: number, base: number) => {
    throw new Error("unimplemented");
    return 0; // todo: implement
};

const getActiveXyzIdx = (dir: DirVals, idx: number) => {
    let res = idx * 3;
    if (dir & (Direction.PY | Direction.NY)) res += 1;
    else if (dir & (Direction.PZ | Direction.NZ)) res += 2;
    return res;
};

const getSign = (dir: DirVals) => {
    return dir & (Direction.PX | Direction.PY | Direction.PZ) ? 1 : -1;
};

// ----------------------------------------

const initFreelist = (frie: Freelist, bullets: Bullets) => {
    for (let i = 0; i < BULLET_COUNT - 1; i++)
        bullets.next_free_or_spawned[i] = i + 1;
    bullets.next_free_or_spawned[BULLET_COUNT - 1] = LIST_END;
    frie.head = 0;
    frie.tail = BULLET_COUNT - 1;
};

const spawnBullet = (freelist: Freelist, bullets: Bullets) => {
    if (freelist.head == LIST_END) return LIST_END;
    const idx = freelist.head;
    freelist.head = bullets.next_free_or_spawned[idx];
    if (freelist.head == LIST_END)
        freelist.tail = LIST_END;
    bullets.next_free_or_spawned[idx] = IS_SPAWNED;

    const color = twgl.v3.lerp([0xC7 / 255, 0x51 / 255, 0x08 / 255], [0x61 / 255, 0x0C / 255, 0xCF / 255], Math.random());
    const bx = idx * 3;
    const by = bx + 1;
    const bz = by + 1;
    bullets.colors[bx] = color[0];
    bullets.colors[by] = color[1];
    bullets.colors[bz] = color[2];
    bullets.directions[idx] = (1 << (Math.floor(Math.random() * Direction.LEN))) as DirVals;
    bullets.speeds[idx] = nextRand(0, 1); // todo: constants
    const bulletRadius = nextRand(0, 1); // todo: constants
    bullets.scales[bx] = bulletRadius;
    bullets.scales[by] = bulletRadius;
    bullets.scales[bz] = bulletRadius;
    bullets.positions[bx] = getRandomGridPos(CUBES_X, X_MIN_CUBE_CENTER);
    bullets.positions[by] = getRandomGridPos(CUBES_Y, Y_MIN_CUBE_CENTER);
    bullets.positions[bz] = getRandomGridPos(CUBES_Z, Z_MIN_CUBE_CENTER);
    const activeIdx = getActiveXyzIdx(bullets.directions[idx], idx);
    bullets.scales[activeIdx] = nextRand(0, 1); // todo: constants
    bullets.positions[activeIdx] = nextRand(0, 1); // todo: constants
    return idx;
};

const freeBullet = (freelist: Freelist, bullets: Bullets, idx: number) => {
    // todo: implement
    throw new Error("unimplemented");
};

const worldToIndex = (coord: number, basePos: number, maxIdx: number) => {
    // NOTE: idk why ceilf had to be used here but it fixed an off by -1 offset
    // issue.
    const ret = Math.ceil((coord - basePos) / (CUBE_SIZE + CUBE_PADDING));
    return ret > maxIdx ? maxIdx : ret < 0 ? 0 : ret;
}

const getBulletBoundingBox = (bullets: Bullets, idx: number) => {
    const vIdx = getVec3Indices(i);
    return {
        min_x: worldToIndex(bullets.positions[vIdx.x] - bullets.scales[vIdx.x], X_MIN_CUBE_CENTER, CUBES_X),
        max_x: worldToIndex(bullets.positions[vIdx.x] + bullets.scales[vIdx.x], X_MIN_CUBE_CENTER, CUBES_X),
        min_y: worldToIndex(bullets.positions[vIdx.y] - bullets.scales[vIdx.y], Y_MIN_CUBE_CENTER, CUBES_Y),
        max_y: worldToIndex(bullets.positions[vIdx.y] + bullets.scales[vIdx.y], Y_MIN_CUBE_CENTER, CUBES_Y),
        min_z: worldToIndex(bullets.positions[vIdx.z] - bullets.scales[vIdx.z], Z_MIN_CUBE_CENTER, CUBES_Z),
        max_z: worldToIndex(bullets.positions[vIdx.z] + bullets.scales[vIdx.z], Z_MIN_CUBE_CENTER, CUBES_Z),
    };
}

const isOutOfBounds = (bullets: Bullets, idx: number) => {
    const vIdx = getVec3Indices(idx);
    switch (bullets.directions[idx]) {
        case Direction.PX:
            return bullets.positions[vIdx.x] > (X_MAX + bullets.scales[vIdx.x]);
        case Direction.NX:
            return bullets.positions[vIdx.x] < (X_MIN - bullets.scales[vIdx.x]);
        case Direction.PY:
            return bullets.positions[vIdx.y] > (Y_MAX + bullets.scales[vIdx.y]);
        case Direction.NY:
            return bullets.positions[vIdx.y] < (Y_MIN - bullets.scales[vIdx.y]);
        case Direction.PZ:
            return bullets.positions[vIdx.y] > (Z_MAX + bullets.scales[vIdx.z]);
        case Direction.NZ:
            return bullets.positions[vIdx.z] < (Z_MIN - bullets.scales[vIdx.z]);
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
    const bullets: Bullets = {
        positions: new Float32Array(BULLET_COUNT * 3),
        colors: new Float32Array(BULLET_COUNT * 3),
        scales: new Float32Array(BULLET_COUNT * 3),
        speeds: new Array<number>(BULLET_COUNT),
        next_free_or_spawned: new Array<number>(BULLET_COUNT),
        directions: new Array<DirVals>(BULLET_COUNT)
    };
    const freelist: Freelist = { head: LIST_END, tail: LIST_END };
    initFreelist(freelist, bullets);

    const cubePositions = new Float32Array(CUBES_COUNT * 3);
    const refPos = twgl.v3.create(0, 0, Z_MIN_CUBE_CENTER);
    for (let z = 0; z < CUBES_Z; z++) {
        refPos[1] = Y_MIN_CUBE_CENTER;
        for (let y = 0; y < CUBES_Y; y++) {
            refPos[0] = X_MIN_CUBE_CENTER;
            for (let x = 0; x < CUBES_X; x++) {
                const idx = getVec3Indices(CUBE_IDX(x, y, z));
                cubePositions[idx.x] = refPos[0]; // x
                cubePositions[idx.y] = refPos[1]; // y
                cubePositions[idx.z] = refPos[2]; // z
                refPos[0] += CUBE_SIZE + CUBE_PADDING;
            }
            refPos[1] += CUBE_SIZE + CUBE_PADDING;
        }
        refPos[2] += CUBE_SIZE + CUBE_PADDING;
    }
    // todo: upload cubePositions to VAO.

    // todo: constants
    let spawnTimer = nextRand(0, 1);

    // todo/architecture: pass around "base index" (pointing to x component) instead of doing getVec3Indices everywhere
    const render = (dt: number) => {
        if ((spawnTimer -= dt) <= 0) {
            spawnBullet(freelist, bullets);
            spawnTimer = nextRand(0, 1); // todo: constants
        }

        // todo: UpdateCamera (orbital)
        for (let i = 0; i < BULLET_COUNT; i++) {
            if (bullets.next_free_or_spawned[i] != IS_SPAWNED)
                continue;
            // debug: keep track of bullet count
            // bullet_count++;

            const dir = bullets.directions[i];
            bullets.positions[getActiveXyzIdx(dir, i)] += dt * getSign(dir) * bullets.speeds[i];
            if (isOutOfBounds(bullets, i)) {
                freeBullet(freelist, bullets, i);
                continue;
            }
            // debug: visualize bullet positions
            // DrawSphereEx(bullets.positions[i], CUBE_SIZE / 8.0f, 4, 4,
            //              ColorFromNormalized(bullets.colors[i]));

            const bbox = getBulletBoundingBox(bullets, i);
            const vIdx = getVec3Indices(i);
            for (let z = bbox.min_z; z < bbox.max_z; z++) {
                for (let y = bbox.min_y; y < bbox.max_y; y++) {
                    for (let x = bbox.min_x; x < bbox.max_x; x++) {
                        const cubeIdx = getVec3Indices(CUBE_IDX(x, y, z));
                        const dx = Math.abs((bullets.positions[vIdx.x] - cubePositions[cubeIdx.x]) / bullets.scales[vIdx.x]);
                        const dy = Math.abs((bullets.positions[vIdx.y] - cubePositions[cubeIdx.y]) / bullets.scales[vIdx.y]);
                        const dz = Math.abs((bullets.positions[vIdx.z] - cubePositions[cubeIdx.z]) / bullets.scales[vIdx.z]);
                        const d = dx + dy + dz;
                        const side_len = Math.max(0, CUBE_SIZE * (1 - d));
                        if (side_len <= EPSILON)
                            continue;
                        // debug: bypass side length calc, show all cubes
                        // const side_len = CUBE_SIZE;
                        DrawCubeWires(cubePosition, side_len, side_len, side_len,
                            ColorFromNormalized(bullets.colors[i]));
                    }
                }
            }
        }
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        requestAnimationFrame(render);
    };

    requestAnimationFrame(render);

};

main();