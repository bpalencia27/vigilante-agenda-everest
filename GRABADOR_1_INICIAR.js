(()=>{const S=sessionStorage,K="vglrec_";const LIM=20000;const salta=/\.(png|jpg|jpeg|gif|css|woff2?|ttf|svg|ico)(\?|$)/i;
function put(k,o){try{S.setItem(k,JSON.stringify(o));}catch(e){try{o.resBody="[SIN ESPACIO]";S.setItem(k,JSON.stringify(o));}catch(e2){}}}
function nuevo(){let n=+(S.getItem(K+"n")||0)+1;S.setItem(K+"n",n);return K+"i"+n;}
if(window.__VGL2){alert("Ya estaba grabando en esta pestaña.");return;}
window.__VGL2=1;
const of=window.fetch;
window.fetch=function(...a){let u="",m="GET",b=null;try{u=typeof a[0]==="string"?a[0]:(a[0]&&a[0].url)||"";if(a[1]){m=a[1].method||"GET";b=typeof a[1].body==="string"?a[1].body:null;}}catch(e){}
 const k=salta.test(u)?null:nuevo();const base={v:"fetch",t:new Date().toISOString(),method:m,url:u,reqBody:b,status:0,resBody:""};
 if(k)put(k,base);
 return of.apply(this,a).then(r=>{if(k){base.status=r.status;put(k,base);try{r.clone().text().then(x=>{base.resBody=x.length>LIM?x.slice(0,LIM)+"...[CORTADO]":x;put(k,base);}).catch(()=>{});}catch(e){}}return r;})
  .catch(e=>{if(k){base.status=-1;base.resBody=String(e);put(k,base);}throw e;});};
const oo=XMLHttpRequest.prototype.open,os=XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open=function(m,u,...r){this.__m=m;this.__u=u;return oo.apply(this,[m,u,...r]);};
XMLHttpRequest.prototype.send=function(b){const u=this.__u||"";const k=salta.test(u)?null:nuevo();
 const base={v:"xhr",t:new Date().toISOString(),method:this.__m,url:u,reqBody:typeof b==="string"?b:null,status:0,resBody:""};
 if(k)put(k,base);
 if(k)this.addEventListener("readystatechange",function(){if(this.readyState===4){try{base.status=this.status;const x=this.responseText||"";base.resBody=x.length>LIM?x.slice(0,LIM)+"...[CORTADO]":x;put(k,base);}catch(e){}}});
 return os.apply(this,[b]);};
document.addEventListener("click",e=>{try{const el=e.target.closest("button,a,input,select,.btn,[role=button],li,td")||e.target;const tx=(el.innerText||el.value||el.title||"").trim().slice(0,90);if(tx||el.id)put(nuevo(),{v:"click",t:new Date().toISOString(),tag:el.tagName.toLowerCase()+(el.id?"#"+el.id:""),text:tx.replace(/\n/g," ")});}catch(x){}},true);
console.log("%c● GRABANDO (sobrevive a recargas) — al terminar pega el CÓDIGO 2","color:#e54d42;font-size:15px;font-weight:bold");
alert("● GRABANDO\n\nYa guarda en el navegador: aunque la página se recargue NO se pierde.\n\nHaz la acción completa. Al terminar, pega el CÓDIGO 2 para descargar.\n\nGrabado hasta ahora: "+(+(S.getItem(K+"n")||0))+" registros.");})()
