import * as twgl from "twgl.js";

const vertShaderSrc = `#version 300 es
in vec3 position;
in vec3 instanceCenter;
in vec3 instanceColor;
in float instanceSize;

uniform mat4 u_view;
uniform mat4 u_proj;

out vec3 v_color;

void main() {
    vec3 scaledPos = position * instanceSize + instanceCenter;
    gl_Position = u_proj * u_view * vec4(scaledPos, 1.0);
    v_color = instanceColor;
}`;

const fragShaderSrc = `#version 300 es
precision highp float;

in vec3 v_color;
out vec4 outColor;

void main() {
    outColor = vec4(v_color, 1.0);
}`;

export const main = () => {
  const gl = (document.getElementById("bg-canvas") as HTMLCanvasElement)
    .getContext("webgl2");
  if (!gl) return;

  // --- Setup program ---
  const progInfo = twgl.createProgramInfo(gl, [vertShaderSrc, fragShaderSrc]);

  // --- Cube geometry (triangles, not lines) ---
  const cubeBufferInfo = twgl.createBufferInfoFromArrays(gl, {
    position: {
      numComponents: 3,
      data: [
        // front
        -0.5, -0.5, 0.5,
        0.5, -0.5, 0.5,
        0.5, 0.5, 0.5,
        -0.5, 0.5, 0.5,
        // back
        -0.5, -0.5, -0.5,
        0.5, -0.5, -0.5,
        0.5, 0.5, -0.5,
        -0.5, 0.5, -0.5,
      ],
    },
    indices: [
      // front
      0, 1, 2, 0, 2, 3,
      // back
      4, 6, 5, 4, 7, 6,
      // left
      4, 0, 3, 4, 3, 7,
      // right
      1, 5, 6, 1, 6, 2,
      // top
      3, 2, 6, 3, 6, 7,
      // bottom
      4, 5, 1, 4, 1, 0,
    ],
    instanceCenter: {
      numComponents: 3,
      data: new Float32Array([0, 0, 0]), // one cube at origin
      divisor: 1,
    },
    instanceColor: {
      numComponents: 3,
      data: new Float32Array([1, 0, 0]), // red
      divisor: 1,
    },
    instanceSize: {
      numComponents: 1,
      data: new Float32Array([1]), // size 1
      divisor: 1,
    },
  });

  const vao = twgl.createVAOAndSetAttributes(
    gl,
    progInfo.attribSetters,
    cubeBufferInfo.attribs!,
    cubeBufferInfo.indices
  );

  // --- GL setup ---
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.1, 0.1, 0.1, 1.0);

  const render = () => {
    twgl.resizeCanvasToDisplaySize(gl.canvas as HTMLCanvasElement);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(progInfo.program);
    gl.bindVertexArray(vao);

    twgl.setUniforms(progInfo, {
      u_view: twgl.m4.lookAt([3, 3, 3], [0, 0, 0], [0, 1, 0]),
      u_proj: twgl.m4.perspective(
        Math.PI / 4,
        gl.canvas.width / gl.canvas.height,
        0.1,
        100
      ),
    });

    // draw 1 instance
    twgl.drawBufferInfo(gl, cubeBufferInfo, gl.TRIANGLES, cubeBufferInfo.numElements, 0, 1);

    gl.bindVertexArray(null);

    requestAnimationFrame(render);
  };

  requestAnimationFrame(render);
};


/*
OpenGL order of operations:

Passing data:
- create vertex buffer / vertex array
- bind vertex array (wrap in bind [vao-pointer] and bind [next/null])
  - inside wrap:
  - see "bind buffers" for any buffers you want to belong to vao
- bind buffers (wrap in bind [buffer type|location] | [vertbuff-pointer], and [same type|location] | [next/null])
  - inside wrap:
  - define attribute data here via vertex[1/2/3/4(v|f) | AttribPointer]
  - set the data
  - enable vertex attribute via enableVertexAttribArray(loc)

Render:
- define viewport
- clear certain buffers like color/depth
- specify shader program via useProgram
- bind either buffer or vao
- draw arrays/instances/etc. to draw bound buffer/object
- bind next one/repeat/or just bind null to clean up
*/