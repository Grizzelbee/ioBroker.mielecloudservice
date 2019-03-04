ome(Miele_account,Miele_pwd,client_id,client_secret);
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
