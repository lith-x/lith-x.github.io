#version 300 es
in vec3 position;
in vec3 instanceCenter;
in vec3 instanceColor;
in float instanceSize;

uniform mat4 u_view;
uniform mat4 u_proj;

out vec3 v_color;

// TODO: test more math out in here using gl_InstanceID, see if that gets
// more performance.

void main() {
    vec3 scaledPos = position * instanceSize + instanceCenter;
    gl_Position = u_proj * u_view * vec4(scaledPos, 1.0);
    v_color = instanceColor;
}