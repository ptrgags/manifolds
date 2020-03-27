function Cartography2D(p5) {
  let basic_uv;
  let projections = [
    stereographic,
    gnomonic,
    octahedral
  ];
  let projection_index = 0;
  
  function set_projection() {
    const projection = projections[projection_index];
    basic_uv = p5.createShader(vert_2d, frag_atlas(projection));
  }
  
  p5.setup = () => {
    p5.createCanvas(1000, 500, p5.WEBGL);
    set_projection();
  };
  
  p5.draw = () => {
    p5.background(0);
    p5.shader(basic_uv);
    basic_uv.setUniform('time', p5.frameCount);
    p5.quad(-1, -1, 1, -1, 1, 1, -1, 1);
  };
  
  p5.mouseClicked = () => {
    projection_index += 1;
    projection_index %= projections.length;
    set_projection();
  };
}
