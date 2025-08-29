#version 300 es
in vec3 position;
in vec3 instanceCenter;
in vec3 instanceColor;
in float instanceSize;

uniform mat4 u_view;
uniform mat4 u_proj;

out vec4 v_color;

void main() {
    gl_Position = u_proj * u_view * vec4(instanceSize * position + instanceCenter, 1.0);
    v_color = vec4(instanceColor, smoothstep(0.0, 0.05, instanceSize));
}