// Deterministic cinematic renderer. One WebGL context per document, shared by
// every card and scene. Instanced particles, analytic trails, HDR bloom and
// tone mapping. No simulation steps: seeking to any frame produces the same art.
const FULLSCREEN = `#version 300 es
precision highp float;
out vec2 uv;
void main(){
  vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);
  uv=p; gl_Position=vec4(p*2.-1.,0.,1.);
}`;
const COMMON = `
precision highp float;
uniform vec2 resolution;
uniform float time, mode, strength, impactAt, charge;
uniform vec3 tint;
const float PI=3.14159265359;
float hash(float n){return fract(sin(n*127.1+311.7)*43758.5453);}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  float n=i.x+i.y*57.;
  return mix(mix(hash(n),hash(n+1.),f.x),mix(hash(n+57.),hash(n+58.),f.x),f.y);
}
float fbm(vec2 p){
  return .57*noise(p)+.28*noise(p*2.03+8.7)+.15*noise(p*4.11-5.1);
}
mat2 rot(float a){return mat2(cos(a),-sin(a),sin(a),cos(a));}
vec3 thermal(float a){return mix(tint,vec3(1.,.94,.8),clamp(a,0.,1.)*.7);}
`;
const ATMOSPHERE = `#version 300 es
${COMMON}
in vec2 uv; out vec4 frag;
void main(){
  vec2 p=(uv-.5)*resolution/min(resolution.x,resolution.y);
  float age=max(0.,time-impactAt), hit=step(impactAt,time)*exp(-age*3.8);
  float r=length(p),a=atan(p.y,p.x);
  vec3 color=vec3(0.);
  if(mode==0.) {
    float cloud=fbm(p*3.+vec2(time*.025,-time*.03));
    color=tint*pow(cloud,3.)*.06*exp(-r*r*.6);
  } else if(mode==4.) {
    float spiral=sin(a*5.+r*24.-time*(.7+charge*2.));
    float disk=exp(-pow((r-(.28-charge*.12))*12.,2.));
    float flow=pow(max(0.,spiral),18.)*disk;
    float core=exp(-r*r*(95.-charge*50.));
    color=thermal(.65)*(flow*.22+core*(.08+charge*.3));
    color+=tint*exp(-abs(r-(.38-charge*.12))*180.)*(.1+charge*.3);
    color+=tint*pow(fbm(p*7.+vec2(time*.04,-time*.09)),5.)*.16*exp(-r*r*2.);
  } else if(mode==1.) {
    // Bounds match the native illustration. Names, costs and rules stay intact.
    vec2 q=uv;
    if(q.x<.08||q.x>.93||q.y<.43||q.y>.88) discard;
    float edge=smoothstep(.08,.15,q.x)*(1.-smoothstep(.86,.93,q.x))
      *smoothstep(.43,.48,q.y)*(1.-smoothstep(.83,.88,q.y));
    vec2 z=(q-vec2(.52,.68))*vec2(2.,3.);
    float turbulent=fbm(z*5.+vec2(time*.3,-time*.6));
    float stream=abs(z.y+.16*sin(z.x*7.-time*2.+turbulent*4.));
    color=thermal(turbulent)*exp(-stream*32.)*(.08+turbulent*.23)*edge;
    color+=tint*pow(turbulent,4.)*.12*edge;
    if(tint.r>.8&&tint.g<.4){
      float rad=length(z*vec2(1.,.8)),ang=atan(z.y,z.x);
      float flame=fbm(vec2(ang*3.,rad*12.-time*1.4));
      float rim=exp(-abs(rad-(.37+flame*.08))*55.);
      color+=thermal(flame)*rim*(.3+flame*.6)*edge;
    }else{
      float bolt=abs(z.y+.11+sin(z.x*13.-time*2.)*.035+sin(z.x*35.+time*4.)*.012);
      color+=thermal(.7)*exp(-bolt*180.)*edge*.45;
    }
  } else {
    // Turbulent corona, wispy gas, lens diffraction, outward shock fronts.
    vec2 warp=p+vec2(fbm(p*5.+time*.13),fbm(p*5.-time*.12))*.065;
    float rr=length(warp*vec2(1.,1.13));
    float turbulence=fbm(vec2(a*2.,rr*20.-time*.55));
    float corona=exp(-abs(rr-.32)*38.)*pow(turbulence,.8);
    color=tint*corona*.26;
    float cloud=fbm(p*7.+vec2(time*.12,-time*.08));
    color+=tint*pow(cloud,3.)*exp(-abs(r-.32)*7.)*.20;
    for(int j=0;j<3;j++){
      float d=age-float(j)*.11;
      float radius=.12+.6*(1.-exp(-max(d,0.)*1.7));
      float dist=abs(length(p*rot(float(j)*.35)*vec2(1.,1.55))-radius);
      color+=thermal(.5)*exp(-dist*260.)*exp(-max(d,0.)*2.3)*step(0.,d)*.72;
    }
    // Anamorphic flare is brief and shaped, never a full white-screen flash.
    color+=thermal(.65)*exp(-abs(p.y)*230.)*exp(-abs(p.x)*4.)*hit*1.2;
    color+=tint*exp(-r*r*90.)*hit*.7;
    if(mode==3.){
      // A shaded, engraved metal token with an eccentric moving key light.
      float disc=1.-smoothstep(.222,.225,r);
      float bevel=exp(-abs(r-.222)*530.)+exp(-abs(r-.206)*700.)*.4;
      float grooves=exp(-abs(r-.19)*800.)*.22;
      float teeth=pow(max(0.,cos(a*84.)),16.)*smoothstep(.207,.209,r)
        *(1.-smoothstep(.216,.219,r));
      float spec=pow(max(0.,cos(a+time*.14-2.2)),7.);
      float brushed=.5+.5*sin(r*1700.+noise(p*160.)*3.);
      color*=1.-disc*.88;
      color+=tint*(.022+brushed*.008)*disc;
      color+=thermal(.6)*(bevel*(.15+spec*1.3)+grooves+teeth*.2);
      // Fine internal guilloche rings leave room for legible quantity text.
      float ring=exp(-abs(r-(.175+.003*sin(a*24.+time*.2)))*700.);
      color+=tint*ring*.12;
    }
  }
  frag=vec4(color*strength,1.);
}`;
const PARTICLE_VERTEX = `#version 300 es
${COMMON}
out vec2 coord;
out vec3 color;
out float opacity, shape;
vec3 position(float id,float t){
  float a=hash(id)*PI*2.,b=hash(id+92.),c=hash(id+189.),d=hash(id+311.);
  if(mode==0.){
    return vec3((b-.5)*2.6+sin(t*.12+a)*.035,fract(c+t*(.012+d*.018))*2.-1.,d);
  }
  if(mode==1.){
    float life=fract(t*(.12+c*.13)+b);
    return vec3((b-.5)*.78+sin(life*5.+a)*.04,.04+life*.65,d);
  }
  if(mode==4.){
    float life=fract(t*(.07+c*.09)+b);
    float radius=mix(.68,.08,pow(life,.7))*(1.-charge*.48);
    float theta=a+t*(.2+charge*.8)+life*8.;
    return vec3(cos(theta)*radius,sin(theta)*radius*.64,sin(theta+c*4.)*.24);
  }
  if(mod(id,4.)<1.){
    float age=max(0.,t-impactAt-b*.12),dist=(.08+c*.83)*(1.-exp(-age*(1.4+d)));
    float theta=a+sin(age*1.5+b*8.)*.16;
    return vec3(cos(theta)*dist,sin(theta)*dist*.72-age*age*.035,(d-.5)*.55);
  }
  // Analytic curl-like field, orbit and camera depth. Trails sample this same
  // trajectory at earlier times, so motion blur follows the actual direction.
  float t2=t*(.18+c*.27)+a;
  float radius=.25+b*.18+sin(t*.7+a)*.015;
  vec3 p=vec3(cos(t2)*radius,sin(t2)*radius*.67,sin(t2+.9)*.35);
  p.xy=rot((c-.5)*1.8)*p.xy;
  p.xy+=vec2(sin(t*1.2+b*18.),cos(t*.8+c*15.))*.012;
  return p;
}
void main(){
  float id=float(gl_InstanceID),d=hash(id+311.);
  vec2 corners[6]=vec2[6](vec2(-1.,-1.),vec2(1.,-1.),vec2(-1.,1.),vec2(-1.,1.),vec2(1.,-1.),vec2(1.,1.));
  coord=corners[gl_VertexID];
  vec3 p=position(id,time),prev=position(id,max(0.,time-.025-d*.055));
  float persp=1./(1.+p.z*.65);
  p.xy*=persp; prev.xy/=1.+prev.z*.65;
  vec2 velocity=p.xy-prev.xy;
  vec2 dir=length(velocity)>.00001?normalize(velocity):vec2(1.,0.);
  float dof=abs(p.z-.05),size=(.00065+d*.0012)*(mode==0.?1.2:1.);
  shape=mod(id,29.)<1.?1.:0.;
  if(shape==1.)size*=6.+d*4.;
  float len=max(size,length(velocity)*.7);
  // A wrapped particle is born at the outside of the vortex. Do not draw a
  // false trail across the whole scene between its previous and new lifetime.
  if(mode==4.)len=min(len,.018);
  vec2 pos=p.xy+dir*coord.x*len+vec2(-dir.y,dir.x)*coord.y*size*(1.+dof*2.);
  pos*=min(resolution.x,resolution.y)/resolution;
  gl_Position=vec4(pos*2.,0.,1.);
  float age=max(0.,time-impactAt);
  opacity=(.16+hash(id+89.)*.55)*strength;
  if(mode>1.&&mode<4.&&mod(id,4.)<1.) opacity*=step(impactAt,time)*pow(max(0.,1.-age/3.2),1.4);
  if(mode==0.) opacity*=.55;
  if(mode==4.)opacity*=pow(sin(fract(time*(.07+hash(id+189.)*.09)+hash(id+92.))*PI),.6)*(.65+charge*.5);
  if(mode==1.) opacity*=sin(fract(time*(.12+hash(id+189.)*.13)+hash(id+92.))*PI);
  color=thermal(hash(id+19.))*(shape==1.?.32:1.6);
}`;
const PARTICLE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 coord; in vec3 color; in float opacity,shape;
out vec4 frag;
void main(){
  float r=length(coord);
  float alpha=shape>.5?exp(-r*r*3.)*.2:exp(-coord.y*coord.y*8.)*pow(max(0.,1.-abs(coord.x)),.35);
  if(r>1.42)discard;
  frag=vec4(color*alpha*opacity,0.);
}`;
const RIBBON_VERTEX = `#version 300 es
${COMMON}
out float edge,fade;
void main(){
  float id=float(gl_InstanceID),seg=float(gl_VertexID/2)/127.;
  float side=float(gl_VertexID%2)*2.-1.;
  float a=time*(.4+id*.037)+id*1.71-seg*2.8;
  float radius=.28+id*.012;
  if(mode==4.)radius*=1.-charge*.45;
  float turbulent=sin(a*6.+time*1.5+id)*.006+sin(a*13.-time)*.0025;
  vec2 pos=vec2(cos(a),sin(a)*.54)*(radius+turbulent);
  pos=rot((id-3.5)*.22)*pos;
  vec2 normal=normalize(rot((id-3.5)*.22)*vec2(cos(a),sin(a)/.54));
  pos+=normal*side*.0018;
  if(mode==1.){
    pos=vec2(seg*.84-.42,.19+sin(seg*10.-time*2.+id)*.022+id*.012);
    pos.y+=side*.001;
  }
  gl_Position=vec4(pos*2.*min(resolution.x,resolution.y)/resolution,0.,1.);
  edge=side;fade=pow(1.-seg,.7)*strength;
}`;
const RIBBON_FRAGMENT = `#version 300 es
precision highp float;
uniform vec3 tint;
in float edge,fade; out vec4 frag;
void main(){frag=vec4(mix(tint,vec3(1.),.3)*exp(-edge*edge*3.)*fade*.9,0.);}
`;
const BLUR = `#version 300 es
precision highp float;
uniform sampler2D source;
uniform vec2 direction;
uniform float threshold;
in vec2 uv;out vec4 frag;
vec3 tap(vec2 p){
  vec3 c=texture(source,p).rgb;
  return c*max(0.,max(c.r,max(c.g,c.b))-threshold)/(max(c.r,max(c.g,c.b))+.0001);
}
void main(){
  vec3 c=tap(uv)*.227027;
  c+=(tap(uv+direction*1.384615)+tap(uv-direction*1.384615))*.316216;
  c+=(tap(uv+direction*3.230769)+tap(uv-direction*3.230769))*.070270;
  frag=vec4(c,1.);
}`;
const COMPOSITE = `#version 300 es
precision highp float;
uniform sampler2D scene,bloom1,bloom2,bloom3;
uniform float mode;
in vec2 uv;out vec4 frag;
void main(){
  vec3 c=texture(scene,uv).rgb+texture(bloom1,uv).rgb*.65+texture(bloom2,uv).rgb*.75+texture(bloom3,uv).rgb*.8;
  c=1.-exp(-c*1.4); // Exponential highlight roll-off retains hue and detail.
  float alpha=clamp(max(c.r,max(c.g,c.b))*1.6,0.,.95);
  if(mode==1.){
    float mask=smoothstep(.08,.12,uv.x)*(1.-smoothstep(.89,.93,uv.x))
      *smoothstep(.43,.47,uv.y)*(1.-smoothstep(.84,.88,uv.y));
    c*=mask;alpha*=mask;
  }
  frag=vec4(c,alpha); // Premultiplied emission over the underlying scene/card.
}`;
const engines = new WeakMap();
const palettes = {
  fire: [1, 0.25, 0.055],
  plasma: [0.15, 1, 0.65],
  arcane: [0.57, 0.24, 1],
  gold: [1, 0.56, 0.13],
  blue: [0.15, 0.4, 1],
  pink: [1, 0.13, 0.53],
};
class Engine {
  constructor(doc) {
    this.canvas = doc.createElement("canvas");
    const gl = (this.gl = this.canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    }));
    if (!gl) throw Error("WebGL2 unavailable");
    this.float = !!gl.getExtension("EXT_color_buffer_float");
    this.canvas.dataset.renderer = this.float ? "webgl2-hdr" : "webgl2";
    gl.getExtension("OES_texture_float_linear");
    this.programs = {
      atmosphere: this.program(FULLSCREEN, ATMOSPHERE),
      particles: this.program(PARTICLE_VERTEX, PARTICLE_FRAGMENT),
      ribbons: this.program(RIBBON_VERTEX, RIBBON_FRAGMENT),
      blur: this.program(FULLSCREEN, BLUR),
      composite: this.program(FULLSCREEN, COMPOSITE),
    };
    this.targets = [];
    this.width = 0;
    this.height = 0;
    this.canvas.addEventListener("webglcontextlost", (e) => e.preventDefault());
    this.canvas.addEventListener("webglcontextrestored", () =>
      engines.delete(doc),
    );
  }
  program(v, f) {
    const gl = this.gl,
      p = gl.createProgram();
    for (const [type, src] of [
      [gl.VERTEX_SHADER, v],
      [gl.FRAGMENT_SHADER, f],
    ]) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
      gl.deleteShader(s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw Error(gl.getProgramInfoLog(p));
    return { p, locations: new Map() };
  }
  uniform(p, name, value) {
    const gl = this.gl;
    if (!p.locations.has(name))
      p.locations.set(name, gl.getUniformLocation(p.p, name));
    const loc = p.locations.get(name);
    if (loc === null) return;
    if (Array.isArray(value))
      gl[value.length === 2 ? "uniform2fv" : "uniform3fv"](loc, value);
    else gl.uniform1f(loc, value);
  }
  target(w, h) {
    const gl = this.gl,
      texture = gl.createTexture(),
      fbo = gl.createFramebuffer();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      this.float ? gl.RGBA16F : gl.RGBA8,
      w,
      h,
      0,
      gl.RGBA,
      this.float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
      null,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    );
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
      throw Error("Incomplete FX framebuffer");
    return { texture, fbo, w, h };
  }
  bind(target) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target?.fbo ?? null);
    gl.viewport(0, 0, target?.w ?? this.width, target?.h ?? this.height);
  }
  texture(p, name, t, unit) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t.texture);
    gl.uniform1i(gl.getUniformLocation(p.p, name), unit);
  }
  render(o) {
    const gl = this.gl;
    if (gl.isContextLost()) return null;
    // A fixed square render target avoids reallocating seven textures for each
    // differently sized card. Aspect is encoded in projection and final crop.
    const side = (o.quality ?? 1) >= 1 ? 1024 : 640;
    if (this.width !== side) {
      for (const t of this.targets) {
        gl.deleteTexture(t.texture);
        gl.deleteFramebuffer(t.fbo);
      }
      this.canvas.width = this.width = side;
      this.canvas.height = this.height = side;
      this.targets = [this.target(side, side)];
      for (const divisor of [2, 4, 8])
        for (let j = 0; j < 2; j++)
          this.targets.push(this.target(side / divisor, side / divisor));
    }
    const mode =
      { ambient: 0, art: 1, aura: 2, token: 3, reactor: 4 }[o.mode ?? "aura"] ?? 2;
    const tint = palettes[o.kind] ?? palettes.arcane;
    gl.disable(gl.BLEND);
    this.bind(this.targets[0]);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const settings = {
      resolution: [o.width, o.height],
      time: o.time ?? 0,
      mode,
      strength: o.strength ?? 1,
      impactAt: o.burstAt ?? 0.42,
      charge: o.charge ?? 0,
      tint,
    };
    for (const name of ["atmosphere", "ribbons", "particles"]) {
      if (name === "ribbons" && mode === 0) continue;
      const p = this.programs[name];
      gl.useProgram(p.p);
      for (const [k, v] of Object.entries(settings)) this.uniform(p, k, v);
      if (name === "atmosphere") gl.drawArrays(gl.TRIANGLES, 0, 3);
      else {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        if (name === "ribbons")
          gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 256, mode === 1 ? 5 : 9);
        else
          gl.drawArraysInstanced(
            gl.TRIANGLES,
            0,
            6,
            mode === 0
              ? 480
              : mode === 1
                ? 320
                : Math.round(3600 * (o.quality ?? 1)),
          );
      }
    }
    gl.disable(gl.BLEND);
    const blur = this.programs.blur;
    gl.useProgram(blur.p);
    for (let i = 1; i < 7; i += 2) {
      const source = i === 1 ? this.targets[0] : this.targets[i - 1],
        a = this.targets[i],
        b = this.targets[i + 1];
      this.bind(a);
      this.texture(blur, "source", source, 0);
      this.uniform(blur, "direction", [1.25 / source.w, 0]);
      this.uniform(blur, "threshold", i === 1 ? 0.16 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.bind(b);
      this.texture(blur, "source", a, 0);
      this.uniform(blur, "direction", [0, 1.25 / a.h]);
      this.uniform(blur, "threshold", 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    this.bind(null);
    const p = this.programs.composite;
    gl.useProgram(p.p);
    this.uniform(p, "mode", mode);
    for (const [i, name] of ["scene", "bloom1", "bloom2", "bloom3"].entries())
      this.texture(p, name, this.targets[i * 2], i);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return this.canvas;
  }
}
export function renderGPU(doc, options) {
  if (!doc) return null;
  let e = engines.get(doc);
  if (e === false) return null;
  if (!e) {
    try {
      e = new Engine(doc);
      engines.set(doc, e);
    } catch (error) {
      console.warn("Cinematic GPU fallback:", error.message);
      engines.set(doc, false);
      return null;
    }
  }
  return e.render(options);
}
