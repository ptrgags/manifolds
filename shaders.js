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
#define HALF_PI (PI / 2.0)
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

// Draw a red, green, and blue dot where the sphere meets the x, y, z axes.
vec4 xyz_dots(vec2 carto) {
  // <insert pun about sinking ships>
  float cap_size = 10.0;
  float z_cap = 1.0 - step(cap_size, abs(carto.y - 90.0));
  float y_cap = 1.0 - step(cap_size, length(carto - vec2(90.0, 0.0)));
  float x_cap = 1.0 - step(cap_size, length(carto - vec2(0.0, 0.0)));
  float alpha = max(z_cap, y_cap);
  alpha = max(alpha, x_cap);
  return vec4(x_cap, y_cap, z_cap, alpha);
}

float near(float x, float center, float threshold) {
  return 1.0 - step(threshold, abs(x - center));
}

float great_circles(vec2 carto) {
  float equator = near(carto.y, 0.0, 0.5);
  float meridian_thickness = 0.8;
  float prime_meridian = near(carto.x, 0.0, meridian_thickness);
  float lon_90 = near(carto.x, 90.0, meridian_thickness);
  float lon_neg90 = near(carto.x, -90.0, meridian_thickness);
  
  // Need both since this is on the boundary of the canvas.
  float lon_180 = near(carto.x, 180.0, meridian_thickness);
  float lon_neg180 = near(carto.x, -180.0, meridian_thickness);
  
  float result = max(equator, prime_meridian);
  result = max(result, lon_90);
  result = max(result, lon_neg90);
  result = max(result, lon_180);
  result = max(result, lon_neg180);
  return result;
}

vec4 pattern(vec2 carto) {
  float grid = great_circles(carto);
  float wave1 = sin(0.4 * length(carto) + 0.09 * time);
  
  float lon = mod(0.5 * time, 360.0) - 180.0;
  float lat = 45.0 * sin(0.01 * time);
  vec2 center = vec2(lon, lat);
  float wave2 = sin(0.5 * length_carto(carto - center) - 0.08 * time);
  
  vec4 base_color = vec4(0.5, 0.3, 0.0, 1.0);
  vec4 wave1_color = vec4(0.2, 0.0, 0.5, 1.0);
  vec4 wave2_color = vec4(0.0, 0.0, 0.0, 1.0);
  vec4 grid_color = vec4(1.0);
  vec4 dots_color = xyz_dots(carto);
  
  vec4 image = mix(base_color, wave1_color, wave1);
  image = mix(image, wave2_color, wave2);
  image = mix(image, dots_color, 0.8 * dots_color.a);
  image = mix(image, grid_color, grid);
  return image;
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

void main() {
  vec2 carto = uv2carto(uv);
  gl_FragColor = pattern(carto);
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
  vec3 plane_pos = mix(left, front, float(id > 0.0));
  plane_pos = mix(plane_pos, down, float(id > 1.0));
  plane_pos = mix(plane_pos, right, float(id > 3.0));
  plane_pos = mix(plane_pos, back, float(id > 4.0));
  plane_pos = mix(plane_pos, up, float(id > 5.0));
  
  float s_sqr = dot(plane_pos, plane_pos);
  float t = 1.0 / sqrt(1.0 + s_sqr);
  
  vec3 pos = plane_pos * t;
  vec3 center = vec3(0.0);
  pos = mix(pos, center, float(id > 2.0 && id < 4.0));
  pos = mix(pos, center, float(id > 6.0));
  
  return pos;
}
`;

const octahedral = `
vec3 layout_charts(vec2 uv) {
  vec2 scaled = uv * vec2(4.0, 2.0);
  vec2 chart_uv = fract(scaled);
  vec2 chart_id = floor(scaled);
  float id = 4.0 * chart_id.y + chart_id.x;
  return vec3(2.0 * chart_uv - 1.0, id);
}

mat3 rotate_z(float theta) {
  float ct = cos(theta);
  float st = sin(theta);
  return mat3(
    ct, st, 0,
    -st, ct, 0,
    0, 0, 1
  );
}

vec3 select_a(vec3 local_coords) {
  float id = local_coords.z;
  float column = mod(id, 4.0);
  float theta_top_row = column * HALF_PI;
  float theta_bottom_row = column * HALF_PI + HALF_PI;
  float theta = mix(theta_bottom_row, theta_top_row, float(id >= 4.0));
  
  return rotate_z(theta) * vec3(1.0, 0.0, 0.0);
}

vec3 select_b(vec3 local_coords) {
  float id = local_coords.z;
  float column = mod(id, 4.0);
  float theta_top_row = column * HALF_PI;
  float theta_bottom_row = column * HALF_PI - HALF_PI;
  float theta = mix(theta_bottom_row, theta_top_row, float(id >= 4.0));
  
  return rotate_z(theta) * vec3(0.0, 1.0, 0.0);
}

vec3 select_c(vec3 local_coords) {
  float id = local_coords.z;
  float sign = mix(-1.0, 1.0, float(id >= 4.0));
  
  return sign * vec3(0.0, 0.0, 1.0);
}

vec3 inv_projection(vec3 local_coords) {
  // Triangle that makes up a face of the octahedron
  vec3 a = select_a(local_coords);
  vec3 b = select_b(local_coords);
  vec3 c = select_c(local_coords);
  
  // Parameterize the plane of this triangle
  // so the origin is at the centroid of the triangle.
  vec3 origin = (a + b + c) / 3.0;
  vec3 normal = normalize(origin);
  
  // We also need a basis for the plane.
  // Note that the bottom row is rotated 180 degrees
  // for a nicer layout
  float id = local_coords.z;
  float sign = mix(-1.0, 1.0, float(id >= 4.0)); 
  vec3 right = sign * normalize(b - a);
  vec3 up = sign * normalize(c - origin);
  
  vec3 plane_world = origin + local_coords.x * right + local_coords.y * up;
  float t = 1.0 / length(plane_world);
  
  vec3 sphere_pos = t * plane_world;
  return sphere_pos;
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
  gl_FragColor = pattern(carto);
}
`;
