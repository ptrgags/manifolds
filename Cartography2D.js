function Cartography2D(p5) {
  let basic_uv;
  
  p5.setup = () => {
    p5.createCanvas(1000, 500, p5.WEBGL);
    basic_uv = p5.createShader(vert_2d, frag_atlas(gnomonic));
  };
  
  p5.draw = () => {
    p5.background(0);
    p5.shader(basic_uv);
    basic_uv.setUniform('time', p5.frameCount);
    p5.quad(-1, -1, 1, -1, 1, 1, -1, 1);
  };
}
