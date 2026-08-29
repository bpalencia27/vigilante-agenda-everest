(()=>{const S=sessionStorage,K="vglrec_";const n=+(S.getItem(K+"n")||0);
if(!n){alert("No hay nada grabado en esta pestaña.\n\n¿Pegaste el CÓDIGO 1 antes de hacer la acción?");return;}
// Redacción antes de guardar/descargar — regla del proyecto (CLAUDE.md, "Cero PHI"): esta
// captura sale del navegador como archivo, así que se tacha lo que tiene FORMA reconocible
// (correo, teléfono, dirección, fecha, cédula/documento) igual que scrubPII() del script
// principal. Lo que NO tiene forma —un nombre propio escrito a mano— esta redacción NO
// puede reconocerlo (scrubPII tampoco puede, es una limitación conocida): por eso la
// instrucción de uso es abrir una historia YA GUARDADA sin escribir nada nuevo, nunca
// escribir un nombre real mientras se graba.
function scrubPII(s){
  if (s==null) return s;
  let str = String(s);
  str = str.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[CORREO_CENSURADO]");
  str = str.replace(/(?:Av(?:enida)?\s+El\s+Dorado(?:\s*#\s*[\d-]+)?|\b(?:Calle|Cra|Carrera|Cl|Diag|Diagonal|Transv|Transversal|Av|Avenida)\s+\d+\s*(?:#|No\.?|Número)\s*[\d-]+|\b(?:Calle|Cra|Carrera|Cl|Diag|Diagonal|Transv|Transversal|Av|Avenida)\s+#\s*[\d-]+|\b(?:Mz|Manzana)\s+\d+\s+Casa\s+\d+|\b(?:Barrio|Vereda)\s+(?:[\wáéíóúÁÉÍÓÚñÑ.-]+\s+)+[\d-]+)/gi, "[DIR_CENSURADA]");
  str = str.replace(/(?:\+57\s*)?(?:\(?[368]\d{2}\)?[\s.-]*\d{3}[\s.-]*\d{4}|\b[368]\d{9}\b)/g, "[TEL_CENSURADO]");
  str = str.replace(/\b(?:\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g, "[FECHA_CENSURADA]");
  str = str.replace(/\b\d{1,2}\s+(?:de\s+)?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+(?:del?\s+)?\d{2,4})?\b/gi, "[FECHA_CENSURADA]");
  str = str.replace(/\b\d{1,3}(?:[\s.-]\d{3}){1,3}\b/g, "[CENSURADO]");
  str = str.replace(/(?<=\b(?:CC|TI|CE|PPT|Doc|Documento|Cédula|Cedula|Identificación|Identificacion)\s+)\d{5,11}\b/gi, "[CENSURADO]");
  str = str.replace(/(?<=\b|_)\d{6,11}(?=\b|_)/g, "[CENSURADO]");
  return str;
}
function scrubReg(x){
  const y={...x};
  for (const k of ["reqBody","resBody","text","html","url"]) if (y[k]!=null) y[k]=scrubPII(y[k]);
  return y;
}
const reg=[];for(let i=1;i<=n;i++){const v=S.getItem(K+"i"+i);if(!v)continue;try{reg.push(JSON.parse(v));}catch(e){}}
const red=reg.filter(x=>x.v==="fetch"||x.v==="xhr").map(scrubReg),clicks=reg.filter(x=>x.v==="click").map(scrubReg),inputs=reg.filter(x=>x.v==="input").map(scrubReg);
const T={inicio:reg.length?reg[0].t:null,url0:scrubPII(location.href),network:red,clicks:clicks,inputs:inputs};
const a=document.createElement("a");
a.href=URL.createObjectURL(new Blob([JSON.stringify(T,null,1)],{type:"application/json"}));
const d=new Date(),p=x=>String(x).padStart(2,"0");
a.download="captura_"+d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+"_"+p(d.getHours())+p(d.getMinutes())+".json";
document.body.appendChild(a);a.click();a.remove();
const conCuerpo=red.filter(x=>x.reqBody).length;
if(confirm("Descargado.\n\nLlamadas: "+red.length+"\nCon datos enviados: "+conCuerpo+"\nClics: "+clicks.length+"\nCasillas escritas: "+inputs.length+"\n\n¿Borrar lo grabado para empezar de cero?")){
  for(let i=1;i<=n;i++)S.removeItem(K+"i"+i);S.removeItem(K+"n");
  alert("Borrado. Para grabar otra cosa, pega otra vez el CÓDIGO 1.");
}})()
