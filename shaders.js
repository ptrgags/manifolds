const vert_2d = `
attribute vec3 aPosition;
attribute vec2 aTexCoord;

varying vec2 uv;

void main() {
  vec4 position = vec4(aPosition, 1.0);
  gl_Position = position;
  uv = aTexCoord;
}
`;

const vert_3d = `
attribute vec3 aPosition;
attribute vec2 aTexCoord;
uniform mat4 uProjectionMatrix;
uniform mat4 uModelViewMatrix;

varying vec2 uv;

void main() {
  vec4 position = vec4(aPosition, 1.0);
  gl_Position = uProjectionMatrix * uModelViewMatrix * position;
  uv = aTexCoord;
}
`;

// Fragment shaders ==================================================



const preamble = `
#define PI 3.141592
precision highp float;

uniform float time;

varying vec2 uv;
`;

const pattern = `

// Length but fix the branch cut
float length_carto(vec2 carto) {
  float x = mod(carto.x, 360.0) - 180.0;
  return length(vec2(x, carto.y));
}

vec3 pattern(vec2 carto) {
  float equator = 1.0 - step(0.5, abs(carto.y));
  float prime_meridian = 1.0 - step(0.8, abs(carto.x)); 
  float x = step(0.9, sin(carto.x));
  float y = step(0.9, cos(carto.y));
  float grid = max(equator, prime_meridian);
  float wave1 = sin(0.4 * length(carto) + 0.09 * time);
  
  float lon = mod(0.5 * time, 360.0) - 180.0;
  float lat = 30.0 * sin(0.01 * time);
  vec2 center = vec2(lon, lat);
  float wave2 = sin(0.5 * length_carto(carto - center) - 0.08 * time);
  
  float wave = max(wave1, wave2);
  vec3 wave_color = vec3(0.5, wave2, wave1);
  
  vec3 grid_color = mix(vec3(1.0, 0.5, 0.0), wave_color, wave);
  grid_color = mix(grid_color, vec3(0.0, 0.8, 0.8), grid);
  return 0.8 * grid_color;
}
`;

const frag_globe = `
${preamble}

${pattern}

vec2 uv2carto(vec2 uv) {
  float lon = 360.0 * uv.x - 180.0;
  float lat = 180.0 * uv.y - 90.0;
  return vec2(lon, lat);
}

/*
vec2 crosshairs(vec2 carto, vec2 center) {
  vec2 dist = abs(carto - center);
  vec2 max_dist = vec2(1.0, 1.0);
  vec2 min_dist = vec2(0.99, 0.99);
  return smoothstep(max_dist, min_dist, dist).yx;
}
*/

void main() {
  vec2 carto = uv2carto(uv);
  vec3 c = pattern(carto); 
  //vec2 crosshairs = crosshairs(carto, vec2(0.0, 0.0));
  //float null_island = max(crosshairs.x, crosshairs.y);
  gl_FragColor = vec4(c, 1.0);
}
`;

const stereographic = `
// Two charts: the left half of the canvas is for the southern
// hemisphere, and the right half of the canvas is for the northern
// hemisphere.
vec3 layout_charts(vec2 uv) {
  float x_uv = fract(uv.x * 2.0);
  vec2 half_uv = vec2(x_uv, uv.y);
  float chart_id = float(uv.x >= 0.5);
  return vec3(2.0 * half_uv - 1.0, chart_id);
}

// Stereographic projection projects from a point on the sphere
// to a plane tangent to the opposite point on the sphere.
//
// For the southern hemisphere, the projection is from the plane
// z = -1 to the north pole (0, 0, 1). We are viewing the plane
// from the _bottom_, so the basis is (+x, -y)
//
// For the northern hemisphere, the projection is from the plane
// z = 1 to the south pole (0, 0, -1). We are viewing the plane
// from the _top_ so the basis is (+x, +y);
// 
// Due to symmetry, the main difference between the projections
// is the mirrored z coordinate and the different choice of basis.
vec3 inv_projection(vec3 local_coords) {
  float s_sqr = dot(local_coords.xy, local_coords.xy);
  float denominator = 1.0 + s_sqr;
  vec3 numerator = vec3(2.0 * local_coords.xy, s_sqr - 1.0);
  vec3 result = numerator / denominator;
  
  vec3 basis = mix(
    // Southern hemisphere: (+x, -y), don't flip z 
    vec3(1.0, -1.0, 1.0), 
    // Northern hemisphere: (+x, +y), flip z to reach northern hemisphere
    vec3(1.0, 1.0, -1.0),
    // 0 = south, 1 = north
    local_coords.z);
  
  return result * basis;
}
`;

const gnomonic = `
vec3 layout_charts(vec2 uv) {
  vec2 scaled = uv * vec2(4.0, 2.0);
  vec2 chart_uv = fract(scaled);
  vec2 chart_id = floor(scaled);
  float id = 4.0 * chart_id.y + chart_id.x;
  return vec3(2.0 * chart_uv - 1.0, id);
}

vec3 inv_projection(vec3 local_coords) {
  vec3 right = vec3(1.0, local_coords.x, local_coords.y);
  vec3 left = vec3(-1.0, -local_coords.x, local_coords.y);
  vec3 front = vec3(local_coords.x, -1.0, local_coords.y);
  vec3 back = vec3(-local_coords.x, 1.0, local_coords.y);
  vec3 up = vec3(local_coords.x, local_coords.y, 1.0);
  vec3 down = vec3(-local_coords.x, local_coords.y, -1.0);
  
  float id = local_coords.z;
  vec3 plane_pos = mix(right, up, float(id > 0.0));
  plane_pos = mix(plane_pos, front, float(id > 1.0));
  plane_pos = mix(plane_pos, left, float(id > 3.0));
  plane_pos = mix(plane_pos, down, float(id > 4.0));
  plane_pos = mix(plane_pos, back, float(id > 5.0));
  
  float s_sqr = dot(plane_pos, plane_pos);
  float t = 1.0 / sqrt(1.0 + s_sqr);
  
  vec3 pos = plane_pos * t;
  vec3 center = vec3(0.0);
  pos = mix(pos, center, float(id > 2.0 && id < 4.0));
  pos = mix(pos, center, float(id > 6.0));
  
  return pos;
}
`;

const frag_atlas = (projection) => `
${preamble}

${projection}
${pattern}

float rad2deg(float rad) {
  return rad * 180.0 / PI;
}

vec2 cartesian2carto(vec3 cartesian) {
  float longitude = atan(cartesian.y, cartesian.x);
  float s = length(cartesian.xy);
  float latitude = atan(cartesian.z, s);
  vec2 carto_radians = vec2(longitude, latitude);
  return vec2(rad2deg(carto_radians.x), rad2deg(carto_radians.y));
}

void main() {
  vec3 local_coords = layout_charts(uv);
  vec3 cartesian = inv_projection(local_coords);
  vec2 carto = cartesian2carto(cartesian);
  vec3 c = pattern(carto);
  //vec2 crosshairs = crosshairs(carto, vec2(0.0, 0.0));
  //float null_island = max(crosshairs.x, crosshairs.y);
  gl_FragColor = vec4(c, 1.0);
}
`;
