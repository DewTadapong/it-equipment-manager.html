'use strict';
/* template.js - TPL data model + buildPrintHTML */
const TPL={
  bgSrc: DEFAULT_IMG,       // current background image data URI
  fields: [],               // [{id, label, path, x, y, fs, mw, v}]  — placed fields on canvas

  fromSaved(saved){
    if(!saved)return;
    if(saved.bgSrc)this.bgSrc=saved.bgSrc;
    if(saved.fields&&Array.isArray(saved.fields))this.fields=saved.fields;
  },
  toJSON(){return{bgSrc:this.bgSrc,fields:this.fields};},

  getField(id){return this.fields.find(f=>f.id===id);},
  isPlaced(id){return!!this.getField(id);},

  addField(fieldDef, x, y){
    if(this.isPlaced(fieldDef.id))return; // already placed
    const def=DEFAULT_PLACEMENTS[fieldDef.id]||{x:10,y:10,fs:12,mw:20,v:1};
    this.fields.push({
      id:fieldDef.id, label:fieldDef.label, path:fieldDef.path,
      x: x!==undefined ? x : def.x,
      y: y!==undefined ? y : def.y,
      fs: def.fs, mw: def.mw, v: def.v!==undefined ? def.v : 1
    });
  },
  removeField(id){this.fields=this.fields.filter(f=>f.id!==id);},
  reset(){
    this.bgSrc=DEFAULT_IMG;
    this.fields=[];
    // place all fields from DEFAULT_PLACEMENTS
    ALL_FIELDS.forEach(fd=>{
      const def=DEFAULT_PLACEMENTS[fd.id];
      if(def){
        this.fields.push({id:fd.id,label:fd.label,path:fd.path,
          x:def.x,y:def.y,fs:def.fs,mw:def.mw,v:def.v!==undefined?def.v:1});
      }
    });
  }
};

/* ── TEMPLATE DESIGNER ── */