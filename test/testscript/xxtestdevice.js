var mieledevice = require("../../utils/devices.js")

var device = new mieledevice();
device.log();
//device.readDevice(1);
res = device.readDevice(1);
for ( var i = 0; i<res.length; i++)
{ 
console.log(res[i][0] + res[i][1] + res[i][2]);
};

var res2 = device.readProcessAction(1);
for ( var i = 0; i<res2.length; i++)
{ 
console.log(res2[i]);
};

//console.log(res);
