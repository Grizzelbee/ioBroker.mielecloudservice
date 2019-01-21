var Mieleathome = require('../utils/mieleathome');
var miele = new Mieleathome;
miele.log("Test Exports");
miele.GetToken('pwd','email','a6c-a711-4e0fbf1ff9d1','usw6bg0n2f6sgwbiuexj7kef',function(err,access_token,refresh_token){
console.log(err);
console.log(access_token);
console.log(refresh_token);
});
