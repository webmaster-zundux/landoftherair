
var { copy, removeSync } = require('fs-extra');

var exec = require('child_process').exec;

removeSync('dist');

exec('tsc', (e) => {

  removeSync('dist/client');

  if(e) {
    console.error(e);
    process.exit(-1);
  }

  var copySilentDev =   copy('src/server/silent-dev.html',              'dist/server/silent-dev.html');
  var copySilentProd =  copy('src/server/silent-production.html',       'dist/server/silent-production.html');
  var copyMaps =        copy('src/content/maps',                        'dist/server/maps');

  const promises = ['Mage', 'Thief', 'Healer', 'Warrior'].map(prof => {
    return copy(`src/shared/generated/skilltrees/${prof}.json`,         `dist/shared/generated/skilltrees/${prof}.json`);
  });

  Promise.all([
    copySilentDev,
    copySilentProd,
    copyMaps,
    ...promises
  ]).then(() => {
    console.log('Done compiling.');
  });

});
