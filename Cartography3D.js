function Cartography3D(p5) {
  let basic_uv;
  p5.setup = () => {
    p5.createCanvas(500, 500, p5.WEBGL);
    basic_uv = p5.createShader(vert_3d, frag_globe);
  };
  
  p5.draw = () => {
    p5.background(128);
    p5.shader(basic_uv);
    basic_uv.setUniform('time', p5.frameCount);
    p5.rotateY(-p5.HALF_PI + 0.01 * p5.frameCount);
    p5.scale(1, -1, 1);
    p5.noStroke();
    p5.sphere(200, 100, 100);
  };
}
