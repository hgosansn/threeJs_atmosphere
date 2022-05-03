
export class GlowShader{

  // GLSL JS export

  static params = {
    intensity: "glowFactor"
  }

  static vertexShader = `
    varying vec3 v_Normal;
    varying vec2 vertexUV;
    void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0 );
      vertexUV = uv;
      v_Normal = normalize(normalMatrix * normal);
    }
  `;
  static fragmentShader = `
    precision mediump float;
    uniform float glowFactor;

    varying vec2 vertexUV;
    varying vec3 v_Normal;

    void main() {
      float intensity = glowFactor - dot(v_Normal, vec3(0.0, 0.0, 1.0));
      vec4 atmosphere = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
      gl_FragColor = atmosphere;
    }
  `;
}