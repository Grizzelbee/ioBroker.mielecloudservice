
var request = require("request");

var BaseURL = 'https://api.mcs3.miele.com/';

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
    }
    
    log (msg) {
        console.log(msg);
    }
    
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
                
                
                
                this.NRefreshToken(Token,Refresh_Token,function(err,access_token,refresh_token){
                                  if(!err){
                                  
                                  NSendRequest(Refresh_Token,Endpoint,Method,acsess_token,Send_Body,function(err,data){
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
    NGetDevices(Refresh_Token,Access_Token,callback){
        this.NSendRequest(Refresh_Token,'v1/devices/','GET',Access_Token,'',function(err,data,atoken,rtoken){
                         if(!err){return callback(err,data,atoken,rtoken)}
                         });
    }
    NGetDeviceState(Refresh_Token,Access_Token,deviceID,callback){
        var path = 'v1/devices/' + deviceID + '/state';
        this.NSendRequest(Refresh_Token,path,'GET',Access_Token,'',function(err,data,atoken,rtoken){
                          if(!err){return callback(err,data,atoken,rtoken)}
                          });
    }

    NSetLightEnable(Refresh_Token,Access_Token,deviceID,parm,callback){
        var path = 'v1/devices/' + deviceID;
        var body = '{"light":1}';
        this.NSendRequest(Refresh_Token,path,'PUT',Access_Token,body,function(err,data,atoken,rtoken){
                         if(!err){return callback(err,data,atoken,rtoken)}
                         });
    }
    NSetLightDisable(Refresh_Token,Access_Token,deviceID,parm,callback){
        var path = 'v1/devices/' + deviceID;
        var body = '{"light":2}';
        this.NSendRequest(Refresh_Token,path,'PUT',Access_Token,body,function(err,data,atoken,rtoken){
                         if(!err){return callback(err,data,atoken,rtoken)}
                         });
        
    }

    
    }

module.exports = mieleathome;

