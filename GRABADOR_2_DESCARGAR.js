(()=>{const S=sessionStorage,K="vglrec_";const n=+(S.getItem(K+"n")||0);
if(!n){alert("No hay nada grabado en esta pestaña.\n\n¿Pegaste el CÓDIGO 1 antes de hacer la acción?");return;}
const reg=[];for(let i=1;i<=n;i++){const v=S.getItem(K+"i"+i);if(!v)continue;try{reg.push(JSON.parse(v));}catch(e){}}
const red=reg.filter(x=>x.v==="fetch"||x.v==="xhr"),clicks=reg.filter(x=>x.v==="click"),inputs=reg.filter(x=>x.v==="input");
const T={inicio:reg.length?reg[0].t:null,url0:location.href,network:red,clicks:clicks,inputs:inputs};
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
