
function mieleathome() {
let requestx = require('request-promise');
let request = require('async-request'),
    response;
let req_sync = require('sync-request');

var BaseURL = 'https://api.mcs3.miele.com/';
var Username;
var Password;
var Client_ID;
var Client_Secret;

this.init = function(Username, Password, Client_ID,Client_Secret) {
        this.Username = Username;
        this.Password = Password;
        this.Client_ID = Client_ID;
        this.Client_Secret = Client_Secret;
        return;
    }
this.test = function(test){return test}
this.getUsername = function(){
	return this.Username;}

this.sendsyncRequest = function(Token,Method,Path,deviceID,SendBody) { 
var res = req_sync(Method, BaseURL+Path+deviceID+'/state', {headers: { "Authorization": "Bearer "+Token,
              "accept": 'application/json' }, timeout: 60000} );
  if (res.statusCode === 200) {
    return JSON.parse(res.getBody('utf-8')).status.value_raw;
  } else {console.log(res.statusCode);
    return undefined;
  }

}
this.sendasyncRequest1 = function(Token,Method,Path,deviceID,SendBody) { 
 requestx({
 "method": Method,
 "uri": BaseURL+Path+deviceID+'/state',
 "json": true,
 "headers": { "Authorization": "Bearer "+Token,
              "accept": 'application/json' }
}).then(function (result){console.log('Result:'+JSON.stringify(result.status.value_raw));
return JSON.stringify(result.status.value_raw)
})
.catch(function(err){ console.log('Error:'+err)})
}

this.sendasyncRequest = async function(Token,Method,Path,SendBody) { 
try {
    const response = await request(BaseURL+Path, {
        method: Method,
        data: {SendBody},
        headers: {Authorization: 'Bearer '+Token}
    	}) 
    .then (function (response){return response}) 
    } 
    catch (e) { return console.log(e)}
}
}
module.exports = mieleathome;

