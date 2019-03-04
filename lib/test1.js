var Mieleathome = require('./mieleasyn2.js');
var Miele_account='helmut.horras@iesy.net';
var Miele_pwd='Sigrid-99';
var client_id='d96bb945-2cd2-4a6c-a711-4e0fbf1ff9d1'
var client_secret='usw6bg0n2f6scg8fvcgmgwbiuexj7kef'
var refresh_token='DE_b8019f427aee44ad25c530505b3c9f84';
var access_token='DE_b8019f427aee44ad25c530505b3c9f84';
var devices='000149287573';
var miele = new Mieleathome();
miele.init(Miele_account,Miele_pwd,client_id,client_secret);
console.log(miele.getUsername());
//console.log(miele.sendasyncRequest1(access_token,'GET','v1/devices/',devices,''));
var st =    miele.sendsyncRequest(access_token,'GET','v1/devices/',devices);
console.log(st);
//miele.sendasyncRequest1.then(function(result) {
//   console.log(result)})
console.log('Ende');
