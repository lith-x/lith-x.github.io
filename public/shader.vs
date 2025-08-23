#version 300 es
precision highp float;

// Cube vertex position (object space)
in vec3 a_position;

// Barycentric coordinates for wireframe effect
in vec3 a_barycentric;

// Instance attributes
uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_model; // base model transform for cube
uniform vec3 u_cubeOffset; // per-instance offset (grid position)
uniform float u_cubeScale; // per-instance scale
uniform vec3 u_cubeColor;  // per-instance color

// Pass to fragment shader
out vec3 v_barycentric;
out vec3 v_color;

void main() {
    // Apply scale and offset
    vec3 pos = a_position * u_cubeScale + u_cubeOffset;

    gl_Position = u_projection * u_view * u_model * vec4(pos, 1.0);

    v_barycentric = a_barycentric;
    v_color = u_cubeColor;
}