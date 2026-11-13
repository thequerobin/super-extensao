const {domainEditorMarkup} = require('./domain-editor.js');
function cleanupEditor(type) {
  const prefix = {cookies: '', cache: 'cache', localStorage: 'localStorage'}[type];
  if (prefix === undefined) throw new Error('Invalid cleanup editor');
  const id = key => prefix ? prefix + key[0].toUpperCase() + key.slice(1) : key;
  return domainEditorMarkup({form: true, importLink: true,
    ids: {form:id('domainForm'), input:id('domainInput'), count:id('listCount'), list:id('domainList'), empty:id('emptyList'), import:id('goImport')},
    labels: {domain:'Domínio ou URL', add:'Adicionar', count:'0 domínios', empty:'Nenhum domínio nesta lista.', import:'Importar de favoritos →'},
    markers: {domain:'uiDomainorURL10cc7', add:'uiAddfadcf', empty:'uiNodomainsinthislist5b710', import:'uiImportfrombookmarksa9c2c'},
  });
}
module.exports = {cleanupEditor};
