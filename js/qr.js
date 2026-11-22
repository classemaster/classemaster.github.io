/* Générateur de code QR (mode octets, niveau de correction M, versions 1 à 10) : suffit pour un lien parent.
   Écrit pour Classe Master ; aucune dépendance. QR(texte) renvoie une matrice de booléens, QRsvg(texte,px) un dessin SVG. */
var QR=(function(){
  var ECC=[10,16,26,18,24,16,18,22,22,26],NB=[1,1,1,2,2,4,4,4,5,5];   /* niveau M : octets de correction et blocs par version */
  function raw(v){var r=(16*v+128)*v+64;if(v>=2){var a=Math.floor(v/7)+2;r-=(25*a-10)*a-55;if(v>=7)r-=36;}return r;}
  function dataCap(v){return Math.floor(raw(v)/8)-ECC[v-1]*NB[v-1];}
  var EXP=[],LOG=[];(function(){var x=1;for(var i=0;i<255;i++){EXP[i]=x;LOG[x]=i;x<<=1;if(x&256)x^=0x11D;}for(i=255;i<512;i++)EXP[i]=EXP[i-255];})();
  function mul(a,b){return a&&b?EXP[LOG[a]+LOG[b]]:0;}
  function gen(d){var g=[1],i,j;for(i=0;i<d;i++){var n=[];n=new Array(g.length+1).fill(0);for(j=0;j<g.length;j++){n[j]^=g[j];n[j+1]^=mul(g[j],EXP[i]);}g=n;}return g;}
  function rs(data,d){var g=gen(d),r=new Array(d).fill(0);data.forEach(function(b){var f=b^r[0];r.shift();r.push(0);if(f)for(var i=0;i<d;i++)r[i]^=mul(g[i+1],f);});return r;}
  function bytes(s){return Array.prototype.slice.call(new TextEncoder().encode(s));}
  function encode(text){
    var b=bytes(text),v;
    for(v=1;v<=10;v++){var cc=v<10?8:16;if(4+cc+b.length*8<=dataCap(v)*8)break;}
    if(v>10)throw new Error("Texte trop long");
    var bits=[];function put(x,n){for(var i=n-1;i>=0;i--)bits.push((x>>>i)&1);}
    put(4,4);put(b.length,v<10?8:16);b.forEach(function(x){put(x,8);});
    var cap=dataCap(v)*8;put(0,Math.min(4,cap-bits.length));while(bits.length%8)bits.push(0);
    var d=[];for(var i=0;i<bits.length;i+=8){var o=0;for(var k=0;k<8;k++)o=o<<1|bits[i+k];d.push(o);}
    for(var p=0xEC;d.length<dataCap(v);p^=0xEC^0x11)d.push(p);
    var nb=NB[v-1],ec=ECC[v-1],rc=Math.floor(raw(v)/8),sl=Math.floor(rc/nb),ns=nb-rc%nb,blocks=[],pos=0;
    for(i=0;i<nb;i++){var len=sl-ec+(i<ns?0:1),dat=d.slice(pos,pos+len);pos+=len;var e=rs(dat,ec);if(i<ns)dat.push(0);blocks.push(dat.concat(e));}
    var out=[];for(i=0;i<blocks[0].length;i++)blocks.forEach(function(bl,j){if(i!==sl-ec||j>=ns)out.push(bl[i]);});
    return{v:v,data:out};
  }
  function build(text){
    var enc=encode(text),v=enc.v,n=v*4+17,M=[],F=[],y,x;
    for(y=0;y<n;y++){M.push(new Array(n).fill(false));F.push(new Array(n).fill(false));}
    function set(x,y,dark){M[y][x]=!!dark;F[y][x]=true;}
    for(var i=0;i<n;i++){set(6,i,i%2===0);set(i,6,i%2===0);}
    function finder(cx,cy){for(var dy=-4;dy<=4;dy++)for(var dx=-4;dx<=4;dx++){var d=Math.max(Math.abs(dx),Math.abs(dy)),xx=cx+dx,yy=cy+dy;if(xx>=0&&xx<n&&yy>=0&&yy<n)set(xx,yy,d!==2&&d!==4);}}
    finder(3,3);finder(n-4,3);finder(3,n-4);
    var al=[];if(v>1){var na=Math.floor(v/7)+2,step=Math.ceil((v*4+4)/(na*2-2))*2;al=[6];for(var p=n-7;al.length<na;p-=step)al.splice(1,0,p);}
    al.forEach(function(a,i){al.forEach(function(b,j){if((i===0&&j===0)||(i===0&&j===al.length-1)||(i===al.length-1&&j===0))return;for(var dy=-2;dy<=2;dy++)for(var dx=-2;dx<=2;dx++)set(a+dx,b+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);});});
    function fmt(mask){
      var data=(0<<3)|mask,rem=data;for(var i=0;i<10;i++)rem=(rem<<1)^((rem>>>9)*0x537);
      var bits=((data<<10)|rem)^0x5412,g=function(i){return((bits>>>i)&1)!==0;};
      for(i=0;i<=5;i++)set(8,i,g(i));set(8,7,g(6));set(8,8,g(7));set(7,8,g(8));for(i=9;i<15;i++)set(14-i,8,g(i));
      for(i=0;i<8;i++)set(n-1-i,8,g(i));for(i=8;i<15;i++)set(8,n-15+i,g(i));set(8,n-8,true);
    }
    fmt(0);
    if(v>=7){var rem=v;for(i=0;i<12;i++)rem=(rem<<1)^((rem>>>11)*0x1F25);var vb=(v<<12)|rem;for(i=0;i<18;i++){var bt=((vb>>>i)&1)!==0,a=n-11+i%3,b2=Math.floor(i/3);set(a,b2,bt);set(b2,a,bt);}}
    var k=0,tot=enc.data.length*8;
    for(var r=n-1;r>=1;r-=2){if(r===6)r=5;for(var vt=0;vt<n;vt++)for(var j=0;j<2;j++){x=r-j;var up=((r+1)&2)===0;y=up?n-1-vt:vt;if(!F[y][x]&&k<tot){M[y][x]=((enc.data[k>>>3]>>>(7-(k&7)))&1)!==0;k++;}}}
    var MF=[function(x,y){return(x+y)%2===0;},function(x,y){return y%2===0;},function(x,y){return x%3===0;},function(x,y){return(x+y)%3===0;},function(x,y){return(Math.floor(x/3)+Math.floor(y/2))%2===0;},function(x,y){return x*y%2+x*y%3===0;},function(x,y){return(x*y%2+x*y%3)%2===0;},function(x,y){return((x+y)%2+x*y%3)%2===0;}];
    function apply(m){for(var yy=0;yy<n;yy++)for(var xx=0;xx<n;xx++)if(!F[yy][xx]&&MF[m](xx,yy))M[yy][xx]=!M[yy][xx];}
    function penalty(){
      var s=0,yy,xx,run,dk=0,line;
      for(yy=0;yy<n;yy++)for(var dir=0;dir<2;dir++){run=1;line="";for(xx=0;xx<n;xx++){var c=dir?M[xx][yy]:M[yy][xx];line+=c?"1":"0";if(xx>0){var pc=dir?M[xx-1][yy]:M[yy][xx-1];if(c===pc){run++;if(run===5)s+=3;else if(run>5)s++;}else run=1;}}
        var m1=line.match(/10111010000|00001011101/g);if(m1)s+=40*m1.length;}
      for(yy=0;yy<n-1;yy++)for(xx=0;xx<n-1;xx++){var c0=M[yy][xx];if(c0===M[yy][xx+1]&&c0===M[yy+1][xx]&&c0===M[yy+1][xx+1])s+=3;}
      for(yy=0;yy<n;yy++)for(xx=0;xx<n;xx++)if(M[yy][xx])dk++;
      s+=Math.floor(Math.abs(dk*20-n*n*10)/(n*n))*10;
      return s;
    }
    var best=0,bp=1e9;
    for(var m=0;m<8;m++){apply(m);fmt(m);var pn=penalty();if(pn<bp){bp=pn;best=m;}apply(m);}
    apply(best);fmt(best);
    return M;
  }
  function svg(text,px){
    var M=build(text),n=M.length,q=4,s=n+2*q,d="";
    for(var y=0;y<n;y++)for(var x=0;x<n;x++)if(M[y][x])d+="M"+(x+q)+" "+(y+q)+"h1v1h-1z";
    return'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+s+' '+s+'" width="'+px+'" height="'+px+'" shape-rendering="crispEdges" role="img" aria-label="Code QR"><rect width="'+s+'" height="'+s+'" fill="#fff"/><path d="'+d+'" fill="#000"/></svg>';
  }
  return{matrix:build,svg:svg};
})();
