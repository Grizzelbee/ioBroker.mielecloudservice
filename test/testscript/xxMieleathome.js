var Mieleathome = require('../../utils/mieleathome');
var Miele_account='helmut.horras@iesy.net';
var Miele_pwd='Sigrid-99';
var client_id='d96bb945-2cd2-4a6c-a711-4e0fbf1ff9d1'
var client_secret='usw6bg0n2f6scg8fvcgmgwbiuexj7kef'
var refresh_token='DE_8e99bbb7d8712fad862ff2b729240191';
var access_token='DE_46b9e88e282d5162a3e1c8f09b9126c6';
var devices='000149287573';
var miele = new Mieleathome(Miele_account,Miele_pwd,client_id,client_secret);
miele.log("Test Exports");
//miele.GetToken(Miele_pwd, Miele_account,client_id,client_secret,function(err,access_token,refresh_token){
//console.log(err);
//console.log(access_token);
//console.log(refresh_token);
//});
/*miele.NGetToken(function(err,access_token,refresh_token){
console.log(err);
console.log(access_token);
console.log(refresh_token);
});
*/
/*miele.GetDevices(Miele_account,Miele_pwd,refresh_token,
access_token,function(err,data,atoken,rtoken){
if(!err){
console.log(data);
console.log(atoken);
console.log(rtoken);
}
});
*/
miele.NGetDevices(refresh_token,access_token,
function(err,data,atoken,rtoken){
if(!err){
console.log(data);
console.log(atoken);
console.log(rtoken);
}
});
//miele.SetLightEnable(Miele_account,Miele_pwd,refresh_token,
//                                 access_token,devices,function(err,data,atoken,rtoken){
//                                 console.log(err);
//                                 if(!err){console.log(devices + 'LightOn Set')}
//                                 });
//miele.NGetDeviceStatus(refresh_token,
//                                 access_token,devices,function(err,data,atoken,rtoken){
//                                 if(!err){console.log('status: ' + data)}
//                                 });
//var status = miele.NGetDeviceStatusValue(access_token,devices);
//console.log('Direkt Status'+status);
//miele.NSetStart(refresh_token,
//                                 access_token,devices,function(err,data,atoken,rtoken){
//                                 if(!err){console.log('status: ' + data)}  else {console.log('Error:' + err)}
//                       });
