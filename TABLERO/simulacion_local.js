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
eval(fs.readFileSync(require("path").join(__dirname, "Codigo.gs"), "utf8"));
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

// v17.49.0 — El lote NO puede quemarse si la escritura falla. Antes, el `cache.put`
// ocurria junto al `cache.get`, asi que un fallo de la Hoja dejaba el lote marcado seis
// horas: el reintento del userscript recibia "dup" (que para el cliente es entrega buena)
// y la fila se perdia sin haberse escrito nunca.
(function pruebaEscrituraFallida(){
  const hojaOk = hojas["fraude"];
  hojas["fraude"] = { appendRow(){ throw new Error("cuota de Apps Script agotada"); } };
  const r1 = post({...base,evento:"fraude",ts:"t9",lote:"L7",hora:"07:00",min:5});
  hojas["fraude"] = hojaOk;
  const r2 = post({...base,evento:"fraude",ts:"t9",lote:"L7",hora:"07:00",min:5});
  const escritas = hojas["fraude"].d.filter(f=>f.indexOf("L7")>=0).length;
  console.log("escritura fallida :",r1,"(debe ser err)");
  console.log("reintento del mismo lote:",r2,"(debe ser ok, NO dup)");
  console.log("filas L7 en la hoja:",escritas,"(debe ser 1: la evidencia no se perdio)");
  if(r1!=="err"||r2!=="ok"||escritas!==1){console.error("FALLA: el lote se quemo sin escribir la fila");process.exitCode=1;}
})();

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

// =====================================================================
// v18.1.0 — B2: lista de acceso por GET (?accion=listaAcceso&token=...)
// y evento "acceso" (descubrimiento de uids). Pruebas de puntas a puntas
// contra el .gs REAL vía eval, sin mocks del código bajo prueba.
// =====================================================================
const get=q=>doGet({parameter:q}).t;
(function pruebaListaAcceso(){
  const fallos=[];
  // 1) puertas: token o accion malos NUNCA revelan la lista
  const tMalo=get({accion:"listaAcceso",token:"incorrecto"});
  const aMala=get({accion:"otraCosa",token:"vgl-2026"});
  const sinNada=get({});
  console.log("\ntoken malo :",tMalo,"(debe ser no)");
  console.log("accion mala:",aMala,"(debe ser no)");
  console.log("sin params :",sinNada,"(debe ser no)");
  if(tMalo!=="no"||aMala!=="no"||sinNada!=="no")fallos.push("puertas doGet");

  // 2) siembra: primera lectura crea la hoja con 4 comentarios + 8 nombres
  const j1=JSON.parse(get({accion:"listaAcceso",token:"vgl-2026"}));
  console.log("ok         :",j1.ok,"(debe ser true)");
  console.log("perfiles   : COMPLETO=%s LABORATORIOS=%s (deben ser 5 y 3)",j1.perfiles.COMPLETO.length,j1.perfiles.LABORATORIOS.length);
  console.log("filas hoja acceso:",hojas["acceso"].d.length,"(debe ser 13: encabezado+4#+8)");
  if(!j1.ok)fallos.push("ok!==true");
  if(j1.perfiles.COMPLETO.length!==5||j1.perfiles.LABORATORIOS.length!==3)fallos.push("siembra 5/3");
  if(hojas["acceso"].d.length!==13)fallos.push("siembra filas");
  const glo=j1.perfiles.COMPLETO.filter(p=>p.nombre.indexOf("Jaramillo")>=0)[0];
  console.log("nueva autorizada:",glo?glo.nombre+" #"+glo.uid:"NO ESTÁ","(debe estar: Dra. Gloria Alejandra Jaramillo Montoya)");
  if(!glo)fallos.push("Gloria Jaramillo no quedó en el padrón COMPLETO");

  // 3) uids sintéticos: enteros en [900000000, 999999998] (jamás uid real)
  const todos=j1.perfiles.COMPLETO.concat(j1.perfiles.LABORATORIOS);
  const uidOk=todos.every(p=>Number.isInteger(p.uid)&&p.uid>=900000000&&p.uid<=999999998);
  console.log("uids sintéticos en rango 9xx:",uidOk,"ej:",todos[0].uid,todos[7].uid);
  if(!uidOk)fallos.push("uids sintéticos fuera de rango");

  // 4) version = hash de CONTENIDO: dos lecturas sin editar, misma version
  const j2=JSON.parse(get({accion:"listaAcceso",token:"vgl-2026"}));
  console.log("version estable:",j1.version===j2.version,j1.version,"(debe ser true)");
  if(j1.version!==j2.version)fallos.push("version inestable");

  // 5) editar a "bloqueado" cambia la version y llena la blocklist con motivo
  //    (fila 6 de la hoja = d[5] = Brandon, primer nombre del padrón)
  const uidBrandon=todos[0].uid;
  hojas["acceso"].d[5][3]="bloqueado";
  hojas["acceso"].d[5][4]="vacaciones";
  const j3=JSON.parse(get({accion:"listaAcceso",token:"vgl-2026"}));
  const bl=j3.blocklist[0];
  console.log("version cambió:",j3.version!==j1.version,"(debe ser true)");
  console.log("blocklist   :",JSON.stringify(bl));
  if(j3.version===j1.version)fallos.push("bloqueado no cambia version");
  if(j3.perfiles.COMPLETO.length!==4)fallos.push("bloqueado no sale del perfil");
  if(!bl||bl.uid!==uidBrandon||bl.motivo!=="vacaciones")fallos.push("blocklist mal");

  // 6) uid REAL en la hoja manda sobre el sintético
  hojas["acceso"].d[6][1]=21545051001; // Eliseth con uid real de 11 dígitos
  const j4=JSON.parse(get({accion:"listaAcceso",token:"vgl-2026"}));
  const eli=j4.perfiles.COMPLETO.filter(p=>p.nombre.indexOf("Eliseth")>=0)[0];
  console.log("uid real manda:",eli.uid,"(debe ser 21545051001)");
  if(!eli||eli.uid!==21545051001)fallos.push("uid real ignorado");

  // 7) evento "acceso" escribe la hoja acceso_uid (sin PHI: solo uid/nombre/perfil)
  const rAcc=post({...base,evento:"acceso",ts:"t10",lote:"L8",uid:123456789,nombre:"Brandon Jesús Palencia Martínez",perfil:"COMPLETO"});
  const filaAcc=hojas["acceso_uid"]&&hojas["acceso_uid"].d[1];
  console.log("evento acceso:",rAcc,"(debe ser ok)");
  console.log("acceso_uid  :",(filaAcc||[]).join(" | "));
  if(rAcc!=="ok"||!filaAcc||filaAcc[6]!==123456789||filaAcc[8]!=="COMPLETO")fallos.push("evento acceso");

  // 8) B6 — evento "acceso_deneg": el tablero lo ACEPTA (EVENTOS_VALIDOS) y lo
  //    archiva en la hoja "acceso_deneg" con las cuentas RE-SANEADAS: la clave con
  //    11 dígitos debe perderlos (nunca una cédula en la Hoja) y las válidas pasar.
  const rDen=post({...base,evento:"acceso_deneg",ts:"t11",lote:"L9",uid:201,perfil:"LABORATORIOS",
    cuentas:{redactor_ia:2,rcv:1,panel_paciente:1,mala_con_12345678901:3}});
  const filaDen=hojas["acceso_deneg"]&&hojas["acceso_deneg"].d[1];
  console.log("evento acceso_deneg:",rDen,"(debe ser ok)");
  console.log("acceso_deneg      :",(filaDen||[]).join(" | "));
  let cDen=null;
  try{cDen=filaDen&&JSON.parse(filaDen[8]);}catch(e){cDen=null;}
  if(rDen!=="ok"||!filaDen||filaDen[6]!==201||filaDen[7]!=="LABORATORIOS")fallos.push("evento acceso_deneg");
  if(!cDen||cDen.redactor_ia!==2||cDen.rcv!==1||cDen.panel_paciente!==1)fallos.push("cuentas saneadas");
  if(cDen&&cDen.mala_con_12345678901!==undefined)fallos.push("digitos largos sobrevivieron");

  if(fallos.length){console.error("FALLA B2/B6 servidor:",fallos.join(" | "));process.exitCode=1;}
  else console.log("B2/B6 servidor: TODO OK");
})();
