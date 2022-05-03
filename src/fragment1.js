export class Shader1{
    static vertexShader = `
    varying vec3 v_Normal;
    varying vec2 vertexUV;

    varying float noise;

    uniform float scale;
    uniform sampler2D globeTexture;

    void main() {
      vertexUV = uv;
      vec4 noiseTex = texture2D( globeTexture, vertexUV );
      vec3 grayscale = noiseTex.xyz;

      v_Normal = normalize(normalMatrix * normal);

      vec3 newPosition = position + v_Normal * grayscale * scale;

      // Transform the point with the 3D matrix
      //vec3 transformed = projectionMatrix * newPosition;

      gl_Position = projectionMatrix * modelViewMatrix * vec4( newPosition, 1.0 );
    }
  `;
  //uniform sampler2D globeTexture;
    static fragmentShader = `
      precision mediump float;

      uniform sampler2D globeTexture;
      
      uniform vec3 sphereColor;
      varying vec2 vertexUV;
      varying vec3 v_Normal;

      void main() {
        float intensity = 1.2 - dot(v_Normal, vec3(0.0, 0.0, 1.0));
        vec3 atmosphere = vec3(0.3, 0.6, 1.2) * pow(intensity, 1.5);
        gl_FragColor = vec4(atmosphere + texture2D(globeTexture, vertexUV).xyz, 1.0);
      }
  `;
}