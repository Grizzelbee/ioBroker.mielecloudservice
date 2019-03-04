
function mieleathome() {
var request = require("request");

var BaseURL = 'https://api.mcs3.miele.com/';

var Username;
var Password;
var Client_ID;
var Client_Secret;
this.init = function(Username, Password, Client_ID,Client_Secret) {
        
            // Add a new property
        this.Username = Username;
        this.Password = Password;
        this.Client_ID = Client_ID;
        this.Client_Secret = Client_Secret;
        return;
    }

this.getUsername = function(){
	return this.Username;};

}
module.exports = mieleathome;

