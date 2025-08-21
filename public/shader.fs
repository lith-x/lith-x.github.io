#version 300 es
precision highp float;

in vec3 vBarycentric;
in vec3 vColor;

out vec4 fragColor;

// Controls how thick the wireframe edges are
uniform float uLineWidth; // e.g. 0.05

// Helper: find min distance to an edge
float edgeFactor() {
    vec3 d = fwidth(vBarycentric);
    vec3 a3 = smoothstep(vec3(0.0), d * uLineWidth, vBarycentric);
    return min(min(a3.x, a3.y), a3.z);
}

void main() {
    float edge = edgeFactor();

    // edge ~ 0 near edges, ~1 inside face
    if (edge < 0.5) {
        fragColor = vec4(vColor, 1.0); // draw edge
    } else {
        discard; // transparent background
    }
}