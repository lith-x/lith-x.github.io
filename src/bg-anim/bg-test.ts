import * as twgl from "twgl.js";

const CUBE_SIZE = 1;
const CUBE_PADDING = 0.1;

const vShader = `#version 300 es
in vec3 position;
in vec3 instanceCenter;
in vec3 instanceColor;
in float instanceSize;

uniform mat4 u_view;
uniform mat4 u_proj;

out vec4 v_color;

void main() {
    gl_Position = u_proj * u_view * vec4(instanceSize * position + instanceCenter, 1.0);
    v_color = vec4(instanceColor, 1.0);
}`;

const fShader = `#version 300 es
precision highp float;

in vec4 v_color;

out vec4 outColor;

void main() {
    outColor = v_color;
}`;

export const main = () => {
    const gl = (document.getElementById("bg-canvas") as HTMLCanvasElement).getContext("webgl2");
    if (!gl) return;

    const progInfo = twgl.createProgramInfo(gl, [vShader, fShader]);

    const INSTANCE_COUNT = 5;
    const instanceCenters = new Float32Array(INSTANCE_COUNT * 3);
    for (let i = 0; i < INSTANCE_COUNT; i++) {
        instanceCenters.set([-0.5 + i / INSTANCE_COUNT, 0.4, 0], i * 3);
    }
    const instanceColors = new Float32Array(INSTANCE_COUNT * 4);
    for (let i = 0; i < INSTANCE_COUNT; i++) {
        // 134, 25, 181
        instanceColors.set([134/255, 25/255, 181/255, 1], i * 4);
    }
    const instanceSizes = new Float32Array(INSTANCE_COUNT);
    instanceSizes.fill(1);
    const rectArrays = {
        position: {
            numComponents: 3,
            data: [-0.1, -0.1, 0.1, //0
                0.1, -0.1, 0.1, //1
            -0.1, 0.1, 0.1, //2
                0.1, 0.1, 0.1, //3
            -0.1, -0.1, -0.1, //4
                0.1, -0.1, -0.1, //5
            -0.1, 0.1, -0.1, //6
                0.1, 0.1, -0.1] //7
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
            data: instanceCenters
        },
        instanceColor: {
            divisor: 1,
            numComponents: 4,
            data: instanceColors
        },
        instanceSize: {
            divisor: 1,
            numComponents: 1,
            data: instanceSizes
        },

    } as twgl.Arrays;
    const rectBuff = twgl.createBufferInfoFromArrays(gl, rectArrays);
    const vao = twgl.createVAOFromBufferInfo(gl, progInfo, rectBuff);
    const viewMat = twgl.m4.inverse(twgl.m4.lookAt([0, 0, 2], [0, 0, 0], [0, 1, 0]));
    const projMat = twgl.m4.perspective(Math.PI / 2.5, /*gl.drawingBufferWidth / gl.drawingBufferHeight*/1, 0.1, 100);
    gl.useProgram(progInfo.program);
    gl.bindVertexArray(vao);
    twgl.setUniforms(progInfo, { u_view: viewMat, u_proj: projMat });

    const render = (time: number) => {
        twgl.resizeCanvasToDisplaySize(gl.canvas as HTMLCanvasElement);
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        // gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        for (let i = 0; i < instanceSizes.length; i++) {
            instanceSizes[i] = 3 + Math.sin(time / 1000) + i;
        }
        twgl.setAttribInfoBufferFromArray(gl, rectBuff.attribs!.instanceCenter, instanceCenters);
        twgl.setAttribInfoBufferFromArray(gl, rectBuff.attribs!.instanceSize, instanceSizes);
        twgl.setAttribInfoBufferFromArray(gl, rectBuff.attribs!.instanceColor, instanceColors);
        twgl.drawBufferInfo(gl, rectBuff, gl.LINES, undefined, undefined, INSTANCE_COUNT);
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