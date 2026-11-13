// Frozen pre-optimization shader for GPU differential tests.
export const vertexShader = `varying vec3 localPosition;
void main() { localPosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`

export const fragmentShader = `
precision highp float;
varying vec3 localPosition;
uniform sampler2D radialTable, polarTable;
uniform vec2 firstCoefficient, secondCoefficient, orders;
uniform vec3 positiveReal, negativeReal, positiveImaginary, negativeImaginary;
uniform float radius, paired, quantity, brightness, realBasis;
vec2 multiply(vec2 a, vec2 b) { return vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x); }
vec2 azimuth(float m, float phi) {
  if (realBasis < 0.5) return vec2(cos(m*phi), sin(m*phi));
  return vec2(abs(m) < 0.5 ? 1.0 : 1.41421356237 * (m > 0.0 ? cos(m*phi) : sin(-m*phi)), 0.0);
}
vec2 waveAt(vec3 position) {
  float distance = length(position);
  if (distance > 2.4) return vec2(0.0);
  float u = distance > 0.00001 ? position.z / distance : 0.0;
  float phi = atan(position.y, position.x);
  vec2 radial = texture2D(radialTable, vec2(distance / 2.4 * (4095.0/4096.0) + 0.5/4096.0, 0.5)).rg;
  vec2 polar = texture2D(polarTable, vec2((u+1.0)*0.5 * (4095.0/4096.0) + 0.5/4096.0, 0.5)).rg;
  vec2 first = radial.x * polar.x * azimuth(orders.x, phi);
  vec2 second = paired * radial.y * polar.y * azimuth(orders.y, phi);
  return multiply(firstCoefficient, first) + multiply(secondCoefficient, second);
}
vec3 colorAt(vec2 psi) {
  if (quantity > 0.5 && quantity < 2.5) return positiveReal;
  if (quantity > 2.5 && quantity < 3.5) return psi.x < 0.0 ? negativeReal : positiveReal;
  if (quantity > 3.5) return psi.y < 0.0 ? negativeImaginary : positiveImaginary;
  return mix(psi.x < 0.0 ? negativeReal : positiveReal, psi.y < 0.0 ? negativeImaginary : positiveImaginary, abs(psi.y)/(abs(psi.x)+abs(psi.y)+1e-20));
}
void main() {
  vec3 direction = normalize(localPosition - cameraPosition);
  vec3 nearPlane = (-vec3(2.4) - cameraPosition) / direction;
  vec3 farPlane = (vec3(2.4) - cameraPosition) / direction;
  vec3 lower = min(nearPlane, farPlane), upper = max(nearPlane, farPlane);
  float start = max(0.0, max(max(lower.x, lower.y), lower.z));
  float finish = min(min(upper.x, upper.y), upper.z);
  if (finish <= start) discard;
  float steps = 112.0;
  float stepLength = (finish - start) / steps;
  vec4 accumulated = vec4(0.0);
  for (int i = 0; i < 112; i++) {
    if (float(i) >= steps) break;
    vec3 position = cameraPosition + direction * (start + (float(i) + 0.5) * stepLength);
    vec2 psi = waveAt(position);
    float distance = length(position);
    if (distance > 2.4) continue;
    float u = distance > 0.00001 ? position.z / distance : 0.0;
    float probability = dot(psi, psi) * radius * radius * radius;
    float weight = sqrt(probability);
    vec3 color = colorAt(psi);
    if (quantity > 0.5 && quantity < 2.5) weight = probability;
    if (quantity > 1.5 && quantity < 2.5) weight *= distance*distance/5.76 * sqrt(max(0.0, 1.0-u*u));
    if (quantity > 2.5 && quantity < 3.5) weight = abs(psi.x)*sqrt(radius*radius*radius);
    if (quantity > 3.5) weight = abs(psi.y)*sqrt(radius*radius*radius);
    float alpha = 1.0-exp(-weight * stepLength * brightness * 1.6);
    accumulated.rgb += (1.0-accumulated.a)*alpha*color;
    accumulated.a += (1.0-accumulated.a)*alpha;
    if (accumulated.a > 0.985) break;
  }
  if (accumulated.a < 0.002) discard;
  gl_FragColor = vec4(accumulated.rgb / accumulated.a, accumulated.a);
  #include <colorspace_fragment>
}`
