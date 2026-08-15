const fs=require("fs");
// ---- Hoja de cálculo simulada, mínima pero fiel a lo que usa el .gs ----
class Hoja{
  constructor(n){this.n=n;this.d=[];}
  appendRow(r){this.d.push(r.slice());}
  getLastRow(){return this.d.length;}
  getLastColumn(){return this.d.reduce((m,r)=>Math.max(m,r.length),0);}
  getDataRange(){return {getValues:()=>this.d.map(r=>r.slice())};}
  getRange(f,c,nf,nc){const self=this;return{
    getValues(){const o=[];for(let i=0;i<nf;i++){const fila=self.d[f-1+i]||[];const s=[];for(let j=0;j<nc;j++)s.push(fila[c-1+j]===undefined?"":fila[c-1+j]);o.push(s);}return o;},
    setValues(v){for(let i=0;i<v.length;i++){const idx=f-1+i;if(!self.d[idx])self.d[idx]=[];for(let j=0;j<v[i].length;j++)self.d[idx][c-1+j]=v[i][j];}}
  };}
  setFrozenRows(){}
  clear(){this.d=[];}
  deleteRow(i){this.d.splice(i-1,1);}
}
const hojas={};
const ss={getSheetByName:n=>hojas[n]||null,insertSheet:n=>(hojas[n]=new Hoja(n))};
const cache={};
global.SpreadsheetApp={getActiveSpreadsheet:()=>ss,getActive:()=>({toast:(m)=>console.log("TOAST:",m)}),getUi:()=>{throw new Error("sin ui")}};
global.CacheService={getScriptCache:()=>({get:k=>cache[k]||null,put:(k,v)=>{cache[k]=v;}})};
global.ContentService={createTextOutput:s=>({t:s,setMimeType(){return this;}}),MimeType:{TEXT:"text"}};
eval(fs.readFileSync("/workspace/vigilante-agenda-everest/TABLERO/Codigo.gs","utf8"));
const post=o=>doPost({postData:{contents:JSON.stringify(o)}}).t;
const base={token:"vgl-2026",equipo:"eq-a1b2c3",ver:"12.6.9",dia:"2026-08-12"};

// 1) hoja "uso" preexistente SIN la columna lote (como la Hoja real hoy)
hojas["uso"]=new Hoja("uso");
hojas["uso"].appendRow(["recibido","ts","dia","equipo","ver","deDia","desde","n","acciones"]);
hojas["uso"].appendRow([new Date(),"2026-08-11T21:57:05.318Z","2026-08-11","","12.5.2003","2026-08-11","x",21,"{}"]);

console.log("ux        :",post({...base,evento:"ux",ts:"2026-08-12T16:00:00Z",lote:"L1",deDia:"2026-08-12",desde:"d",n:999,acciones:JSON.stringify({"panel.labs.abrir":6,"mala CLAVE!":3,"cero":0})}));
console.log("ux reenvío:",post({...base,evento:"ux",ts:"2026-08-12T16:00:00Z",lote:"L1",deDia:"2026-08-12",desde:"d",n:999,acciones:"{}"}));
console.log("error     :",post({...base,evento:"error",ts:"t2",lote:"L2",origen:"js",msg:'falló con "paciente" 21545051 en https://neps.everestintelligent.com/x',donde:"vigilante.user.js:9"}));
console.log("entorno   :",post({...base,evento:"entorno",ts:"t3",lote:"L3",nav:"Edge",so:"Windows 10/11",zona:"America/Bogota",pantalla:"1920x1080",gestor:"Tampermonkey"}));
console.log("evento raro:",post({...base,evento:"loquesea",lote:"L4"}));
console.log("token malo :",post({...base,token:"x",evento:"ux",lote:"L5"}));
console.log("formula    :",post({...base,evento:"fraude",ts:"t4",lote:"L6",hora:"=SUM(A1:A9)",min:3}));

console.log("\n-- encabezado uso (migrado):",hojas["uso"].d[0].join(" | "));
console.log("-- fila ux :",hojas["uso"].d[2].join(" | "));
console.log("-- error   :",hojas["error"].d[1].join(" | "));
console.log("-- entorno :",hojas["entorno"].d[1].join(" | "));
console.log("-- fraude  :",hojas["fraude"].d[1].join(" | "));

// 2) duplicado histórico (mismo ts/payload, distinto "recibido")
hojas["uso"].appendRow([new Date(2020,1,1),"2026-08-11T21:57:05.318Z","2026-08-11","","12.5.2003","2026-08-11","x",21,"{}"]);
const antes=hojas["uso"].getLastRow();
limpiarDuplicados();
console.log("filas uso antes/después:",antes,"->",hojas["uso"].getLastRow());

armarResumen();
const rf=hojas["resumen_flota"].d;
console.log("\n"+rf[0][0]);
console.log(rf[1].join(" | "));
rf.slice(2,6).forEach(r=>console.log(r.join(" | ")));
