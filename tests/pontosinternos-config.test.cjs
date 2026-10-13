const test=require('node:test');const assert=require('node:assert/strict');const app=require('../pontosinternos.js');
test('catálogo inicial contém todos os 32 itens do quadro',()=>assert.equal(app.POINT_TYPES.length,32));
test('tipo usado é desativado sem apagar dados',()=>assert.deepEqual(app.removePointType({id:'meta-prof',usageCount:3}),{id:'meta-prof',usageCount:3,active:false}));
test('as listas estão cadastradas na ordem do painel e separam conselho',()=>assert.deepEqual(app.SOURCES.map(x=>x.id),['professores','coordenadores','graduadores','estagiarios','conselheiros','da','cdc','spp','propostas']));
