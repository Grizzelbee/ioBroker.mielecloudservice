
var request = require("request");
var req_sync = require('sync-request');
var BaseURL = 'https://api.mcs3.miele.com/';
var  mieledevice = require('./devices.js');


class mieleathome {
    
    /*   var Username;
     var Password;
     var ClientID;
     var Client_Secret; */
    
    constructor(Username, Password, Client_ID,Client_Secret) {
        
            // Add a new property
        this.Username = Username;
        this.Password = Password;
        this.Client_ID = Client_ID;
        this.Client_Secret = Client_Secret;
        this.device = new mieledevice();
    }
    
    log (msg) {
        console.log(msg);
    }
/*
    GetToken (Password,Username,Client_ID,Client_Secret,callback) {
        var options = {
        url: 'https://api.mcs3.miele.com/thirdparty/token/',
        method: 'POST',
        form: {grant_type:'password',password:Password,username:Username,client_id:Client_ID,client_secret:Client_Secret,vg:'de-DE'},
        headers: {accept: 'application/json'}
        };
        
        request(options, function (error,response,body) {
                if (response.statusCode==200) {
                var P = JSON.parse(body);
                console.log(P.access_token);
                return callback(false,P.access_token,P.refresh_token);
                }
                else {
                console.warn(response.statusCode+' Login Error !');
                console.warn(response.status);
                return callback(true,null,null);
                }
                }
                )
        
    }
    
    RefreshToken(Username,Password,Token,Refresh_Token,callback){
        var options = {
        url: 'https://api.mcs3.miele.com/thirdparty/token/',
        method: 'POST',
        form: {grant_type:'refresh_token',code:Application.Token,password:Password,username:Username,client_id:Application.Client_ID,client_secret:Application.Client_Secret,refresh_token:Application.refresh_token,vg:'de-DE'},
        headers: {accept: 'application/json'}
        };
        
        request(options, function (error, response, body){
                if (response.statusCode==200){
                P=JSON.parse(body);
                return callback(false,P.access_token,P.refresh_token);
                }
                else{
                console.error(response.statusCode+' Fehler bei Refresh Token !');
                return callback(true,null,null);
                }
                });
        
    }//End of Function RefreshToken
    
    
    
    
    SendRequest (Username,Password,Refresh_Token,Endpoint,Method,Token,Send_Body,callback){
        
        var options = {
        url: BaseURL+Endpoint,
        method: Method,
        headers: {Authorization: 'Bearer '+Token},
        form:Send_Body
        };
        
        request(options,function (error, response, body){
                console.log(response.statusCode);
                console.log(body);
                switch (response.statusCode){
                case 200: // OK
                return callback(false,JSON.parse(body));
                case 202: //Accepted, processing has not been completed.
                break;
                case 204: // OK, No Content
                return callback(false,null);
                case 400: //Bad Request, message body will contain more information
                return callback(true,null);
                case 401: //Unauthorized
                
                
                
                this.RefreshToken(Username,Password,Token,Refresh_Token,function(err,access_token,refresh_token){
                                  if(!err){
                                  
                                  SendRequest(Username,Password,Refresh_Token,Endpoint,Method,acsess_token,Send_Body,function(err,data){
                                              if(!err){return callback(false,data)}
                                              else{return callback(true,null,access_token,refresh_token)}
                                              });
                                  }
                                  else{return callback(true,null,null,null);}
                                  });
                
                break;
                default:
                return callback(true,null);
                }
                });
    }
    
    
    
    GetDevices(Username,Password,Refresh_Token,Access_Token,callback){
        this.SendRequest(Username,Password,Refresh_Token,'v1/devices/','GET',Access_Token,'',function(err,data,atoken,rtoken){
                         if(!err){return callback(err,data,atoken,rtoken)}
                         });
    }
    SetLightEnable(Username,Password,Refresh_Token,Access_Token,deviceID,parm,callback){
        var path = 'v1/devices/' + deviceID;
        var body = '{"light":1}';
        this.SendRequest(Username,Password,Refresh_Token,path,'PUT',Access_Token,body,function(err,data,atoken,rtoken){
                         if(!err){return callback(err,data,atoken,rtoken)}
                         });
        
    }
    SetLightDisable(Username,Password,Refresh_Token,Access_Token,deviceID,parm,callback){
        var path = 'v1/devices/' + deviceID;
        var body = '{"light":2}';
        this.SendRequest(Username,Password,Refresh_Token,path,'PUT',Access_Token,body,function(err,data,atoken,rtoken){
                         if(!err){return callback(err,data,atoken,rtoken)}
                         });
        
    }
 */
        //****************************************************************************************
    NGetToken(callback) {
        var options = {
        url: 'https://api.mcs3.miele.com/thirdparty/token/',
        method: 'POST',
        form: {grant_type:'password',password:this.Password,username:this.Username,client_id:this.Client_ID,client_secret:this.Client_Secret,vg:'de-DE'},
        headers: {accept: 'application/json'}
        };
        
        request(options, function (error,response,body) {
                if (response.statusCode==200) {
                var P = JSON.parse(body);
                console.log(P.access_token);
                return callback(false,P.access_token,P.refresh_token);
                }
                else {
                console.warn(response.statusCode+' Login Error !');
                console.warn(response.status);
                return callback(true,null,null);
                }
                }
                )
        
    }
    
    NRefreshToken(Token,Refresh_Token,callback){
        var options = {
        url: 'https://api.mcs3.miele.com/thirdparty/token/',
        method: 'POST',
        form: {grant_type:'refresh_token',code:Token,password:this.Password,username:this.Username,client_id:this.Client_ID,client_secret:this.Client_Secret,refresh_token:Refresh_Token,vg:'de-DE'},
        headers: {accept: 'application/json'}
        };
        
        request(options, function (error, response, body){
                if (response.statusCode==200){
                P=JSON.parse(body);
                return callback(false,P.access_token,P.refresh_token);
                }
                else{
                console.error(response.statusCode+' Fehler bei Refresh Token !');
                return callback(true,null,null);
                }
                });
        
    }//End of Function RefreshToken
    
    NSendRequest(Refresh_Token,Endpoint,Method,Token,Send_Body,callback){
        var options;
        if (Method == 'GET')
            {
            options = {
            url: BaseURL+Endpoint,
            method: Method,
            headers: {Authorization: 'Bearer '+Token, accept: 'application/json'},// Content-Type: 'application/json'},
            form:Send_Body
            }
            }
        else
            {
            options = {
            url: BaseURL+Endpoint,
            method: Method,
            json: true, 
	    headers: {Authorization: 'Bearer '+Token, accept: '*/*'}, //,  'Content-Type': 'application/json;charset=UTF-8'},
            body:Send_Body
            }
            }
//    console.log(options);    
        request(options,function (error, response, body){
                console.log(response.statusCode);
                 console.log(body);
                switch (response.statusCode){
                case 200: // OK
                //if (!body){return callback(false,JSON.parse(body),null,null);} else {callback(false,null,null,null)};
                {return callback(false,JSON.parse(body),null,null)};
                break;
                case 202: //Accepted, processing has not been completed.
                break;
                case 204: // OK, No Content
                return callback(false,null,null,null);
                break;
                case 400: //Bad Request, message body will contain more information
                return callback(true,null,null,null);
                break;
                case 401: //Unauthorized
                this.NRefreshToken(Token,Refresh_Token,function(err,access_token,refresh_token){
                                   if(!err){
                                   this.NSendRequest(Refresh_Token,Endpoint,Method,acsess_token,Send_Body,function(err,data){
                                                     if(!err){return callback(false,data,access_token,refresh_token)}
                                                     else{return callback(true,null,access_token,refresh_token)}
                                                     });
                                   }
                                   else{return callback(true,null,null,null);}
                                   });
                break;
                default:
                return callback(true,null,null,null);
                }
                });
    }
    NGetDevices(Refresh_Token,Access_Token,callback){
        this.NSendRequest(Refresh_Token,'v1/devices/','GET',Access_Token,'',function(err,data,atoken,rtoken){
                          if(!err){return callback(err,data,atoken,rtoken)}
                          });
    }
    NGetDeviceState(Refresh_Token,Access_Token,deviceID,callback){
        var path = 'v1/devices/' + deviceID + '/state';
        this.NSendRequest(Refresh_Token,path,'GET',Access_Token,'',function(err,data,atoken,rtoken){
                          if(!err){console.log('data'+JSON.stringify(data));return callback(err,data,atoken,rtoken)}
                          });
    }
    NGetDeviceStatus(Refresh_Token,Access_Token,deviceID,callback){
        this.NGetDeviceState(Refresh_Token,Access_Token,deviceID,function(err,data,atoken,rtoken){
                             if(!err){var st = JSON.stringify(data.status.value_raw);return callback(err,st,atoken,rtoken) } else
                             {return callback(err,st,atoken,rtoken)};
                             });
    }
    NGetDeviceStatusValue(Access_Token,Method,Path,deviceID){
        var res = req_sync(Method, BaseURL+Path+deviceID+'/state', {headers: { "Authorization": "Bearer "+Access_Token,
                           "accept": 'application/json' }, timeout: 60000} );
        if (res.statusCode === 200) {
            return JSON.parse(res.getBody('utf-8')).status.value_raw;
        } else {console.log(res.statusCode);
            return undefined;
        }
    }
    NGetDevicefRCValue(Access_Token,Method,Path,deviceID){
        var res = req_sync(Method, BaseURL+Path+deviceID+'/state', {headers: { "Authorization": "Bearer "+Access_Token,
                           "accept": 'application/json' }, timeout: 60000} );
        if (res.statusCode === 200) {
            return JSON.parse(res.getBody('utf-8')).remoteEnable.fullRemoteControl;
        } else {console.log(res.statusCode);
            return undefined;
        }
    }
    
    NSetLightEnable(Refresh_Token,Access_Token,deviceID,callback){
        var path = 'v1/devices/' + deviceID + '/actions';
        var body = {"light":1};
        var status = this.NGetDeviceStatusValue(Access_Token,'GET','v1/devices/',deviceID);
        this.NGetDeviceStatus(Refresh_Token,Access_Token,deviceID,function(err,data,atoken,rtoken){
                              if(!err){status = data;
                              if (status === "5"){ console.log('Body:'+body); console.log('Path:'+path);
                              this.NSendRequest(Refresh_Token,path,'PUT',Access_Token,body,function(err,data,atoken,rtoken){
                                                if(!err){return callback(err,data,atoken,rtoken)}
                                                });
                              }
                              else
                              {return callback('Status ne 5')
                              }
                              }});
    }
    NSetLightDisable(Refresh_Token,Access_Token,deviceID,callback){
        var path = 'v1/devices/' + deviceID + '/actions';
        var body = {"light":2};
        var status = this.NGetDeviceStatusValue(Access_Token,'GET','v1/devices/',deviceID);
        //console.log('Status-Value'+ status);
        if (status == "5"){
        /*    console.log('status erfüllt');
            console.log('Body:'+body);
            console.log('Path:'+path);
            console.log('rtoken'+Refresh_Token);
            console.log('atoken'+Access_Token); */
            this.NSendRequest(Refresh_Token,path,'PUT',Access_Token,body,function(err,data,atoken,rtoken){
                              if(!err){return callback(err,data,atoken,rtoken)}
                              });
        }
        else
            {return callback('Status ne 5',null, null, null)
            }
        
    }
    NSetProcessAction(Refresh_Token,Access_Token,processAction,deviceID,Type,callback){
    var status = this.NGetDeviceStatusValue(Access_Token,'GET','v1/devices/',deviceID);
    var fullRemoteControl = this.NGetDevicefRCValue(Access_Token,'GET','v1/devices/',deviceID);
    var dfunctions = this.device.readDevice(parseFloat(Type));
    for ( var i = 0; i<dfunctions.length; i++)
    {
    //adapter.log.info('Function:' + Pfad + dfunctions[i][0] + dfunctions[i][1] + dfunctions[i][2]);
    if (dfunctions[i][0] == processAction) {
       if (dfunctions[i][1]) {
        var path = 'v1/devices/' + deviceID + '/actions';
        var body = dfunctions[i][2];
          this.NSendRequest(Refresh_Token,path,'PUT',Access_Token,body,function(err,data,atoken,rtoken){
                              if(!err){return callback(err,data,atoken,rtoken)}
                              });
       
       }
    } 
    }     
     
    }
}

module.exports = mieleathome;


