var devices = require("./devices.json");
devices = JSON.stringify(devices);
var devjson = JSON.parse(devices);
class mieledevice {
  readProcessAction(dtype) {
    var arr = new Array();
    var j = 0;
    for (var i = 0; i < devjson.devices.length; i++)
      {
      if (devjson.devices[i].type.includes(dtype)||devjson.devices[i].type.includes('*'))
        {
        arr[j] = devjson.devices[i].processAction;
        j++;
        }
      }
    return arr;
  }
  readDevice(dtype) {
      //console.log('readDevice');
      //console.log(devjson);
    var arr = new Array();
    var j = 0;
      //console.log(devjson.devices.length);
    for (var i = 0; i < devjson.devices.length; i++)
      {
        //console.log(devjson.devices[i]);
      if (devjson.devices[i].type.includes(dtype)||devjson.devices[i].type.includes('*'))
        {
          //console.log(devjson.devices[i].type);
          //console.log('Lauf' + i + j + arr);
        arr[j] = new Array(2);
        arr[j][0] = devjson.devices[i].processAction;
        arr[j][1] = devjson.devices[i].condition;
        arr[j][2] = devjson.devices[i].requestbody;
        j++;
        }
      }
      //console.log(arr);
    return arr;
  }
  log() { console.log('Test');}
}
module.exports = mieledevice;
