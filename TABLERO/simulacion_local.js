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

  // 9) v18.3.5 (hallazgo B4/N8) — el perfil se lee IGNORANDO mayúsculas/minúsculas:
  //    la Hoja la edita el dueño a mano y "completo"/"Laboratorios" son el mismo
  //    perfil. Sin la normalización la fila quedaba mal clasificada EN SILENCIO
  //    (ignorada como perfil desconocido). Nombres SYN-*: cero PHI.
  hojas["acceso"].appendRow(["completo","","SYN Prueba Perfil Minuscula","activo",""]);
  const j5=JSON.parse(get({accion:"listaAcceso",token:"vgl-2026"}));
  const synMin=j5.perfiles.COMPLETO.filter(p=>p.nombre==="SYN Prueba Perfil Minuscula")[0];
  console.log("perfil minúscula :",!!synMin,"(debe ser true: 'completo' clasifica como COMPLETO)");
  if(!synMin)fallos.push("perfil en minúscula ignorado");

  // 10) v18.3.5 (hallazgo B4/N8) — estado "inactivo" revoca igual que "bloqueado":
  //    antes un médico marcado "inactivo" quedaba ACTIVO en el padrón (solo se
  //    entendía "bloqueado" exacto) y el cliente lo seguía tratando como LABORATORIOS.
  hojas["acceso"].appendRow(["Laboratorios","","SYN Prueba Estado Inactivo","inactivo",""]);
  const j6=JSON.parse(get({accion:"listaAcceso",token:"vgl-2026"}));
  const synIna=j6.blocklist.filter(p=>p.nombre==="SYN Prueba Estado Inactivo")[0];
  const synInaActivo=j6.perfiles.LABORATORIOS.filter(p=>p.nombre==="SYN Prueba Estado Inactivo").length>0;
  console.log("estado inactivo :",!!synIna&&!synInaActivo,"(debe ser true: 'inactivo' va a blocklist y sale de LABORATORIOS)");
  if(!synIna)fallos.push("estado inactivo no revoca");
  if(synInaActivo)fallos.push("estado inactivo quedó ACTIVO en el perfil");

  if(fallos.length){console.error("FALLA B2/B6 servidor:",fallos.join(" | "));process.exitCode=1;}
  else console.log("B2/B6 servidor: TODO OK");
})();

// =====================================================================
// v18.4.0 — ALERTAS DEL TABLERO. revisarAlertas()/calcularAlertas() contra
// el .gs REAL: un equipo enfermo (canal mudo + tormenta + api degradada), un
// equipo con salto súbito tras historia tranquila (z-score), un equipo sano
// que no dispara nada, el reenvío del MISMO lote que no infla conteos, y el
// dedup de la hoja "alertas" al repetir la revisión.
// =====================================================================
(function pruebaAlertas(){
  const fallos=[];
  // Sembrar por NOMBRE de columna: el orden del encabezado de "uso" ya migró
  // (v12.10.13) y escribir posiciones a ciegas es justo el defecto que esa
  // migración cerró.
  const hdUso=hojas["uso"].d[0];
  const filaUso=(vals)=>{const r=[];for(let i=0;i<hdUso.length;i++)r.push(vals[hdUso[i]]!==undefined?vals[hdUso[i]]:"");hojas["uso"].appendRow(r);};
  const ventana=(eq,dia,lote,acc)=>filaUso({equipo:eq,deDia:dia,lote:lote,acciones:JSON.stringify(acc)});

  // 1) equipo ENFERMO, un solo día, todo lo que hubo el 27-ago en miniatura:
  //    errores detectados sin entrega (canal mudo), 18 huellas (tormenta) y un
  //    endpoint con 83 % de fallos (api-degradada).
  const D="2026-09-05";
  ventana("eq-alerta1",D,"AL1",{"error.js":30,"error.api":2,"error.promesa":1,
    "error.distintos":18,"api.buscarpaciente.err":25,"api.buscarpaciente.ok":5,"rum.page.inp.poor":9});
  // reenvío del MISMO lote: no puede duplicar los conteos (lección del export real)
  ventana("eq-alerta1",D,"AL1",{"error.js":30,"error.api":2,"error.promesa":1,
    "error.distintos":18,"api.buscarpaciente.err":25,"api.buscarpaciente.ok":5,"rum.page.inp.poor":9});

  // 2) equipo con HISTORIA tranquila (7 días, 2..4 errores) y salto súbito hoy.
  //    entregados=20 y api sano: SOLO debe disparar la anomalía por z-score.
  const iso=(dt)=>dt.getFullYear()+"-"+String(dt.getMonth()+1).padStart(2,"0")+"-"+String(dt.getDate()).padStart(2,"0");
  [2,3,2,4,3,2,3].forEach((n,i)=>{
    const dt=new Date(2026,8,5); dt.setDate(dt.getDate()-(7-i));   // 2026-08-29 .. 2026-09-04
    ventana("eq-alerta2",iso(dt),"ALZ"+i,{"error.js":n,"error.entregado":n,"error.distintos":n,"api.buscarpaciente.ok":50});
  });
  ventana("eq-alerta2",D,"ALZ9",{"error.js":20,"error.entregado":20,"error.distintos":4,"api.buscarpaciente.ok":50});

  // 3) equipo SANO: errores que se detectan y se entregan, api sana. Cero filas.
  ventana("eq-sano",D,"ALS1",{"error.js":2,"error.entregado":2,"error.distintos":2,
    "api.buscarpaciente.ok":100,"api.buscarpaciente.err":1});

  revisarAlertas();
  const hA=hojas["alertas"];
  const filasA=hA?hA.d.slice(1):[];
  const tiposDe=(eq)=>filasA.filter(r=>r[2]===eq).map(r=>r[3]);
  console.log("\n-- alertas ("+filasA.length+" filas):");
  filasA.forEach(r=>console.log("   "+r[1]+" | "+r[2]+" | "+r[3]+" | "+r[4]+" | "+r[5]));

  const t1=tiposDe("eq-alerta1"), t2=tiposDe("eq-alerta2"), t3=tiposDe("eq-sano");
  if(t1.indexOf("canal-mudo")<0)fallos.push("canal-mudo no disparó");
  else{
    const cm=filasA.find(r=>r[2]==="eq-alerta1"&&r[3]==="canal-mudo");
    if(!/33 errores/.test(String(cm[5])))fallos.push("canal-mudo contó "+cm[5]+" (33 esperados: ¿dedup por lote roto?)");
  }
  if(t1.indexOf("tormenta")<0)fallos.push("tormenta no disparó");
  if(t1.indexOf("api-degradada")<0)fallos.push("api-degradada no disparó");
  if(t2.indexOf("anomalia")<0)fallos.push("anomalia (z-score) no disparó");
  if(t2.indexOf("canal-mudo")>=0||t2.indexOf("tormenta")>=0)fallos.push("equipo con entrega sana disparó canal-mudo/tormenta");
  if(t3.length)fallos.push("equipo sano disparó: "+t3.join(","));

  // 4) dedup: repetir la revisión NO reescribe las mismas alertas.
  revisarAlertas();
  const filasB=hojas["alertas"].d.slice(1);
  if(filasB.length!==filasA.length)fallos.push("re-visión duplicó filas: "+filasA.length+" -> "+filasB.length);

  if(fallos.length){console.error("FALLA alertas:",fallos.join(" | "));process.exitCode=1;}
  else console.log("alertas v18.4: TODO OK");
})();

// =====================================================================
// v18.4.6 — DEDUP POR LOTE en armarResumen. El export real del 07-sep trajo
// 10.042 filas de reenvío en "uso" (54 %): sin dedup, «Reportes» y «Acciones
// de uso (ux, acum.)» del tablero de flota salían inflados ~2,2×. Aquí se
// siembra un equipo con un lote repetido y uno único, y se comprueba la fila
// del resumen de flota contra el .gs REAL.
// =====================================================================
(function pruebaResumenDedup(){
  const fallos=[];
  const hdUso2=hojas["uso"].d[0];
  const filaUso2=(vals)=>{const r=[];for(let i=0;i<hdUso2.length;i++)r.push(vals[hdUso2[i]]!==undefined?vals[hdUso2[i]]:"");hojas["uso"].appendRow(r);};
  const ventana2=(lote,n)=>filaUso2({equipo:"eq-dedup",ver:"18.4.6",lote:lote,deDia:"2026-09-07",n:n,acciones:"{}"});
  ventana2("DX1",100);
  ventana2("DX1",100);   // reenvío del MISMO lote (lo que el export real mostró)
  ventana2("DX2",7);

  armarResumen();
  const rf=hojas["resumen_flota"].d;
  const hd=rf[1];
  const filaEq=rf.find(r=>r[0]==="eq-dedup");
  const col=(n)=>hd.indexOf(n);
  const acum=Number(filaEq[col("Acciones de uso (ux, acum.)")]);
  const reportes=Number(filaEq[col("Reportes")]);
  console.log("\n-- dedup armarResumen: acum="+acum+" (debe ser 107) · reportes="+reportes+" (debe ser 2)");
  if(acum!==107)fallos.push("ux acum con dup: obtuvo "+acum+" (107 esperados: el reenvío del lote DX1 no debe contar)");
  if(reportes!==2)fallos.push("reportes con dup: obtuvo "+reportes+" (2 esperados)");

  if(fallos.length){console.error("FALLA dedup resumen:",fallos.join(" | "));process.exitCode=1;}
  else console.log("dedup armarResumen v18.4.6: TODO OK");
})();
