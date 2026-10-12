const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const html=fs.readFileSync(path.join(__dirname,'..','pontosinternos.html'),'utf8');
test('página expõe quatro áreas',()=>['generate','manual','history','settings'].forEach(v=>assert.match(html,new RegExp(`data-view="${v}"`))));
test('responsável é exibido sem campo editável',()=>{assert.match(html,/id="pi-user-name"/);assert.doesNotMatch(html,/id="pi-responsible"/);});
test('carrega somente assets esperados',()=>{assert.match(html,/pontosinternos\.css/);assert.match(html,/pontosinternos\.js/);});
