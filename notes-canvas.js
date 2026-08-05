// notes-canvas.js — Advanced Drawing Canvas Engine for ATOMICA Chemistry E-Book
// Undo/Redo (50 levels), Smooth Bezier, Shape Perfecter, Save/Load per chapter+page,
// Touch+Stylus support, High-DPI scaling, PNG Export

(function() {
  'use strict';

  let canvas = null;
  let ctx = null;
  let currentChapterId = null;
  let currentPageNum = 1;
  let isDrawing = false;
  let currentTool = 'pen';
  let currentColor = '#1a237e';
  let currentSize = 3;
  let strokes = [];
  let redoStack = [];
  const MAX_UNDO = 50;
  let currentPath = [];

  const COLORS = [
    { name: 'Indigo',  hex: '#1a237e' },
    { name: 'Blue',    hex: '#2196F3' },
    { name: 'Red',     hex: '#e53935' },
    { name: 'Green',   hex: '#43a047' },
    { name: 'Orange',  hex: '#fb8c00' },
    { name: 'Purple',  hex: '#7b1fa2' }
  ];
  const PEN_SIZES   = [1, 2, 3, 5];
  const ERASER_SIZES = [15, 30, 60];

  // ─────────────────────────────────────────────
  //  PUBLIC CLASS
  // ─────────────────────────────────────────────
  class AtomicaSketchpad {
    constructor(canvasId) {
      canvas = document.getElementById(canvasId);
      if (!canvas) { console.warn('AtomicaSketchpad: canvas not found:', canvasId); return; }
      ctx = canvas.getContext('2d');
      resizeCanvas();
      attachEvents();
    }
    loadNotesState(chapterId, pageNum) {
      currentChapterId = chapterId;
      currentPageNum   = pageNum;
      load(chapterId, pageNum);
    }
    resizeCanvas() { if (canvas && ctx) resizeCanvas(); }
    setBrushColor(color) {
      currentColor = color;
      if (currentTool === 'eraser') { currentTool = 'pen'; canvas.style.cursor = 'crosshair'; }
    }
    setBrushThickness(size) { currentSize = parseInt(size, 10); }
    clearSketch() { clearCanvas(true); }
    exportPNG()  { return canvas ? canvas.toDataURL('image/png') : null; }
  }

  // ─────────────────────────────────────────────
  //  RESIZE (HiDPI)
  // ─────────────────────────────────────────────
  function resizeCanvas() {
    const container = canvas.parentElement;
    if (!container) return;
    const dpr  = window.devicePixelRatio || 1;
    const rect  = container.getBoundingClientRect();
    canvas.width  = rect.width * dpr;
    canvas.height = Math.max(300, rect.height) * dpr;
    canvas.style.width  = rect.width + 'px';
    canvas.style.height = Math.max(300, rect.height) + 'px';
    ctx.scale(dpr, dpr);
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';
  }

  let resizeTimeout = null;
  function handleWindowResize() {
    if (!canvas || !ctx) return;
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => resizeCanvas(), 150);
  }

  // ─────────────────────────────────────────────
  //  EVENTS (Mouse + Touch)
  // ─────────────────────────────────────────────
  function attachEvents() {
    canvas.addEventListener('mousedown',  onPointerDown);
    canvas.addEventListener('mousemove',  onPointerMove);
    canvas.addEventListener('mouseup',    onPointerUp);
    canvas.addEventListener('mouseleave', onPointerUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
    canvas.addEventListener('touchend',   onTouchEnd,   { passive: false });
    canvas.addEventListener('touchcancel',onTouchEnd,   { passive: false });
    window.addEventListener('resize', handleWindowResize);
  }

  function getCanvasPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function getTouchPos(e) {
    const t = e.touches[0] || e.changedTouches[0];
    const r = canvas.getBoundingClientRect();
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }

  function onPointerDown(e) { isDrawing = true; const p = getCanvasPos(e); currentPath = [p]; beginStroke(p); }
  function onPointerMove(e) { if (!isDrawing) return; const p = getCanvasPos(e); currentPath.push(p); continueStroke(p); }
  function onPointerUp()    { if (!isDrawing) return; isDrawing = false; endStroke(); }
  function onTouchStart(e)  { e.preventDefault(); isDrawing = true; const p = getTouchPos(e); currentPath = [p]; beginStroke(p); }
  function onTouchMove(e)   { e.preventDefault(); if (!isDrawing) return; const p = getTouchPos(e); currentPath.push(p); continueStroke(p); }
  function onTouchEnd(e)    { e.preventDefault(); if (!isDrawing) return; isDrawing = false; endStroke(); }

  // ─────────────────────────────────────────────
  //  DRAWING (Smooth Bezier)
  // ─────────────────────────────────────────────
  function beginStroke(pos) {
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    if (currentTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = currentSize;
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth   = currentSize;
      ctx.strokeStyle = currentColor;
    }
    ctx.lineTo(pos.x + 0.1, pos.y + 0.1);
    ctx.stroke();
  }

  function continueStroke(pos) {
    if (currentPath.length >= 3) {
      const len = currentPath.length;
      const p1  = currentPath[len - 2];
      const p2  = currentPath[len - 1];
      const mx  = (p1.x + p2.x) / 2;
      const my  = (p1.y + p2.y) / 2;
      ctx.quadraticCurveTo(p1.x, p1.y, mx, my);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx, my);
    } else {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
  }

  function endStroke() {
    ctx.globalCompositeOperation = 'source-over';
    saveSnapshot();
    redoStack = [];
    if (currentChapterId) save(currentChapterId, currentPageNum);
    currentPath = [];
  }

  // ─────────────────────────────────────────────
  //  UNDO / REDO
  // ─────────────────────────────────────────────
  function saveSnapshot() {
    strokes.push(canvas.toDataURL('image/png'));
    if (strokes.length > MAX_UNDO + 1) strokes.shift();
  }

  function undo() {
    if (strokes.length <= 1) {
      if (strokes.length === 1) { redoStack.push(strokes.pop()); clearCanvas(false); }
      return;
    }
    redoStack.push(strokes.pop());
    restoreFromDataURL(strokes[strokes.length - 1]);
    if (currentChapterId) save(currentChapterId, currentPageNum);
  }

  function redo() {
    if (!redoStack.length) return;
    const snap = redoStack.pop();
    strokes.push(snap);
    restoreFromDataURL(snap);
    if (currentChapterId) save(currentChapterId, currentPageNum);
  }

  function restoreFromDataURL(dataURL) {
    const img = new Image();
    const dpr  = window.devicePixelRatio || 1;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      ctx.drawImage(img, 0, 0, canvas.width / dpr, canvas.height / dpr);
    };
    img.src = dataURL;
  }

  // ─────────────────────────────────────────────
  //  SAVE / LOAD (localStorage per chapter+page)
  // ─────────────────────────────────────────────
  function save(chId, pg) {
    try { localStorage.setItem(`atomica_notes_ch${chId}_p${pg}`, canvas.toDataURL('image/png')); }
    catch(e) { console.warn('save failed', e); }
  }

  function load(chId, pg) {
    try {
      const dpr  = window.devicePixelRatio || 1;
      const w    = canvas.width / dpr;
      const h    = canvas.height / dpr;
      const data = localStorage.getItem(`atomica_notes_ch${chId}_p${pg}`);
      ctx.clearRect(0, 0, w, h);
      if (data) {
        const img = new Image();
        img.onload = () => { ctx.clearRect(0,0,w,h); ctx.drawImage(img,0,0,w,h); strokes=[canvas.toDataURL()]; redoStack=[]; };
        img.src = data;
      } else {
        strokes = [canvas.toDataURL()]; redoStack = [];
      }
    } catch(e) { strokes=[]; redoStack=[]; }
  }

  function clearCanvas(saveState) {
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    if (saveState) {
      strokes = [canvas.toDataURL()]; redoStack = [];
      if (currentChapterId) save(currentChapterId, currentPageNum);
    }
  }

  // ─────────────────────────────────────────────
  //  SCRATCHPAD MODULE (separate canvas instance)
  // ─────────────────────────────────────────────
  let sCanvas=null, sCtx=null, sDrawing=false, sPath=[];
  let sTool='pen', sColor='#e53935', sSize=3;
  let sStrokes=[], sRedoStack=[], sShapePerfect=false;

  function initScratchpad(canvasId, toolbarId) {
    sCanvas = document.getElementById(canvasId);
    const toolbar = document.getElementById(toolbarId);
    if (!sCanvas || !toolbar) return;

    sCtx = sCanvas.getContext('2d');
    const wrap = sCanvas.parentElement;
    const dpr  = window.devicePixelRatio || 1;
    const w    = (wrap ? wrap.clientWidth - 8 : 700);
    const h    = (wrap ? Math.max(350, wrap.clientHeight - 8) : 400);

    sCanvas.width  = w * dpr; sCanvas.height = h * dpr;
    sCanvas.style.width = w+'px'; sCanvas.style.height = h+'px';
    sCtx.scale(dpr, dpr);
    sCtx.lineCap = 'round'; sCtx.lineJoin = 'round';
    sCtx.fillStyle = '#0d1117';
    sCtx.fillRect(0,0,w,h);

    buildScratchToolbar(toolbar);
    attachScratchEvents();
    sStrokes = [sCanvas.toDataURL()]; sRedoStack = [];
  }

  function resizeScratchpad() {
    if (!sCanvas || !sCtx) return;
    const wrap = sCanvas.parentElement;
    if (!wrap) return;
    const dpr  = window.devicePixelRatio || 1;
    const old  = sCanvas.toDataURL();
    const w    = wrap.clientWidth - 8;
    const h    = Math.max(350, wrap.clientHeight - 8);
    sCanvas.width=w*dpr; sCanvas.height=h*dpr;
    sCanvas.style.width=w+'px'; sCanvas.style.height=h+'px';
    sCtx.scale(dpr,dpr); sCtx.lineCap='round'; sCtx.lineJoin='round';
    sCtx.fillStyle='#0d1117'; sCtx.fillRect(0,0,w,h);
    const img=new Image(); img.onload=()=>sCtx.drawImage(img,0,0,w,h); img.src=old;
  }

  function buildScratchToolbar(toolbar) {
    toolbar.innerHTML = '';
    const mk=(txt,cls,fn)=>{ const b=document.createElement('button'); b.className='scratchpad-tool-btn '+(cls||''); b.innerHTML=txt; b.onclick=fn; return b; };

    const penBtn = mk('✏️ Pen','active',()=>{ sTool='pen';sSize=3; toolbar.querySelectorAll('.scratchpad-tool-btn').forEach(b=>b.classList.remove('active')); penBtn.classList.add('active'); });
    const eraserBtn = mk('🧹 Erase','',()=>{ sTool='eraser';sSize=20; toolbar.querySelectorAll('.scratchpad-tool-btn').forEach(b=>b.classList.remove('active')); eraserBtn.classList.add('active'); });
    const shapeBtn  = mk('🪄 Shapes',sShapePerfect?'active':'',()=>{ sShapePerfect=!sShapePerfect; shapeBtn.classList.toggle('active',sShapePerfect); });
    toolbar.appendChild(penBtn); toolbar.appendChild(eraserBtn); toolbar.appendChild(shapeBtn);

    const cWrap = document.createElement('div'); cWrap.style.cssText='display:flex;gap:5px;align-items:center;';
    COLORS.forEach(c=>{
      const sw=document.createElement('button');
      sw.style.cssText=`background:${c.hex};width:20px;height:20px;border-radius:50%;border:2px solid ${c.hex===sColor?'#fff':'transparent'};cursor:pointer;`;
      sw.onclick=()=>{ sColor=c.hex; sTool='pen'; sSize=3; cWrap.querySelectorAll('button').forEach(b=>{b.style.border='2px solid transparent';}); sw.style.border='2px solid #fff'; toolbar.querySelectorAll('.scratchpad-tool-btn').forEach(b=>b.classList.remove('active')); penBtn.classList.add('active'); };
      cWrap.appendChild(sw);
    }); toolbar.appendChild(cWrap);

    const undoBtn = mk('↩️ Undo','',()=>{ if(sStrokes.length<=1)return; sRedoStack.push(sStrokes.pop()); const img=new Image(); img.onload=()=>{sCtx.clearRect(0,0,sCanvas.width,sCanvas.height);sCtx.drawImage(img,0,0);}; img.src=sStrokes[sStrokes.length-1]; });
    const redoBtn = mk('↪️ Redo','',()=>{ if(!sRedoStack.length)return; const snap=sRedoStack.pop(); sStrokes.push(snap); const img=new Image(); img.onload=()=>{sCtx.clearRect(0,0,sCanvas.width,sCanvas.height);sCtx.drawImage(img,0,0);}; img.src=snap; });
    const clearBtn= mk('🗑️ Clear','',()=>{ const dpr=window.devicePixelRatio||1; sCtx.fillStyle='#0d1117'; sCtx.fillRect(0,0,sCanvas.width/dpr,sCanvas.height/dpr); sStrokes=[sCanvas.toDataURL()]; sRedoStack=[]; });
    const saveBtn = mk('📸 Save','',()=>{ const a=document.createElement('a'); a.download='atomica_rough_'+Date.now()+'.png'; a.href=sCanvas.toDataURL(); a.click(); });
    toolbar.appendChild(undoBtn); toolbar.appendChild(redoBtn); toolbar.appendChild(clearBtn); toolbar.appendChild(saveBtn);
  }

  function attachScratchEvents() {
    if (!sCanvas) return;
    const gp=(e)=>{ const r=sCanvas.getBoundingClientRect(); return {x:e.clientX-r.left,y:e.clientY-r.top}; };
    const gt=(e)=>{ const t=e.touches[0]||e.changedTouches[0]; const r=sCanvas.getBoundingClientRect(); return {x:t.clientX-r.left,y:t.clientY-r.top}; };

    function bs(pos) {
      sDrawing=true; sPath=[pos];
      sCtx.beginPath(); sCtx.moveTo(pos.x,pos.y);
      sCtx.globalCompositeOperation = sTool==='eraser'?'destination-out':'source-over';
      if(sTool!=='eraser') sCtx.strokeStyle=sColor;
      sCtx.lineWidth=sSize; sCtx.lineCap='round'; sCtx.lineJoin='round';
      sCtx.lineTo(pos.x+0.1,pos.y+0.1); sCtx.stroke();
    }
    function ms(pos) {
      if(!sDrawing)return; sPath.push(pos);
      if(sPath.length>=3){const l=sPath.length,p1=sPath[l-2],p2=sPath[l-1],mx=(p1.x+p2.x)/2,my=(p1.y+p2.y)/2; sCtx.quadraticCurveTo(p1.x,p1.y,mx,my); sCtx.stroke(); sCtx.beginPath(); sCtx.moveTo(mx,my);}
      else{sCtx.lineTo(pos.x,pos.y);sCtx.stroke();}
    }
    function es() {
      if(!sDrawing)return; sDrawing=false;
      sCtx.globalCompositeOperation='source-over';
      if(sShapePerfect&&sPath.length>5){recognizeShape();} else{sStrokes.push(sCanvas.toDataURL()); if(sStrokes.length>MAX_UNDO+1)sStrokes.shift(); sRedoStack=[];}
      sPath=[];
    }

    sCanvas.addEventListener('mousedown',e=>bs(gp(e)));
    sCanvas.addEventListener('mousemove',e=>ms(gp(e)));
    sCanvas.addEventListener('mouseup',es); sCanvas.addEventListener('mouseleave',es);
    sCanvas.addEventListener('touchstart',e=>{e.preventDefault();bs(gt(e));},{passive:false});
    sCanvas.addEventListener('touchmove', e=>{e.preventDefault();ms(gt(e));},{passive:false});
    sCanvas.addEventListener('touchend',  e=>{e.preventDefault();es();},{passive:false});
  }

  function recognizeShape() {
    const sp=sPath[0], ep=sPath[sPath.length-1];
    let len=0;
    for(let i=1;i<sPath.length;i++){const dx=sPath[i].x-sPath[i-1].x,dy=sPath[i].y-sPath[i-1].y;len+=Math.sqrt(dx*dx+dy*dy);}
    const sed=Math.sqrt(Math.pow(ep.x-sp.x,2)+Math.pow(ep.y-sp.y,2));
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    sPath.forEach(p=>{if(p.x<minX)minX=p.x;if(p.x>maxX)maxX=p.x;if(p.y<minY)minY=p.y;if(p.y>maxY)maxY=p.y;});
    const w=maxX-minX,h=maxY-minY,cx=minX+w/2,cy=minY+h/2;
    const closed=sed<Math.max(w,h)*0.45||sed<50;
    const prev=sStrokes[sStrokes.length-1];
    const img=new Image();
    img.onload=()=>{
      sCtx.clearRect(0,0,sCanvas.width,sCanvas.height); sCtx.drawImage(img,0,0);
      sCtx.beginPath(); sCtx.lineWidth=sSize; sCtx.strokeStyle=sColor; sCtx.lineCap='round'; sCtx.lineJoin='round';
      if(!closed){
        if(sed/len>0.82){sCtx.moveTo(sp.x,sp.y);sCtx.lineTo(ep.x,ep.y);}
        else{
          const ang=Math.atan2(ep.y-sp.y,ep.x-sp.x),hl=15,ha=Math.PI/6;
          sCtx.moveTo(sp.x,sp.y);sCtx.lineTo(ep.x,ep.y);
          sCtx.moveTo(ep.x,ep.y);sCtx.lineTo(ep.x-hl*Math.cos(ang-ha),ep.y-hl*Math.sin(ang-ha));
          sCtx.moveTo(ep.x,ep.y);sCtx.lineTo(ep.x-hl*Math.cos(ang+ha),ep.y-hl*Math.sin(ang+ha));
        }
      } else {
        const asp=w>0?w/h:1;
        if(asp>0.75&&asp<1.35){sCtx.arc(cx,cy,Math.max(w,h)/2,0,Math.PI*2);}
        else{sCtx.rect(minX,minY,w,h);}
      }
      sCtx.stroke();
      sStrokes.push(sCanvas.toDataURL()); if(sStrokes.length>MAX_UNDO+1)sStrokes.shift(); sRedoStack=[];
    };
    img.src=prev;
  }

  // ─────────────────────────────────────────────
  //  EXPORTS
  // ─────────────────────────────────────────────
  window.AtomicaSketchpad        = AtomicaSketchpad;
  window.initAtomicaScratchpad   = initScratchpad;
  window.resizeAtomicaScratchpad = resizeScratchpad;

})();
