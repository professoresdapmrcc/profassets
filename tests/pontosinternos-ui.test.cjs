const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const html=fs.readFileSync(path.join(__dirname,'..','pontosinternos.html'),'utf8');const js=fs.readFileSync(path.join(__dirname,'..','pontosinternos.js'),'utf8');
test('javascript monta as quatro áreas',()=>['generate','manual','history','settings'].forEach(v=>assert.match(js,new RegExp(`data-view="${v}"`))));
test('responsável é exibido sem campo editável',()=>{assert.match(js,/id="pi-user-name"/);assert.doesNotMatch(js,/id="pi-responsible"/);});
test('html mínimo carrega somente o javascript principal',()=>{assert.match(html,/id="pi-root"/);assert.match(html,/pontosinternos\.js/);assert.doesNotMatch(html,/pontosinternos\.css/);assert.doesNotMatch(html,/firebase-app-compat/);});
test('javascript carrega estilo e dependências',()=>{assert.match(js,/pontosinternos\.css/);assert.match(js,/firebase-app-compat/);});
