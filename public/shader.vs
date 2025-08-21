#version 300 es
precision highp float;

// Cube vertex position (object space)
in vec3 aPosition;

// Barycentric coordinates for wireframe effect
in vec3 aBarycentric;

// Instance attributes
uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel; // base model transform for cube
uniform vec3 uCubeOffset; // per-instance offset (grid position)
uniform float uCubeScale; // per-instance scale
uniform vec3 uCubeColor;  // per-instance color

// Pass to fragment shader
out vec3 vBarycentric;
out vec3 vColor;

void main() {
    // Apply scale and offset
    vec3 pos = aPosition * uCubeScale + uCubeOffset;

    gl_Position = uProjection * uView * uModel * vec4(pos, 1.0);

    vBarycentric = aBarycentric;
    vColor = uCubeColor;
}