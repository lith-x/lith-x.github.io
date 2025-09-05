import * as twgl from "twgl.js";

// ---------- types, constants, helpers ----------

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
        MAX: Cube.INTERVAL * 8
    },
};

const CENTER = twgl.v3.create(0, 0, 0);
const EPSILON = 1e-6; // from raymath

const CUBES_X = 24;
const CUBES_Y = 24;
const CUBES_Z = 24;
const CUBES_COUNT = (CUBES_X * CUBES_Y * CUBES_Z);

const getGridLength = (x: number) => (Cube.INTERVAL * x - Cube.PADDING);
const SIZE_X = getGridLength(CUBES_X);
const SIZE_Y = getGridLength(CUBES_Y);
const SIZE_Z = getGridLength(CUBES_Z);

const X_MIN = (CENTER[0] - SIZE_X / 2);
const X_MAX = (CENTER[0] + SIZE_X / 2);
const Y_MIN = (CENTER[1] - SIZE_Y / 2);
const Y_MAX = (CENTER[1] + SIZE_Y / 2);
const Z_MIN = (CENTER[2] - SIZE_Z / 2);
const Z_MAX = (CENTER[2] + SIZE_Z / 2);

const X_MIN_CUBE_CENTER = (X_MIN + Cube.SIZE / 2);
const Y_MIN_CUBE_CENTER = (Y_MIN + Cube.SIZE / 2);
const Z_MIN_CUBE_CENTER = (Z_MIN + Cube.SIZE / 2);

const POINT_COUNT = 10;

const cubeIdx = (x: number, y: number, z: number) => CUBES_X * CUBES_Y * z + CUBES_X * y + x;

// benchmarked various methods of doing this function, it made little difference
// turns out it makes a copy anyways regardless of const, oh well. 
const v3Scratch: [x: number, y: number, z: number] = [0, 0, 0];
const getVec3Idx = (idx: number) => {
    const base = idx * 3;
    v3Scratch[0] = base;
    v3Scratch[1] = base + 1;
    v3Scratch[2] = base + 2;
    return v3Scratch;
};

// -------------------- main --------------------

export const main = async () => {
    const gl = (document.getElementById("bg-canvas") as HTMLCanvasElement).getContext("webgl2");
    if (!gl) return;

    const progInfo = twgl.createProgramInfo(gl, [
        await (await fetch("shader.vs")).text(),
        await (await fetch("shader.fs")).text()
    ]);

    const cubeInstanceArray = new CubeInstanceArray(CUBES_COUNT, 3);

    const rectArrays: twgl.Arrays = {
        indices: {
            numComponents: 2,
            data: [
                0, 1, 1, 3, 3, 2, 2, 0,
                4, 5, 5, 7, 7, 6, 6, 4,
                0, 4, 1, 5, 2, 6, 3, 7
            ],
            drawType: gl.STATIC_DRAW
        },
        position: {
            numComponents: 3,
            data: [-0.5, -0.5, 0.5,
                0.5, -0.5, 0.5,
            -0.5, 0.5, 0.5,
                0.5, 0.5, 0.5,
            -0.5, -0.5, -0.5,
                0.5, -0.5, -0.5,
            -0.5, 0.5, -0.5,
                0.5, 0.5, -0.5],
            drawType: gl.STATIC_DRAW
        },
        instanceCenter: {
            divisor: 1,
            numComponents: 3,
            data: cubeInstanceArray.instanceCenters,
            drawType: gl.STREAM_DRAW
        },
        instanceColor: {
            divisor: 1,
            numComponents: 3,
            data: cubeInstanceArray.instanceColors,
            drawType: gl.STREAM_DRAW
        },
        instanceSize: {
            divisor: 1,
            numComponents: 1,
            data: cubeInstanceArray.instanceSizes,
            drawType: gl.STREAM_DRAW
        }
    };

    const gridPositions = new Float32Array(CUBES_COUNT * 3); // float vec3
    const refPos = twgl.v3.create(X_MIN_CUBE_CENTER, Y_MIN_CUBE_CENTER, Z_MIN_CUBE_CENTER);
    for (let z = 0; z < CUBES_Z; z++) {
        refPos[1] = Y_MIN_CUBE_CENTER;
        for (let y = 0; y < CUBES_Y; y++) {
            refPos[0] = X_MIN_CUBE_CENTER;
            for (let x = 0; x < CUBES_X; x++) {
                const [cx, cy, cz] = getVec3Idx(cubeIdx(x, y, z));
                gridPositions[cx] = refPos[0];
                gridPositions[cy] = refPos[1];
                gridPositions[cz] = refPos[2];
                refPos[0] += Cube.INTERVAL;
            }
            refPos[1] += Cube.INTERVAL;
        }
        refPos[2] += Cube.INTERVAL;
    }

    const rectBuff = twgl.createBufferInfoFromArrays(gl, rectArrays);
    const vao = twgl.createVAOFromBufferInfo(gl, progInfo, rectBuff);
    const maxGridSize = SIZE_X > SIZE_Y ? SIZE_X : SIZE_Y;
    const fieldOfView = 3;
    gl.useProgram(progInfo.program);
    gl.bindVertexArray(vao);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    twgl.setUniforms(progInfo, {
        u_view: twgl.m4.inverse(twgl.m4.lookAt([0, 0, maxGridSize * fieldOfView], CENTER, [0, 1, 0]))
    });

    let dt: number;
    let lastTime = 0;
    let resized = false;
    const points = new PointsArray(POINT_COUNT);
    let spawnTimer = PRNG.nextRange(Spawn.TIME.MIN, Spawn.TIME.MAX);
    const render = (time: number) => {
        // --- update ---
        dt = (time - lastTime) / 1000;
        lastTime = time;
        cubeInstanceArray.reset();

        if ((spawnTimer -= dt) <= 0) {
            points.spawn();
            spawnTimer = PRNG.nextRange(Spawn.TIME.MIN, Spawn.TIME.MAX);
        }

        for (let i = 0; i < points.count; i++) {
            if (points.isNotSpawned(i))
                continue;

            points.positions[points.activeIdx[i]] += dt * points.speeds[i];
            if (points.isOutOfBounds(i)) {
                points.free(i);
                continue;
            }

            const bbox = points.getBoundingBox(i);
            const [px, py, pz] = getVec3Idx(i);
            for (let z = bbox.min.z; z < bbox.max.z; z++) {
                for (let y = bbox.min.y; y < bbox.max.y; y++) {
                    for (let x = bbox.min.x; x < bbox.max.x; x++) {
                        // inlined: getVec3Idx(cubeIdx(x, y, z))
                        const cx = (CUBES_X * CUBES_Y * z + CUBES_X * y + x) * 3;
                        const cy = cx + 1;
                        const cz = cy + 1;
                        const dx = Math.abs((points.positions[px] - gridPositions[cx]) / points.scales[px]);
                        const dy = Math.abs((points.positions[py] - gridPositions[cy]) / points.scales[py]);
                        const dz = Math.abs((points.positions[pz] - gridPositions[cz]) / points.scales[pz]);
                        const d = dx + dy + dz;

                        // octahedral shape with a linear falloff
                        const sideLen = Cube.SIZE * (1 - d);
                        if (sideLen <= EPSILON)
                            continue;

                        cubeInstanceArray.setPointData(
                            gridPositions[cx], gridPositions[cy], gridPositions[cz],
                            points.colors[px], points.colors[py], points.colors[pz],
                            sideLen
                        );
                    }
                }
            }
        }

        // --- render ---
        resized = twgl.resizeCanvasToDisplaySize(gl.canvas as HTMLCanvasElement);
        if (resized) {
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

    // wrapping render around try/catch so it can fail gracefully
    const tryRender = (time: number) => {
        try {
            render(time);
            requestAnimationFrame(tryRender);
        } catch (e) {
            console.error(e);
            try {
                // attempt to clear the canvas 
                gl.clearColor(0, 0, 0, 0);
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            } catch (ie) { }
            return;
        }
    };
    requestAnimationFrame(tryRender);
};

// ------------------- classes ------------------

// credit: https://gist.github.com/tommyettinger/46a874533244883189143505d203312c?permalink_comment_id=4370639#gistcomment-4370639
class PRNG {
    private static base = Date.now(); // initial seed for PRNG
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
    public instanceColors: Float32Array; // float vec3
    public instanceSizes: Float32Array; // float

    constructor(instanceNum: number, maxCubesPerPosition: number) {
        const instances = instanceNum * maxCubesPerPosition;
        const vec3Elts = 3 * instances;
        this.data = new ArrayBuffer((vec3Elts * 2 + instances) * Float32Array.BYTES_PER_ELEMENT);

        let offset = 0;
        this.instanceCenters = new Float32Array(this.data, offset, vec3Elts);
        offset += vec3Elts * Float32Array.BYTES_PER_ELEMENT;
        this.instanceColors = new Float32Array(this.data, offset, vec3Elts);
        offset += vec3Elts * Float32Array.BYTES_PER_ELEMENT;
        this.instanceSizes = new Float32Array(this.data, offset, instances);
    }

    public setPointData(x: number, y: number, z: number, r: number, g: number, b: number, size: number) {
        // This is in the hottest loop in the program, must be as fast as possible.
        const ix = this.count * 3;
        const iy = ix + 1;
        const iz = iy + 1;
        this.instanceCenters[ix] = x;
        this.instanceCenters[iy] = y;
        this.instanceCenters[iz] = z;

        this.instanceColors[ix] = r;
        this.instanceColors[iy] = g;
        this.instanceColors[iz] = b;
        this.instanceSizes[this.count] = size;
        this.count++;
    }

    public reset() { this.count = 0; }
}

// constants used for freelist, internal to PointsArray
// hoisted out for readability
const FL = Object.freeze({
    HEAD: 0,
    TAIL: 1,
    END: -1,
    SPAWNED: -2
});

class PointsArray {
    private data: ArrayBuffer;
    public readonly count: number;

    public positions: Float32Array; // float vec3
    public colors: Float32Array; // float vec3
    public scales: Float32Array; // float vec3
    public speeds: Float32Array; // float
    public nextFreeOrSpawned: Int32Array; // int32
    public activeIdx: Int32Array; // int32
    public directions: Int8Array; // char

    private freelist = new Int32Array([FL.END, FL.END]);

    constructor(poolSize: number) {
        this.count = poolSize;
        const floatBytes = Float32Array.BYTES_PER_ELEMENT * poolSize;
        const vec3Bytes = 3 * floatBytes;
        const int32Bytes = Int32Array.BYTES_PER_ELEMENT * poolSize;
        const int8Bytes = Int8Array.BYTES_PER_ELEMENT * poolSize;
        this.data = new ArrayBuffer(
            vec3Bytes * 3 + // positions, colors, scales
            floatBytes + // speeds
            int32Bytes * 2 + // nextFreeOrSpawned, activeIdx
            int8Bytes // directions
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

        // initialize freelist
        for (let i = 0; i < poolSize - 1; i++)
            this.nextFreeOrSpawned[i] = i + 1;
        this.nextFreeOrSpawned[poolSize - 1] = FL.END;
        this.freelist[FL.HEAD] = 0;
        this.freelist[FL.TAIL] = POINT_COUNT - 1;
    }

    public spawn() {
        // pop from freelist, return if none available
        if (this.freelist[FL.HEAD] == FL.END)
            return FL.END;

        const idx = this.freelist[FL.HEAD];

        this.freelist[FL.HEAD] = this.nextFreeOrSpawned[idx];
        if (this.freelist[FL.HEAD] == FL.END)
            this.freelist[FL.TAIL] = FL.END;
        this.nextFreeOrSpawned[idx] = FL.SPAWNED;

        // got the next available point, initialize
        const lerpVal = PRNG.nextRange(0, 1);
        const oneMinusLerpVal = 1 - lerpVal;
        const [px, py, pz] = getVec3Idx(idx);
        this.colors[px] = (0xC7 / 255) * lerpVal + (0x61 / 255) * oneMinusLerpVal;
        this.colors[py] = (0x51 / 255) * lerpVal + (0x0C / 255) * oneMinusLerpVal;
        this.colors[pz] = (0x08 / 255) * lerpVal + (0xCF / 255) * oneMinusLerpVal;

        this.directions[idx] = 1 << (Math.trunc(Math.random() * Direction.LEN)) as DirVals;
        this.activeIdx[idx] = this.directions[idx] & (Direction.PX | Direction.NX) ? px
            : this.directions[idx] & (Direction.PY | Direction.NY) ? py : pz;

        const sign = this.directions[idx] & (Direction.PX | Direction.PY | Direction.PZ) ? 1 : -1;
        this.speeds[idx] = PRNG.nextRange(Spawn.SPEED.MIN, Spawn.SPEED.MAX) * sign;

        const pointRadius = PRNG.nextRange(Spawn.RADIUS.MIN, Spawn.RADIUS.MAX);

        this.scales[px] = pointRadius;
        this.scales[py] = pointRadius;
        this.scales[pz] = pointRadius;
        this.scales[this.activeIdx[idx]] = PRNG.nextRange(Spawn.LENGTH.MIN, Spawn.LENGTH.MAX);

        this.positions[px] = X_MIN_CUBE_CENTER + Math.trunc(CUBES_X * Math.random()) * Cube.INTERVAL;
        this.positions[py] = Y_MIN_CUBE_CENTER + Math.trunc(CUBES_Y * Math.random()) * Cube.INTERVAL;
        this.positions[pz] = Z_MIN_CUBE_CENTER + Math.trunc(CUBES_Z * Math.random()) * Cube.INTERVAL;
        this.positions[this.activeIdx[idx]] = this.getStartPos(idx);

        return idx;
    }

    public free(idx: number) {
        const [vx, vy, vz] = getVec3Idx(idx);
        this.positions[vx] = Number.MAX_VALUE; // prevent small chance of flickering upon ege of free/respawn
        this.positions[vy] = Number.MAX_VALUE;
        this.positions[vz] = Number.MAX_VALUE;
        this.nextFreeOrSpawned[idx] = FL.END;
        if (this.freelist[FL.TAIL] != FL.END)
            this.nextFreeOrSpawned[this.freelist[FL.TAIL]] = idx;
        else
            this.freelist[FL.HEAD] = idx;
        this.freelist[FL.TAIL] = idx;
    }

    public getBoundingBox(idx: number) {
        const [vx, vy, vz] = getVec3Idx(idx);
        return {
            min: {
                x: PointsArray.worldToIndex(this.positions[vx] - this.scales[vx], X_MIN_CUBE_CENTER, CUBES_X),
                y: PointsArray.worldToIndex(this.positions[vy] - this.scales[vy], Y_MIN_CUBE_CENTER, CUBES_Y),
                z: PointsArray.worldToIndex(this.positions[vz] - this.scales[vz], Z_MIN_CUBE_CENTER, CUBES_Z),
            },
            max: {
                x: PointsArray.worldToIndex(this.positions[vx] + this.scales[vx], X_MIN_CUBE_CENTER, CUBES_X),
                y: PointsArray.worldToIndex(this.positions[vy] + this.scales[vy], Y_MIN_CUBE_CENTER, CUBES_Y),
                z: PointsArray.worldToIndex(this.positions[vz] + this.scales[vz], Z_MIN_CUBE_CENTER, CUBES_Z),
            }
        };
    }

    public isOutOfBounds(idx: number) {
        const [vx, vy, vz] = getVec3Idx(idx);
        switch (this.directions[idx]) {
            case Direction.PX:
                return this.positions[vx] > (X_MAX + this.scales[vx]);
            case Direction.NX:
                return this.positions[vx] < (X_MIN - this.scales[vx]);
            case Direction.PY:
                return this.positions[vy] > (Y_MAX + this.scales[vy]);
            case Direction.NY:
                return this.positions[vy] < (Y_MIN - this.scales[vy]);
            case Direction.PZ:
                return this.positions[vz] > (Z_MAX + this.scales[vz]);
            case Direction.NZ:
                return this.positions[vz] < (Z_MIN - this.scales[vz]);
            default:
                throw new Error(`invalid direction in point idx ${idx}: ${this.directions[idx]}`)
        }
    }

    public isNotSpawned(idx: number) {
        return this.nextFreeOrSpawned[idx] != FL.SPAWNED;
    }

    private getStartPos(idx: number) {
        const offset = this.scales[this.activeIdx[idx]];
        switch (this.directions[idx]) {
            case Direction.PX: return X_MIN - offset;
            case Direction.NX: return X_MAX + offset;
            case Direction.PY: return Y_MIN - offset;
            case Direction.NY: return Y_MAX + offset;
            case Direction.PZ: return Z_MIN - offset;
            case Direction.NZ: return Z_MAX + offset;
            default: throw new Error(`invalid direction in point idx ${idx}: ${this.directions[idx]}`);
        }
    }

    private static worldToIndex(coord: number, basePos: number, maxIdx: number) {
        // NOTE: had a -1 offset until ceil was applied, no idea why math worked out like that
        // this is the only math that is still confusing me. maybe revisit in the future, but it works
        const ret = Math.ceil((coord - basePos) / Cube.INTERVAL);
        return ret > maxIdx ? maxIdx : ret < 0 ? 0 : ret;
    }
}