import { useState, useEffect, useRef, useCallback, useMemo } from "react";

function cubicBezier(p1x,p1y,p2x,p2y,t){
  const cx=3*p1x,bx=3*(p2x-p1x)-cx,ax=1-cx-bx;
  const cy=3*p1y,by=3*(p2y-p1y)-cy,ay=1-cy-by;
  let g=t;for(let i=0;i<12;i++){const e=((ax*g+bx)*g+cx)*g-t;if(Math.abs(e)<1e-7)break;const d=(3*ax*g+2*bx)*g+cx;if(Math.abs(d)<1e-7)break;g-=e/d;}
  return((ay*g+by)*g+cy)*g;
}

const COLORS=[
  {hex:"#F680FF",n:"Pink"},{hex:"#EABE95",n:"Peach"},{hex:"#B8FFD7",n:"Mint"},
  {hex:"#8A05FF",n:"Purple"},{hex:"#F0989E",n:"Salmon"},{hex:"#F347FF",n:"Magenta"},
  {hex:"#D1B8FF",n:"Lavender"},{hex:"#5CFFB8",n:"Green"},{hex:"#8AD6FF",n:"Sky"},
  {hex:"#000000",n:"Black"},{hex:"#FFFFFF",n:"White"},{hex:"#FF5722",n:"Orange"},
  {hex:"#FFD93D",n:"Yellow"},
];
const BG_OPTIONS=[{hex:"#ffffff",n:"Light"},{hex:"#0d0d0d",n:"Dark"},...COLORS];

function hash(x,y){let h=(x*374761393+y*668265263)^(x*y);h=(h^(h>>13))*1274126177;h=h^(h>>16);return(h&0x7fffffff)/0x7fffffff;}

// Each phase has a FIXED number of element slots.
// Elements that "don't exist yet" or "have merged" sit at the same position as their parent.
// This way every slot always has a defined position and interpolation is always between matching indices.
function buildWorkflows(S, M) {
  // For M=1: max 2 elements. For M=2: max 4. For M=3: max 8.
  const N = Math.pow(2, M);
  const spds = [];

  // Helper: create a phase with N slots, filling unused with copies of nearest
  const mk = (positions, spd) => {
    const out = [];
    for (let i = 0; i < N; i++) {
      out.push(positions[i] || positions[positions.length - 1]);
    }
    spds.push(spd || 1);
    return out;
  };

  const p = [];

  // === FIRST HALF: vertical axis ===
  // All at center
  p.push(mk([{gx:0,gy:0}], 1));

  if (M === 1) {
    // 1→2 vertical
    p.push(mk([{gx:0,gy:-S},{gx:0,gy:S}], 1));
    // 2→1
    p.push(mk([{gx:0,gy:0}], 1.8));
  }
  if (M === 2) {
    // 1→4: first split vertical (all 4 start stacked in pairs)
    p.push(mk([{gx:0,gy:-S},{gx:0,gy:-S},{gx:0,gy:S},{gx:0,gy:S}], 1));
    // Then split horizontal
    p.push(mk([{gx:-S,gy:-S},{gx:S,gy:-S},{gx:-S,gy:S},{gx:S,gy:S}], 1));
    // 4→2: merge horizontal
    p.push(mk([{gx:0,gy:-S},{gx:0,gy:-S},{gx:0,gy:S},{gx:0,gy:S}], 1));
    // 2→1: merge vertical
    p.push(mk([{gx:0,gy:0}], 1.8));
  }
  if (M === 3) {
    // 1→4 via vertical then horizontal
    p.push(mk([{gx:0,gy:-S},{gx:0,gy:-S},{gx:0,gy:S},{gx:0,gy:S},{gx:0,gy:-S},{gx:0,gy:-S},{gx:0,gy:S},{gx:0,gy:S}], 1));
    p.push(mk([{gx:-S,gy:-S},{gx:S,gy:-S},{gx:-S,gy:S},{gx:S,gy:S},{gx:-S,gy:-S},{gx:S,gy:-S},{gx:-S,gy:S},{gx:S,gy:S}], 1));
    // 4→8: split vertical from each of the 4
    p.push(mk([
      {gx:-S,gy:-S*2},{gx:S,gy:-S*2},
      {gx:-S,gy:S*2},{gx:S,gy:S*2},
      {gx:-S*2,gy:-S},{gx:S*2,gy:-S},
      {gx:-S*2,gy:S},{gx:S*2,gy:S},
    ], 1));
    // 8→4
    p.push(mk([{gx:-S,gy:-S},{gx:S,gy:-S},{gx:-S,gy:S},{gx:S,gy:S},{gx:-S,gy:-S},{gx:S,gy:-S},{gx:-S,gy:S},{gx:S,gy:S}], 1));
    // 4→2
    p.push(mk([{gx:0,gy:-S},{gx:0,gy:-S},{gx:0,gy:S},{gx:0,gy:S},{gx:0,gy:-S},{gx:0,gy:-S},{gx:0,gy:S},{gx:0,gy:S}], 1));
    // 2→1
    p.push(mk([{gx:0,gy:0}], 1.8));
  }

  // === SECOND HALF: horizontal axis ===
  // 1→2 horizontal (far)
  if (M === 1) {
    p.push(mk([{gx:-S*2,gy:0},{gx:S*2,gy:0}], 2.2));
    p.push(mk([{gx:-S,gy:0},{gx:S,gy:0}], 1));
    p.push(mk([{gx:0,gy:0}], 1.8));
  }
  if (M === 2) {
    // 1→2 far
    p.push(mk([{gx:-S*2,gy:0},{gx:-S*2,gy:0},{gx:S*2,gy:0},{gx:S*2,gy:0}], 2.2));
    // 2→4: split vertical
    p.push(mk([{gx:-S*2,gy:-S},{gx:-S*2,gy:S},{gx:S*2,gy:-S},{gx:S*2,gy:S}], 1));
    // 4→4 tighten
    p.push(mk([{gx:-S,gy:-S},{gx:-S,gy:S},{gx:S,gy:-S},{gx:S,gy:S}], 0.8));
    // 4→2: merge vertical
    p.push(mk([{gx:-S,gy:0},{gx:-S,gy:0},{gx:S,gy:0},{gx:S,gy:0}], 1));
    // 2→1
    p.push(mk([{gx:0,gy:0}], 1.8));
  }
  if (M === 3) {
    // 1→2 far
    p.push(mk([{gx:-S*2,gy:0},{gx:-S*2,gy:0},{gx:S*2,gy:0},{gx:S*2,gy:0},{gx:-S*2,gy:0},{gx:-S*2,gy:0},{gx:S*2,gy:0},{gx:S*2,gy:0}], 2.2));
    // 2→4: split vertical
    p.push(mk([{gx:-S*2,gy:-S},{gx:-S*2,gy:S},{gx:S*2,gy:-S},{gx:S*2,gy:S},{gx:-S*2,gy:-S},{gx:-S*2,gy:S},{gx:S*2,gy:-S},{gx:S*2,gy:S}], 1));
    // 4→8: split horizontal
    p.push(mk([
      {gx:-S*3,gy:-S},{gx:-S,gy:-S},
      {gx:-S*3,gy:S},{gx:-S,gy:S},
      {gx:S,gy:-S},{gx:S*3,gy:-S},
      {gx:S,gy:S},{gx:S*3,gy:S},
    ], 1));
    // tighten
    p.push(mk([
      {gx:-S*2,gy:-S},{gx:-S,gy:-S},
      {gx:-S*2,gy:S},{gx:-S,gy:S},
      {gx:S,gy:-S},{gx:S*2,gy:-S},
      {gx:S,gy:S},{gx:S*2,gy:S},
    ], 0.8));
    // 8→4
    p.push(mk([{gx:-S*2,gy:-S},{gx:-S*2,gy:S},{gx:S*2,gy:-S},{gx:S*2,gy:S},{gx:-S*2,gy:-S},{gx:-S*2,gy:S},{gx:S*2,gy:-S},{gx:S*2,gy:S}], 1));
    // 4→2
    p.push(mk([{gx:-S,gy:0},{gx:-S,gy:0},{gx:S,gy:0},{gx:S,gy:0},{gx:-S,gy:0},{gx:-S,gy:0},{gx:S,gy:0},{gx:S,gy:0}], 1));
    // 2→1
    p.push(mk([{gx:0,gy:0}], 1.8));
  }

  return{name:"Workflows",desc:`1→${N}→2→1→2→${N}→2→1`,phases:p,speeds:spds,N};
}

function buildSignal(S,M){
  const N=Math.pow(2,M);const spds=[];
  const mk=(pos,spd)=>{const o=[];for(let i=0;i<N;i++)o.push(pos[i]||pos[pos.length-1]);spds.push(spd||1);return o;};
  const p=[mk([{gx:0,gy:0}])];
  p.push(mk([{gx:0,gy:-S},{gx:0,gy:S}]));
  if(M>=2)p.push(mk([{gx:0,gy:-S*2},{gx:0,gy:S*2},{gx:-S,gy:0},{gx:S,gy:0}]));
  if(M>=2)p.push(mk([{gx:-S,gy:-S},{gx:S,gy:-S},{gx:-S,gy:S},{gx:S,gy:S}]));
  p.push(mk([{gx:0,gy:-S},{gx:0,gy:S}]));
  p.push(mk([{gx:0,gy:0}]));
  return{name:"Signal",desc:"Pulse outward and back",phases:p,speeds:spds,N};
}
function buildStack(S,M){
  const N=Math.pow(2,M);const spds=[];
  const mk=(pos,spd)=>{const o=[];for(let i=0;i<N;i++)o.push(pos[i]||pos[pos.length-1]);spds.push(spd||1);return o;};
  const p=[mk([{gx:0,gy:0}])];
  p.push(mk([{gx:S,gy:0},{gx:-S,gy:0}]));
  if(M>=2)p.push(mk([{gx:S,gy:-S},{gx:-S,gy:S},{gx:S,gy:S},{gx:-S,gy:-S}]));
  p.push(mk([{gx:0,gy:-S},{gx:0,gy:S}]));
  p.push(mk([{gx:0,gy:0}]));
  return{name:"Stack",desc:"Layers sliding over",phases:p,speeds:spds,N};
}

const PRESETS={"Snap":[[0.95,0],[0.05,1]],"Step":[[0.0,0.95],[1.0,0.05]],"Hard":[[0.98,0],[0.02,1]],"Ease":[[0.42,0],[0.58,1]]};

function CurveEditor({p1,p2,onChange}){
  const ref=useRef(null);const[dr,setDr]=useState(null);
  const W=192,H=90,pad=8;
  const toS=(x,y)=>[pad+x*(W-pad*2),pad+(1-y)*(H-pad*2)];
  const fromS=(x,y)=>[Math.max(0,Math.min(1,(x-pad)/(W-pad*2))),Math.max(-0.5,Math.min(2,1-(y-pad)/(H-pad*2)))];
  const[s1x,s1y]=toS(p1[0],p1[1]);const[s2x,s2y]=toS(p2[0],p2[1]);
  const[o0x,o0y]=toS(0,0);const[o1x,o1y]=toS(1,1);
  const pts=[];for(let i=0;i<=60;i++){const t=i/60;const y=cubicBezier(p1[0],p1[1],p2[0],p2[1],t);const[px,py]=toS(t,y);pts.push(`${px},${py}`);}
  const hm=useCallback(e=>{if(!dr||!ref.current)return;const r=ref.current.getBoundingClientRect();const cx=(e.touches?e.touches[0].clientX:e.clientX)-r.left;const cy=(e.touches?e.touches[0].clientY:e.clientY)-r.top;const[nx,ny]=fromS(cx,cy);if(dr===1)onChange([nx,ny],p2);else onChange(p1,[nx,ny]);},[dr,p1,p2,onChange]);
  const hu=useCallback(()=>setDr(null),[]);
  useEffect(()=>{if(dr){window.addEventListener("mousemove",hm);window.addEventListener("mouseup",hu);window.addEventListener("touchmove",hm,{passive:false});window.addEventListener("touchend",hu);return()=>{window.removeEventListener("mousemove",hm);window.removeEventListener("mouseup",hu);window.removeEventListener("touchmove",hm);window.removeEventListener("touchend",hu);};}},[dr,hm,hu]);
  return(
    <svg ref={ref} width={W} height={H} style={{background:"#0a0a0a",display:"block",cursor:dr?"grabbing":"default",border:"1px solid #222"}}>
      <rect x={pad} y={pad} width={W-pad*2} height={H-pad*2} fill="none" stroke="#222"/>
      <line x1={pad} y1={pad+(H-pad*2)} x2={pad+(W-pad*2)} y2={pad} stroke="#181818" strokeDasharray="2,2"/>
      <line x1={o0x} y1={o0y} x2={s1x} y2={s1y} stroke="#333"/>
      <line x1={o1x} y1={o1y} x2={s2x} y2={s2y} stroke="#333"/>
      <polyline points={pts.join(" ")} fill="none" stroke="#fff" strokeWidth={1.5}/>
      <circle cx={s1x} cy={s1y} r={6} fill="#fff" style={{cursor:"grab"}} onMouseDown={e=>{e.preventDefault();setDr(1)}} onTouchStart={e=>{e.preventDefault();setDr(1)}}/>
      <circle cx={s2x} cy={s2y} r={6} fill="#fff" style={{cursor:"grab"}} onMouseDown={e=>{e.preventDefault();setDr(2)}} onTouchStart={e=>{e.preventDefault();setDr(2)}}/>
    </svg>
  );
}

function CPick({colors,setColors,idx}){
  const[open,setOpen]=useState(false);
  return(
    <div style={{position:"relative"}}>
      <button onClick={()=>setOpen(!open)} style={{width:22,height:22,background:colors[idx],border:"1px solid #444",cursor:"pointer",borderRadius:0}}/>
      {open&&<div style={{position:"absolute",bottom:28,left:0,background:"#0a0a0a",border:"1px solid #333",padding:4,zIndex:30,display:"flex",flexWrap:"wrap",gap:3,width:120}}>
        {COLORS.map(c=><button key={c.hex} onClick={()=>{const n=[...colors];n[idx]=c.hex;setColors(n);setOpen(false);}} title={c.n}
          style={{width:20,height:20,background:c.hex,border:colors[idx]===c.hex?"2px solid #fff":"1px solid #444",cursor:"pointer",borderRadius:0}}/>)}
      </div>}
    </div>
  );
}

function BgColorPick({value,onChange}:{value:string;onChange:(hex:string|null)=>void}){
  const[open,setOpen]=useState(false);
  return(
    <div style={{position:"relative"}}>
      <button onClick={()=>setOpen(!open)} title="Page background" style={{width:22,height:22,background:value,border:"1px solid #444",cursor:"pointer",borderRadius:0}}/>
      {open&&<div style={{position:"absolute",top:28,right:0,background:"#0a0a0a",border:"1px solid #333",padding:6,zIndex:30,display:"flex",flexWrap:"wrap",gap:3,width:100,maxHeight:160,overflowY:"auto"}}>
        <button onClick={()=>{onChange(null);setOpen(false);}} title="Use Light/Dark toggle" style={{width:"100%",padding:"4px 6px",fontSize:9,background:"#1a1a1a",border:"1px solid #333",color:"#999",cursor:"pointer",borderRadius:0,textAlign:"left"}}>Auto</button>
        {BG_OPTIONS.map(c=><button key={c.hex} onClick={()=>{onChange(c.hex);setOpen(false);}} title={c.n}
          style={{width:20,height:20,background:c.hex,border:value===c.hex?"2px solid #fff":"1px solid #444",cursor:"pointer",borderRadius:0}}/>)}
      </div>}
    </div>
  );
}

function Section({label,children}){
  return(<div style={{marginBottom:12}}>
    <div style={{fontSize:9,color:"#666",marginBottom:5,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600}}>{label}</div>
    {children}
  </div>);
}

function projectCubeFace(cx,cy,sz,aX,aY){
  const hs=sz/2,cos=Math.cos,sin=Math.sin;
  const v=[[-hs,-hs,hs],[hs,-hs,hs],[hs,hs,hs],[-hs,hs,hs],[-hs,-hs,-hs],[hs,-hs,-hs],[hs,hs,-hs],[-hs,hs,-hs]];
  const rot=([x,y,z])=>{let y1=y*cos(aX)-z*sin(aX),z1=y*sin(aX)+z*cos(aX);y=y1;z=z1;let x1=x*cos(aY)+z*sin(aY),z2=-x*sin(aY)+z*cos(aY);return[x1,y,z2];};
  const rv=v.map(rot);
  const faces=[[0,1,2,3],[1,5,6,2],[5,4,7,6],[4,0,3,7],[4,5,1,0],[3,2,6,7]];
  return faces.map((f,i)=>{const pts=f.map(j=>[cx+rv[j][0],cy+rv[j][1]]);const az=f.reduce((s,j)=>s+rv[j][2],0)/4;return{pts,avgZ:az,idx:i};}).sort((a,b)=>a.avgZ-b.avgZ);
}

export default function App(){
  const canvasRef=useRef(null);const animRef=useRef(null);const timeRef=useRef(0);const lastRef=useRef(0);
  const quantizedTimeRef=useRef(0);const fpsAccRef=useRef(0);

  const[playing,setPlaying]=useState(true);
  const[speed,setSpeed]=useState(0.8);
  const[seedCount,setSeedCount]=useState(1);
  const[pixelSize,setPixelSize]=useState(36);
  const[lightBg,setLightBg]=useState(false);
  const[dance,setDance]=useState("workflows");
  const[curveP1,setCurveP1]=useState([0.95,0]);
  const[curveP2,setCurveP2]=useState([0.05,1]);
  const[showPanel,setShowPanel]=useState(true);
  const[holdFrames,setHoldFrames]=useState(2);
  const[showGrid,setShowGrid]=useState(true);
  const[colors,setColors]=useState(["#5CFFB8","#F680FF","#8A05FF"]);
  const[stepSize,setStepSize]=useState(4);
  const[stagger,setStagger]=useState(0.10);
  const[fps,setFps]=useState(36);
  const[maxMult,setMaxMult]=useState(2);
  const[dither,setDither]=useState(0.10);
  const[cubeSpin,setCubeSpin]=useState(true);
  const[showFrame,setShowFrame]=useState(false);
  const[bgCustom,setBgCustom]=useState<string|null>(null);

  const bgColor=bgCustom??(lightBg?"#ffffff":"#0d0d0d");
  const gridColorLuma=useMemo(()=>{
    const hex=bgColor.slice(1);const r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16);
    return(0.299*r+0.587*g+0.114*b)/255;
  },[bgColor]);
  const L_DARK=39/255,L_LIGHT=199/255;
  const gridStrokeStyle=useMemo(()=>{
    const L=gridColorLuma;
    const target=L<0.5?L_DARK:L_LIGHT;
    if(target<=L){
      const alpha=Math.max(0,Math.min(1,1-target/L));
      return`rgba(0,0,0,${alpha})`;
    }else{
      const alpha=Math.max(0,Math.min(1,(target-L)/(1-L)));
      return`rgba(255,255,255,${alpha})`;
    }
  },[gridColorLuma]);
  const[showRadialFade,setShowRadialFade]=useState(false);
  const[rotateLayerOrder,setRotateLayerOrder]=useState(false);

  const dances=useMemo(()=>({
    workflows:buildWorkflows(stepSize,maxMult),
    signal:buildSignal(stepSize,maxMult),
    stack:buildStack(stepSize,maxMult),
  }),[stepSize,maxMult]);

  const curDance=dances[dance];
  const phaseCount=curDance.phases.length;
  const ease=useCallback(t=>cubicBezier(curveP1[0],curveP1[1],curveP2[0],curveP2[1],Math.max(0,Math.min(1,t))),[curveP1,curveP2]);

  const phaseTimes=useMemo(()=>{
    const holdLen=holdFrames*0.1;const times=[0];let cum=0;
    for(let i=0;i<phaseCount;i++){
      const spd=curDance.speeds[i]||1;
      // Minimal hold on last phase if cube spin follows
      const h=(cubeSpin&&i===phaseCount-1)?0:holdLen;
      cum+=(1+h)/spd;times.push(cum);
    }
    if(cubeSpin){cum+=0.02;times.push(cum-0.02+0.7);cum=times[times.length-1];cum+=0.15;times.push(cum);}
    return times;
  },[phaseCount,holdFrames,curDance,cubeSpin]);

  const totalPhases=cubeSpin?phaseCount+2:phaseCount;
  const cycleLen=phaseTimes[totalPhases];

  const draw=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext("2d");
    const W=canvas.width,H=canvas.height;
    const sz=pixelSize;const halfSz=sz/2;

    ctx.fillStyle=bgColor;ctx.fillRect(0,0,W,H);

    const gridOx=Math.round(W/2/sz)*sz;
    const gridOy=Math.round(H/2/sz)*sz;
    const seedSp=H/(seedCount+1);
    // First seed center for frame alignment
    const firstSeedCy=Math.round(seedSp/sz)*sz;

    const fw=510,fh=344;
    const fcx=gridOx,fcy=seedCount===1?firstSeedCy:H/2;
    const frameLeft=Math.round(fcx-fw/2),frameTop=Math.round(fcy-fh/2);

    if(showGrid){
      ctx.strokeStyle=gridStrokeStyle;ctx.lineWidth=1;ctx.beginPath();
      for(let x=(gridOx-halfSz)%sz;x<=W;x+=sz){if(x<0)continue;ctx.moveTo(Math.floor(x)+0.5,0);ctx.lineTo(Math.floor(x)+0.5,H);}
      for(let y=(gridOy-halfSz)%sz;y<=H;y+=sz){if(y<0)continue;ctx.moveTo(0,Math.floor(y)+0.5);ctx.lineTo(W,Math.floor(y)+0.5);}
      ctx.stroke();
    }

    if(showRadialFade){
      ctx.save();
      ctx.beginPath();
      ctx.rect(0,0,W,H);
      ctx.rect(frameLeft,frameTop,fw,fh);
      ctx.fillStyle=bgColor;
      ctx.fill("evenodd");
      const r=Math.sqrt((fw/2)*(fw/2)+(fh/2)*(fh/2));
      const grad=ctx.createRadialGradient(fcx,fcy,0,fcx,fcy,r);
      const br=parseInt(bgColor.slice(1,3),16),bg=parseInt(bgColor.slice(3,5),16),bb=parseInt(bgColor.slice(5,7),16);
      for(let i=0;i<=12;i++){
        const ti=i/12;
        const e=cubicBezier(0.33,0,0.66,1,ti);
        grad.addColorStop(e,`rgba(${br},${bg},${bb},${i<12?e:1})`);
      }
      ctx.beginPath();
      ctx.rect(frameLeft,frameTop,fw,fh);
      ctx.clip();
      ctx.fillStyle=grad;
      ctx.fillRect(frameLeft,frameTop,fw,fh);
      ctx.restore();
    }

    if(showFrame){
      ctx.strokeStyle="rgba(246,128,255,0.2)";ctx.lineWidth=1;
      ctx.strokeRect(frameLeft+0.5,frameTop+0.5,fw,fh);
    }

    const t=quantizedTimeRef.current;
    const N=curDance.N;

    const getState=(time)=>{
      const ct=((time%cycleLen)+cycleLen)%cycleLen;
      let pi=0;
      for(let i=0;i<phaseTimes.length-1;i++){if(ct>=phaseTimes[i]&&ct<phaseTimes[i+1]){pi=i;break;}}
      if(cubeSpin&&pi===phaseCount){
        const spinT=(ct-phaseTimes[phaseCount])/(phaseTimes[phaseCount+1]-phaseTimes[phaseCount]);
        return{positions:[{gx:0,gy:0}],spinning:true,spinT,holdAfterSpin:false,nearSpin:false};
      }
      if(cubeSpin&&pi===phaseCount+1){
        return{positions:[{gx:0,gy:0}],spinning:false,spinT:1,holdAfterSpin:true,nearSpin:false};
      }
      const pStart=phaseTimes[pi],pEnd=phaseTimes[pi+1],pDur=pEnd-pStart;
      const holdLen=holdFrames*0.1;
      const movePortion=1/(1+holdLen);
      const rawT=(ct-pStart)/pDur;
      const mt=Math.min(rawT/movePortion,1);
      const eT=ease(mt);
      const ni=(pi+1)%phaseCount;
      const curP=curDance.phases[pi];
      const nextP=curDance.phases[ni];
      const out=[];
      for(let i=0;i<N;i++){
        const from=curP[i];const to=nextP[i];
        out.push({gx:from.gx+(to.gx-from.gx)*eT,gy:from.gy+(to.gy-from.gy)*eT});
      }
      const nearSpin=cubeSpin&&pi===phaseCount-1&&mt>0.7;
      return{positions:out,spinning:false,spinT:0,holdAfterSpin:false,nearSpin};
    };

    const parseHex=(hex)=>{const p=parseInt;return[p(hex.slice(1,3),16),p(hex.slice(3,5),16),p(hex.slice(5,7),16)];};
    const darken=(rgb,f)=>[Math.round(rgb[0]*f),Math.round(rgb[1]*f),Math.round(rgb[2]*f)];

    const drawPx=(px,py,color,rgb)=>{
      const ipx=Math.round(px-halfSz),ipy=Math.round(py-halfSz);
      if(dither>0){
        const str=dither*80;const id=ctx.createImageData(sz,sz);const d=id.data;
        for(let iy=0;iy<sz;iy++)for(let ix=0;ix<sz;ix++){
          const n=(hash(ipx+ix,ipy+iy)-0.5)*str;const off=(iy*sz+ix)*4;
          d[off]=Math.max(0,Math.min(255,rgb[0]+n));d[off+1]=Math.max(0,Math.min(255,rgb[1]+n));d[off+2]=Math.max(0,Math.min(255,rgb[2]+n));d[off+3]=255;
        }
        ctx.putImageData(id,ipx,ipy);
      } else {ctx.fillStyle=color;ctx.fillRect(ipx,ipy,sz,sz);}
    };

    const baseLayers=[
      {color:colors[2],rgb:parseHex(colors[2]),dt:stagger*2},
      {color:colors[1],rgb:parseHex(colors[1]),dt:stagger},
      {color:colors[0],rgb:parseHex(colors[0]),dt:0},
    ];
    const ct=((t%cycleLen)+cycleLen)%cycleLen;
    let pi=0;
    for(let i=0;i<phaseTimes.length-1;i++){if(ct>=phaseTimes[i]&&ct<phaseTimes[i+1]){pi=i;break;}}
    const segment=rotateLayerOrder&&pi<phaseCount?Math.floor((pi/Math.max(1,phaseCount))*3)%3:0;
    const frontIndex=rotateLayerOrder?[2,1,0][segment]:2;
    const drawOrder=frontIndex===0?[1,2,0]:frontIndex===1?[0,2,1]:[0,1,2];
    const layers=drawOrder.map((i,idx)=>({...baseLayers[i],isFront:idx===2}));

    for(let s=0;s<seedCount;s++){
      const rawCy=seedSp*(s+1);
      const cx=gridOx,cy=Math.round(rawCy/sz)*sz;

      for(const layer of layers){
        const lt=t-layer.dt;
        const state=getState(lt);

        if(!layer.isFront&&cubeSpin){
          const fs=getState(t);
          if(fs.spinning||fs.holdAfterSpin||fs.nearSpin||state.spinning||state.holdAfterSpin)continue;
        }

        if(state.spinning&&layer.isFront){
          const spinEase=cubicBezier(0.22,0.6,0.36,1,state.spinT);
          const angleY=spinEase*Math.PI*4;
          const angleX=Math.sin(spinEase*Math.PI)*0.2;
          const pcx=cx,pcy=cy;
          const faces=projectCubeFace(pcx,pcy,sz,angleX,angleY);
          const shades=[1,0.65,0.4,0.3,0.8,0.55];
          faces.forEach(face=>{
            ctx.fillStyle=`rgb(${darken(layer.rgb,shades[face.idx]).join(",")})`;
            ctx.beginPath();ctx.moveTo(face.pts[0][0],face.pts[0][1]);
            for(let i=1;i<face.pts.length;i++)ctx.lineTo(face.pts[i][0],face.pts[i][1]);
            ctx.closePath();ctx.fill();
          });
        } else if(!state.spinning){
          for(const p of state.positions){
            drawPx(cx+p.gx*sz,cy+p.gy*sz,layer.color,layer.rgb);
          }
        }
      }
    }
  },[seedCount,pixelSize,lightBg,dance,ease,curDance,phaseCount,holdFrames,showGrid,colors,bgColor,gridStrokeStyle,stagger,dither,cubeSpin,phaseTimes,cycleLen,showFrame,showRadialFade,rotateLayerOrder]);

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const resize=()=>{const c=canvas.parentElement;canvas.width=c.clientWidth;canvas.height=c.clientHeight;};
    resize();window.addEventListener("resize",resize);return()=>window.removeEventListener("resize",resize);
  },[]);

  useEffect(()=>{
    const loop=ts=>{
      if(lastRef.current===0)lastRef.current=ts;
      const dt=(ts-lastRef.current)/1000;lastRef.current=ts;
      if(playing){
        timeRef.current+=dt*speed;
        fpsAccRef.current+=dt*speed;
        const fd=1/fps;
        if(fpsAccRef.current>=fd){
          const steps=Math.floor(fpsAccRef.current/fd);
          quantizedTimeRef.current+=steps*fd;
          fpsAccRef.current-=steps*fd;
        }
      }
      draw();animRef.current=requestAnimationFrame(loop);
    };
    animRef.current=requestAnimationFrame(loop);return()=>cancelAnimationFrame(animRef.current);
  },[playing,speed,draw,fps]);

  const Sl=({label,value,onChange,min,max,step=0.01,suffix})=>(
    <div style={{marginBottom:8}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#999",marginBottom:2}}>
        <span>{label}</span><span style={{fontVariantNumeric:"tabular-nums",color:"#ddd"}}>{Number.isInteger(value)?value:value.toFixed(2)}{suffix||""}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(parseFloat(e.target.value))}
        style={{width:"100%",height:6,accentColor:"#fff",cursor:"pointer"}}/>
    </div>
  );
  const Btn=({children,active,onClick,style:s,small})=>(
    <button onClick={onClick} style={{padding:small?"3px 8px":"5px 10px",fontSize:small?9:10,background:active?"#1a1a1a":"#000",border:`1px solid ${active?"#555":"#2a2a2a"}`,borderRadius:0,color:active?"#fff":"#888",cursor:"pointer",fontFamily:"'Manrope',sans-serif",fontWeight:active?600:400,...s}}>{children}</button>
  );
  const Toggle=({label,value,onChange})=>(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
      <span style={{fontSize:10,color:"#999"}}>{label}</span>
      <button onClick={()=>onChange(!value)} style={{width:34,height:18,background:value?"#fff":"#1a1a1a",border:"1px solid #444",borderRadius:0,cursor:"pointer",position:"relative",padding:0}}>
        <div style={{width:12,height:12,background:value?"#000":"#555",position:"absolute",top:2,left:value?18:2,transition:"left 0.1s"}}/>
      </button>
    </div>
  );

  return(
    <div style={{width:"100%",height:"100vh",position:"relative",background:bgColor,overflow:"hidden",fontFamily:"'Manrope',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <div style={{width:"100%",height:"100%",position:"absolute"}}>
        <canvas ref={canvasRef} style={{width:"100%",height:"100%",display:"block"}}/>
      </div>
      <div style={{position:"absolute",top:12,right:12,display:"flex",gap:4,alignItems:"center",zIndex:10}}>
        <Btn small active={playing} onClick={()=>setPlaying(!playing)}>{playing?"Pause":"Play"}</Btn>
        <Btn small onClick={()=>{timeRef.current=0;quantizedTimeRef.current=0;fpsAccRef.current=0}}>Reset</Btn>
        <Btn small active={showGrid} onClick={()=>setShowGrid(!showGrid)}>Grid</Btn>
        <Btn small onClick={()=>setLightBg(!lightBg)}>{lightBg?"Dark":"Light"}</Btn>
        <BgColorPick value={bgColor} onChange={setBgCustom} />
        <Btn small active={showFrame} onClick={()=>setShowFrame(!showFrame)}>Frame</Btn>
        <Btn small active={showRadialFade} onClick={()=>setShowRadialFade(!showRadialFade)}>Fade</Btn>
        <Btn small onClick={()=>setShowPanel(!showPanel)}>{showPanel?"Hide":"Controls"}</Btn>
      </div>
      {showPanel&&(
        <div style={{position:"absolute",top:46,left:12,width:220,background:"#000",borderRadius:0,padding:14,color:"#ccc",fontSize:11,border:"1px solid #2a2a2a",zIndex:10,maxHeight:"calc(100vh - 58px)",overflowY:"auto",fontFamily:"'Manrope',sans-serif"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
            <img src="/lil-logo.svg" alt="" width={21} height={21} style={{display:"block",flexShrink:0}} />
            <span style={{fontWeight:700,fontSize:10,letterSpacing:1,textTransform:"uppercase",color:"#fff"}}>Pixel Playground</span>
          </div>
          <Section label="Dance">
            <div style={{display:"flex",flexDirection:"column",gap:3}}>
              {Object.entries(dances).map(([k,v])=>(
                <Btn key={k} active={dance===k} onClick={()=>setDance(k)} style={{textAlign:"left",display:"block",width:"100%"}}>
                  <span style={{fontWeight:600,color:dance===k?"#fff":"#aaa"}}>{v.name}</span> <span style={{color:"#555",fontSize:9,marginLeft:4}}>{v.desc}</span>
                </Btn>
              ))}
            </div>
          </Section>
          <Section label="Colors">
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              {[["Front",0],["Mid",1],["Back",2]].map(([l,i])=>(
                <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                  <CPick colors={colors} setColors={setColors} idx={i}/>
                  <span style={{fontSize:8,color:"#555"}}>{l}</span>
                </div>
              ))}
            </div>
          </Section>
          <Section label="Motion">
            <Sl label="Speed" value={speed} onChange={setSpeed} min={0.1} max={4} step={0.1}/>
            <Sl label="Seeds" value={seedCount} onChange={v=>setSeedCount(Math.round(v))} min={1} max={8} step={1}/>
            <Sl label="Pixel Size" value={pixelSize} onChange={v=>setPixelSize(Math.round(v))} min={6} max={48} step={1} suffix="px"/>
            <Sl label="Step Distance" value={stepSize} onChange={v=>setStepSize(Math.round(v))} min={1} max={6} step={1}/>
            <Sl label="Multiply" value={maxMult} onChange={v=>setMaxMult(Math.round(v))} min={1} max={3} step={1}/>
            <Sl label="Hold" value={holdFrames} onChange={v=>setHoldFrames(Math.round(v))} min={0} max={10} step={1}/>
            <Sl label="Stagger" value={stagger} onChange={setStagger} min={0} max={0.5} step={0.01}/>
            <Sl label="FPS" value={fps} onChange={v=>setFps(Math.round(v))} min={4} max={200} step={1} suffix=" fps"/>
          </Section>
          <Sl label="Dither" value={dither} onChange={setDither} min={0} max={1} step={0.01}/>
          <Toggle label="Cube Spin" value={cubeSpin} onChange={setCubeSpin}/>
          <Toggle label="Rotate layers" value={rotateLayerOrder} onChange={setRotateLayerOrder}/>
          <Section label="Easing">
            <CurveEditor p1={curveP1} p2={curveP2} onChange={(a,b)=>{setCurveP1(a);setCurveP2(b)}}/>
            <div style={{display:"flex",flexWrap:"wrap",gap:3,marginTop:5}}>
              {Object.entries(PRESETS).map(([n,[a,b]])=>(
                <Btn key={n} small onClick={()=>{setCurveP1(a);setCurveP2(b)}}>{n}</Btn>
              ))}
            </div>
          </Section>
          <div style={{fontSize:8,color:"#333",borderTop:"1px solid #1a1a1a",paddingTop:6,marginTop:4,fontVariantNumeric:"tabular-nums"}}>
            cubic-bezier({curveP1[0].toFixed(2)},{curveP1[1].toFixed(2)},{curveP2[0].toFixed(2)},{curveP2[1].toFixed(2)}) · {phaseCount} phases
          </div>
        </div>
      )}
    </div>
  );
}
