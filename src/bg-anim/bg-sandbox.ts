import * as twgl from "twgl.js";

const canvas = document.getElementById("bg-canvas") as HTMLCanvasElement;
const gl = canvas.getContext("webgl2") as WebGL2RenderingContext;

// Compile shaders
const programInfo = twgl.createProgramInfo(gl, [
  await (await fetch("shader.vs")).text(),
  await (await fetch("shader.fs")).text(),
]);

// Create cube buffer
const cubeArrays = createWireCube();
const bufferInfo = twgl.createBufferInfoFromArrays(gl, cubeArrays);

// Instance data (example: 100 cubes)
const numInstances = 100;
const offsets = new Float32Array(numInstances * 3);
const scales = new Float32Array(numInstances);
const colors = new Float32Array(numInstances * 3);

for (let i = 0; i < numInstances; i++) {
  offsets.set([Math.random() * 10, Math.random() * 10, Math.random() * 10], i * 3);
  scales[i] = 0.5 + Math.random() * 0.5;
  colors.set([Math.random(), Math.random(), Math.random()], i * 3);
}

const instanceArrays = {
  iOffset: { numComponents: 3, data: offsets, divisor: 1 },
  iScale: { numComponents: 1, data: scales, divisor: 1 },
  iColor: { numComponents: 3, data: colors, divisor: 1 },
};

const vao = twgl.createVAOFromBufferInfo(gl, programInfo, bufferInfo, instanceArrays);

function createWireCube() {
  // Cube vertices (positions only, 36 verts for 12 triangles)
  const positions = [
    // Front
    -1, -1, 1, 1, -1, 1, 1, 1, 1,
    -1, -1, 1, 1, 1, 1, -1, 1, 1,
    // Back
    -1, -1, -1, -1, 1, -1, 1, 1, -1,
    -1, -1, -1, 1, 1, -1, 1, -1, -1,
    // Left
    -1, -1, -1, -1, -1, 1, -1, 1, 1,
    -1, -1, -1, -1, 1, 1, -1, 1, -1,
    // Right
    1, -1, -1, 1, 1, -1, 1, 1, 1,
    1, -1, -1, 1, 1, 1, 1, -1, 1,
    // Top
    -1, 1, -1, -1, 1, 1, 1, 1, 1,
    -1, 1, -1, 1, 1, 1, 1, 1, -1,
    // Bottom
    -1, -1, -1, 1, -1, -1, 1, -1, 1,
    -1, -1, -1, 1, -1, 1, -1, -1, 1,
  ];

  // Barycentric coords: each triangle gets (1,0,0), (0,1,0), (0,0,1)
  const barycentrics: number[] = [];
  for (let i = 0; i < positions.length / 9; i++) {
    barycentrics.push(
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    );
  }

  return {
    aPosition: { numComponents: 3, data: positions },
    aBarycentric: { numComponents: 3, data: barycentrics },
  };
}

function render(time: number) {
  gl.enable(gl.DEPTH_TEST);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const uniforms = {
    uProjection: twgl.m4.perspective(
      Math.PI / 4,
      gl.canvas.width / gl.canvas.height,
      0.1,
      100
    ),
    uView: twgl.m4.lookAt([20, 20, 20], [0, 0, 0], [0, 1, 0]),
    uModel: twgl.m4.identity(),
    uLineWidth: 1.5,
  };

  gl.useProgram(programInfo.program);
  twgl.setUniforms(programInfo, uniforms);
  twgl.setBuffersAndAttributes(gl, programInfo, { ...bufferInfo, ...instanceArrays });
  twgl.drawBufferInfo(gl, bufferInfo, gl.TRIANGLES, bufferInfo.numElements, 0, numInstances);

  requestAnimationFrame(render);
}

requestAnimationFrame(render);