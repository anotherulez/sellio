(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,20592,e=>{"use strict";var t=e.i(43476),o=e.i(71645);let i=`#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`,a=`#version 300 es
precision highp float;
precision highp int;

uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uMouse;
uniform float uAngle;
uniform float uNoise;
uniform float uBlindCount;
uniform float uSpotlightRadius;
uniform float uSpotlightSoftness;
uniform float uSpotlightOpacity;
uniform float uMirror;
uniform float uDistort;
uniform float uShineFlip;
uniform vec3 uColors[8];
uniform int uColorCount;
uniform float uLightMode;
uniform float uShine;
uniform float uRelief;
uniform float uGlow;
uniform float uSway;
uniform float uSwayTime;
uniform float uHover;
uniform vec4 uWaves[4];
uniform float uIntro;
uniform float uGrainTime;
uniform vec3 uLightColor;
uniform float uPerspective;
uniform float uGradientShift;

out vec4 outColor;

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

vec2 rotate2D(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c) * p;
}

vec2 blindSpace(vec2 uv0) {
  float aspect = uResolution.x / uResolution.y;
  vec2 p = uv0 * 2.0 - 1.0;
  p.x *= aspect;
  vec2 pr = rotate2D(p, uAngle);
  pr.x /= aspect;
  vec2 uv = pr * 0.5 + 0.5;
  if (abs(uPerspective) > 0.001) {
    float k = uPerspective * 2.2;
    uv.x = (exp(k * uv.x) - 1.0) / (exp(k) - 1.0);
  }
  if (uDistort > 0.0) {
    float a = uv.y * 6.0;
    float b = uv.x * 6.0;
    float w = 0.01 * uDistort;
    uv.x += sin(a) * w;
    uv.y += cos(b) * w;
  }
  return uv;
}

vec3 gradientColor(float t) {
  float tt = clamp(t, 0.0, 1.0);
  int count = max(uColorCount, 2);
  float scaled = tt * float(count - 1);
  int seg = min(int(floor(scaled)), count - 2);
  float f = scaled - float(seg);
  if (tt >= 1.0) return uColors[count - 1];
  return mix(uColors[seg], uColors[seg + 1], f);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv0 = frag / uResolution;
  vec2 uvMod = blindSpace(uv0);

  float count = max(uBlindCount, 1.0);
  float stripePhase = uvMod.x * count;
  float pixel = max(fwidth(stripePhase), 1e-5);

  float t = uvMod.x;
  if (uGradientShift != 0.0) {
    t = 1.0 - abs(1.0 - fract((t + uGradientShift) * 0.5) * 2.0);
  }
  if (uMirror > 0.5) {
    t = 1.0 - abs(1.0 - 2.0 * fract(t));
  }
  vec3 base = gradientColor(t);

  vec2 offset = uMouse / uResolution;
  float d = length(uv0 - offset);
  float r = max(uSpotlightRadius, 1e-4);
  float spot = (1.0 - 2.0 * pow(d / r, uSpotlightSoftness)) * uSpotlightOpacity;

  float slat = floor(stripePhase);
  float s = stripePhase - slat;
  float stripeAA = clamp(count * 1.25 / min(uResolution.x, uResolution.y), 0.001, 0.12);
  float edgeBlend = 1.0 - smoothstep(0.0, stripeAA, min(s, 1.0 - s));
  float across = mix(s, 0.5, edgeBlend);
  float ramp = uShineFlip > 0.5 ? 1.0 - across : across;

  float unit = min(uResolution.x, uResolution.y);
  float reach = max(uSpotlightRadius, 0.05) * unit;
  vec2 toLight = uMouse - frag;
  float nearLight = exp(-dot(toLight, toLight) / (reach * reach));

  float tilt = 0.0;
  float pulse = 0.0;
  if (uSway > 0.0) {
    tilt += uSway * 0.5 * sin(uSwayTime * 0.9 + slat * 0.55) * (0.6 + 0.4 * sin(uSwayTime * 0.37 + slat * 0.21));
  }
  tilt += uHover * nearLight * 0.7;
  float aspect = uResolution.x / uResolution.y;
  for (int i = 0; i < 4; i++) {
    vec4 wave = uWaves[i];
    if (wave.w <= 0.0) continue;
    float age = uTime - wave.z;
    if (age < 0.0 || age > 1.60) continue;
    float life = age / 1.60;
    vec2 origin = blindSpace(wave.xy / uResolution);
    float slats = abs(slat + 0.5 - origin.x * count);
    float front = age * max(count, 4.0) * 0.95;
    float k = (slats - front) / (0.8 + life * 1.2);
    float along = (uvMod.y - origin.y) / max(0.42 + life * 0.5, 0.01);
    float fade = (1.0 - life) * (1.0 - life);
    float ring = exp(-k * k) * exp(-along * along) * fade * smoothstep(0.0, 0.2, age);
    tilt += ring * 0.9;
    pulse += ring;
  }
  if (uIntro < 1.0) {
    float settle = smoothstep(0.0, 1.0, clamp(uIntro * 1.5 - uv0.x * 0.5, 0.0, 1.0));
    tilt -= (1.0 - settle) * 1.2;
  }

  float edge = ramp;
  float calm = 1.0 - 0.6 * clamp(spot, 0.0, 1.0);
  ramp = pow(clamp(ramp, 0.0, 1.0), exp(tilt * 0.9));
  ramp *= 1.0 - 0.3 * min(pulse, 1.0) * calm;
  float crease = uRelief * 0.38 * smoothstep(0.62, 1.0, ramp);
  float sheen = uShine * exp(-pow((edge - 0.035) / 0.07, 2.0)) * (0.3 + 0.7 * nearLight) * (1.0 - edgeBlend);

  vec3 lit = spot > 0.0 ? uLightColor * spot : vec3(spot);
  lit += uLightColor * min(pulse, 1.0) * 0.35 * calm;
  vec3 revealSignal = lit + base - vec3(ramp + crease);

  vec3 col;
  if (uLightMode > 0.5) {
    vec3 luma = vec3(0.2126, 0.7152, 0.0722);
    float peak = max(base.r, max(base.g, base.b));
    float low = min(base.r, min(base.g, base.b));
    float chroma = (peak - low) / max(peak, 0.0001);
    vec3 hue = base / max(peak, 0.0001);
    hue = clamp(mix(vec3(dot(hue, luma)), hue, 1.3), 0.0, 1.0);
    hue *= mix(1.0, 0.82, smoothstep(0.55, 0.9, dot(hue, luma)));
    vec3 tint = mix(base, hue, smoothstep(0.06, 0.28, chroma));
    vec3 revealed = clamp(revealSignal, 0.0, 1.0);
    float coverage = max(revealed.r, max(revealed.g, revealed.b));
    float stroke = 1.0 - smoothstep(pixel, pixel * 2.2, edge);
    col = mix(vec3(1.0), tint, 0.72 * smoothstep(0.0, 1.0, coverage));
    col = mix(col, tint * 0.85, stroke * clamp(coverage * 1.5, 0.0, 1.0) * 0.7);
    col = mix(col, vec3(1.0), clamp(sheen, 0.0, 1.0) * 0.5);
    float grain = max(0.5 * (hash(frag + uGrainTime) + hash(frag.yx + uGrainTime * 1.7)) - 0.5, 0.0);
    col = clamp(col - vec3(grain * uNoise * 0.12 * coverage), 0.0, 1.0);
  } else {
    vec3 haze = base * uGlow * 0.4 * smoothstep(0.0, 1.0, spot) * (0.4 + 0.6 * ramp);
    col = revealSignal + haze + mix(base, uLightColor, 0.45) * sheen * 0.7;
    vec3 over = max(col - 0.8, 0.0);
    col = min(col, vec3(0.8)) + 0.2 * (1.0 - exp(-over / 0.2));
    float luma = dot(clamp(col, 0.0, 1.0), vec3(0.2126, 0.7152, 0.0722));
    float grain = 0.5 * (hash(frag + uGrainTime) + hash(frag.yx + uGrainTime * 1.7)) - 0.5;
    col += grain * uNoise * (0.45 + 0.55 * smoothstep(0.0, 0.5, luma));
  }

  float presence = smoothstep(0.0, 0.65, uIntro);
  col = uLightMode > 0.5 ? mix(vec3(1.0), col, presence) : col * presence;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,r=(e,t,o)=>Math.min(o,Math.max(t,e)),n=(e,t,o)=>{let i=e.createShader(t);return i?(e.shaderSource(i,o),e.compileShader(i),e.getShaderParameter(i,e.COMPILE_STATUS))?i:(e.deleteShader(i),null):null},l=e=>{let t=String(e||"").replace("#","").padEnd(6,"0");return[parseInt(t.slice(0,2),16)/255||0,parseInt(t.slice(2,4),16)/255||0,parseInt(t.slice(4,6),16)/255||0]},u=e=>{let t=(e&&e.length?e:["#FF9FFC","#5227FF"]).slice(0,8);for(1===t.length&&t.push(t[0]);t.length<8;)t.push(t[t.length-1]);let o=new Float32Array(24);for(let e=0;e<8;e++)o.set(l(t[e]),3*e);return{flat:o,count:Math.max(2,Math.min(8,e?.length??2))}};e.s(["default",0,({className:e="",style:s,dpr:f,paused:c=!1,gradientColors:m,angle:h=0,noise:d=.3,blindCount:p=16,blindMinWidth:v=60,mouseDampening:g=.15,mirrorGradient:x=!1,spotlightRadius:y=.5,spotlightSoftness:w=1,spotlightOpacity:S=1,distortAmount:M=0,shineDirection:b="left",lightColor:C="#ffffff",perspective:R=0,gradientSpeed:A=0,shine:L=.4,relief:T=.5,glow:E=.4,sway:P=.35,speed:F=1,hoverTilt:I=.6,clickEffect:G="ripple",idle:k="drift",intro:D=!0,mixBlendMode:_="lighten",lightMode:B=!1})=>{let N=(0,o.useRef)(null),O=(0,o.useRef)(null),q=(0,o.useRef)(null),V={paused:c,colorKey:(m&&m.length?m:["#FF9FFC","#5227FF"]).join(","),gradientColors:m,angle:h,noise:r(d,0,2),blindCount:Math.max(1,p||1),blindMinWidth:v,mouseDampening:Math.max(0,g),mirrorGradient:x,spotlightRadius:y,spotlightSoftness:w,spotlightOpacity:S,distortAmount:M,shineDirection:b,lightColor:C,perspective:r(R,-1,1),gradientSpeed:A,shine:r(L,0,2),relief:r(T,0,1),glow:r(E,0,2),sway:r(P,0,1),speed:r(F,0,4),hoverTilt:r(I,0,1.5),clickEffect:G,idle:k,intro:D,lightMode:B,dpr:f},W=(0,o.useRef)(V);return W.current=V,(0,o.useEffect)(()=>{let e=N.current,t=O.current,o=t?.getContext("webgl2",{alpha:!1,antialias:!1,depth:!1,stencil:!1,premultipliedAlpha:!1});if(!e||!t||!o)return;let s=(e=>{let t=n(e,e.VERTEX_SHADER,i),o=n(e,e.FRAGMENT_SHADER,a),r=e.createProgram();if(!t||!o||!r)return null;if(e.attachShader(r,t),e.attachShader(r,o),e.linkProgram(r),e.deleteShader(t),e.deleteShader(o),!e.getProgramParameter(r,e.LINK_STATUS))return e.deleteProgram(r),null;let l={},u=e.getProgramParameter(r,e.ACTIVE_UNIFORMS);for(let t=0;t<u;t++){let o=e.getActiveUniform(r,t);if(!o)continue;let i=o.name.replace(/\[0\]$/,"");l[i]=e.getUniformLocation(r,i)}return{program:r,uniforms:l}})(o);if(!s)return;let f=s.uniforms,c=o.createVertexArray(),m=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches??!1,h={width:1,height:1,ratio:1},d={x:0,y:0,inside:!1},p={x:0,y:0,vx:0,vy:0,tx:0,ty:0,ready:!1},v=new Float32Array(16),g=0,x=0,y=0,w=0,S=0,M=0,b=W.current.intro&&!m?0:1,C="",R=u(W.current.gradientColors),A=0,L=0,T=!0,E=()=>{let e=W.current;C!==e.colorKey&&(R=u(e.gradientColors),C=e.colorKey),o.viewport(0,0,t.width,t.height),o.useProgram(s.program),o.bindVertexArray(c),o.uniform2f(f.uResolution,t.width,t.height),o.uniform1f(f.uTime,y),o.uniform2f(f.uMouse,p.x*h.ratio,(h.height-p.y)*h.ratio),o.uniform1f(f.uAngle,e.angle*Math.PI/180),o.uniform1f(f.uNoise,e.noise),o.uniform1f(f.uBlindCount,(e=>{if(e.blindMinWidth&&e.blindMinWidth>0){let t=Math.max(1,Math.floor(h.width/e.blindMinWidth));return Math.max(1,e.blindCount?Math.min(e.blindCount,t):t)}return Math.max(1,e.blindCount)})(e)),o.uniform1f(f.uSpotlightRadius,e.spotlightRadius),o.uniform1f(f.uSpotlightSoftness,e.spotlightSoftness),o.uniform1f(f.uSpotlightOpacity,e.spotlightOpacity),o.uniform1f(f.uMirror,+!!e.mirrorGradient),o.uniform1f(f.uDistort,e.distortAmount),o.uniform1f(f.uShineFlip,+("right"===e.shineDirection)),o.uniform3fv(f.uColors,R.flat),o.uniform1i(f.uColorCount,R.count),o.uniform1f(f.uLightMode,+!!e.lightMode),o.uniform1f(f.uShine,e.shine),o.uniform1f(f.uRelief,e.relief),o.uniform1f(f.uGlow,e.glow),o.uniform1f(f.uSway,m?0:e.sway),o.uniform1f(f.uSwayTime,w),o.uniform1f(f.uHover,x*e.hoverTilt),o.uniform4fv(f.uWaves,v),o.uniform1f(f.uIntro,b),o.uniform1f(f.uGrainTime,M),o.uniform3fv(f.uLightColor,l(e.lightColor||"#ffffff")),o.uniform1f(f.uPerspective,e.perspective),o.uniform1f(f.uGradientShift,S),o.drawArrays(o.TRIANGLES,0,3),o.bindVertexArray(null),t.hasAttribute("data-ready")||t.setAttribute("data-ready","")},P=()=>{let o=W.current;h.width=Math.max(1,e.clientWidth),h.height=Math.max(1,e.clientHeight),h.ratio=Math.min(o.dpr||window.devicePixelRatio||1,2),t.width=Math.max(1,Math.round(h.width*h.ratio)),t.height=Math.max(1,Math.round(h.height*h.ratio)),p.ready||(p.ready=!0,p.x=p.tx=h.width/2,p.y=p.ty=h.height/2),E(),I()},F=e=>{if(A=0,!T||document.hidden)return;let t=W.current;if(t.paused){L=0,E();return}let o=L?r((e-L)/1e3,.001,.05):1/60;L=e,y+=o,m||(w+=o*t.speed,S=(S+o*t.gradientSpeed*.06)%2),M=17.13*Math.floor(24*y),b<1&&(b=Math.min(1,b+o/1.8)),x+=(!!d.inside-x)*(1-Math.exp(-o/.35)),d.inside?(p.tx=d.x,p.ty=d.y):"center"===t.idle?(p.tx=h.width/2,p.ty=h.height/2):"drift"!==t.idle||m||(p.tx=h.width*(.5+.22*Math.sin(.23*w)+.05*Math.sin(.61*w+1.3)),p.ty=h.height*(.5+.16*Math.sin(.31*w+.7)+.04*Math.sin(.83*w))),((e,t)=>{let o=e.mouseDampening;if(o<=0){p.x=p.tx,p.y=p.ty,p.vx=0,p.vy=0;return}let i=2.4/o,a=i*i,r=2*i,n=Math.max(1,Math.ceil(t/.008)),l=t/n;for(let e=0;e<n;e++)p.vx+=(a*(p.tx-p.x)-r*p.vx)*l,p.vy+=(a*(p.ty-p.y)-r*p.vy)*l,p.x+=p.vx*l,p.y+=p.vy*l})(t,o);for(let e=0;e<4;e++)v[4*e+3]>0&&y-v[4*e+2]>1.6&&(v[4*e+3]=0);E(),(Math.abs(p.tx-p.x)>.05||Math.abs(p.ty-p.y)>.05||Math.abs(p.vx)+Math.abs(p.vy)>.05||Math.abs(!!d.inside-x)>.002||b<1||v.some((e,t)=>t%4==3&&e>0)||!m&&(t.noise>0||0!==t.gradientSpeed||t.sway>0&&t.speed>0||"drift"===t.idle&&!d.inside))&&(A=requestAnimationFrame(F))};function I(){A||!T||document.hidden||(L=0,A=requestAnimationFrame(F))}let G=t=>{let o=e.getBoundingClientRect(),i=t.clientX-o.left,a=t.clientY-o.top;return{x:i,y:a,inside:i>=0&&a>=0&&i<=o.width&&a<=o.height}},k=e=>{let{x:t,y:o,inside:i}=G(e);d.x=t,d.y=o,d.inside=i,i&&!W.current.paused&&I()},D=e=>{let t=W.current,{x:o,y:i,inside:a}=G(e);if(!a||t.paused||m||"ripple"!==t.clickEffect)return;let r=4*g;v[r]=o*h.ratio,v[r+1]=(h.height-i)*h.ratio,v[r+2]=y,v[r+3]=1,g=(g+1)%4,I()},_=()=>{d.inside=!1,I()},B=()=>{L=0,I()},V=new ResizeObserver(P);V.observe(e);let U=new IntersectionObserver(e=>{(T=e.some(e=>e.isIntersecting))&&I()});return U.observe(e),window.addEventListener("pointermove",k,{passive:!0}),window.addEventListener("pointerdown",D,{passive:!0}),document.documentElement.addEventListener("pointerleave",_),document.addEventListener("visibilitychange",B),P(),q.current=I,()=>{cancelAnimationFrame(A),q.current=null,V.disconnect(),U.disconnect(),window.removeEventListener("pointermove",k),window.removeEventListener("pointerdown",D),document.documentElement.removeEventListener("pointerleave",_),document.removeEventListener("visibilitychange",B),o.deleteVertexArray(c),o.deleteProgram(s.program),t.isConnected||o.getExtension("WEBGL_lose_context")?.loseContext()}},[]),(0,o.useEffect)(()=>{q.current?.()}),(0,t.jsx)("div",{ref:N,className:`gradient-blinds-container${e?` ${e}`:""}`,style:{...!B&&_?{mixBlendMode:_}:null,...s},children:(0,t.jsx)("canvas",{ref:O,className:"gradient-blinds-canvas","aria-hidden":"true"})})}])},87125,function(e){e.n(e.i(20592))}]);