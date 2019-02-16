/**
 *
 * mieleathome adapter
 *
 *
 *  file io-package.json comments:
 *
 *  {
 *      "common": {
 *          "name":         "mieleathome",                  // name has to be set and has to be equal to adapters folder name and main file name excluding extension
 *          "version":      "0.0.2",                    // use "Semantic Versioning"! see http://semver.org/
 *          "title":        "Node.js mieleathome Adapter",  // Adapter title shown in User Interfaces
 *          "authors":  [                               // Array of authord
 *              "name <hash99@iesy.net>"
 *          ]
 *          "desc":         "mieleathome adapter",          // Adapter description shown in User Interfaces. Can be a language object {de:"...",ru:"..."} or a string
 *          "platform":     "Javascript/Node.js",       // possible values "javascript", "javascript/Node.js" - more coming
 *          "mode":         "daemon",                   // possible values "daemon", "schedule", "subscribe"
 *          "materialize":  true,                       // support of admin3
 *          "schedule":     "0 0 * * *"                 // cron-style schedule. Only needed if mode=schedule
 *          "loglevel":     "info"                      // Adapters Log Level
 *      },
 *      "native": {                                     // the native object is available via adapter.config in your adapters code - use it for configuration
 *          "test1": true,
 *          "test2": 42,
 *          "mySelect": "auto"
 *      }
 *  }
 *
 */


/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';



    // you have to require the utils module and call adapter function
const utils = require('@iobroker/adapter-core'); // Get common adapter utils

    // read the adapter name from package.json
const adapterName = require('./package.json').name.split('.').pop();

const mieleathome = require('./utils/mieleathome');

const schedule = require('node-schedule');

    // create adapter instance wich will be used for communication with controller
let adapter;

/*
 function getSetting(id,callback) {
 adapter.getState (id,function(err,obj) {
 if (err) adapter.log.error ('getSetting: ' + err);
 callback(obj.val)}
 )
 };
 
 function getVal(obj) {return adapter.getState (obj, function(val) {return obj.val})};
 */

function startAdapter(options) {
    options = options || {};
    Object.assign(options, {
                  // name has to be set and has to be equal to adapters folder name and main file name excluding extension
                  name: adapterName,
                  // is called when adapter shuts down - callback has to be called under any circumstances!
                  unload: function (callback) {
                  try {
                  adapter.log.info('cleaned everything up...');
                  callback();
                  } catch (e) {
                  callback();
                  }
                  },
                  // is called if a subscribed object changes
                  objectChange: function (id, obj) {
                  // Warning, obj can be null if it was deleted
                  adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
                  },
                  // is called if a subscribed state changes
                  //                  stateChange: function (id, state) {
                  // Warning, state can be null if it was deleted
                  // you can use the ack flag to detect if it is status (true) or command (false)
                  //                  if (state && !state.ack) {
                  //                  adapter.log.info('ack is not set!');
                  //                  }
                  //                  },
                  // Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
                  message: function (obj) {
                  if (typeof obj === 'object' && obj.message) {
                  if (obj.command === 'send') {
                  // e.g. send email or pushover or whatever
                  console.log('send command');
                  // Send response in callback if required
                  if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
                  }
                  }
                  },
                  // is called when databases are connected and adapter received configuration.
                  // start here!
                  ready: () => main()
                  });
        // you have to call the adapter function and pass a options object
        // adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.mieleathome.0
    adapter = new utils.Adapter(options);
    
    return adapter;
};

function GetDevices(data,Pfad){
    for (var ObjName in data) {
        var New_Pfad=Pfad+'.'+ObjName;
            //        adapter.setObject(New_Pfad,    {type:Type,       role: ObjName},native: {});
        var Type=typeof data[ObjName];
            //   adapter.log.info(ObjName + ' ' + Pfad + ' ' + Type);
        switch(Type){
            case 'object':
                    //                adapter.log.info('ist Objekt '+ObjName+ ' ' + New_Pfad);
                if (!adapter.getObject(New_Pfad)){
                    adapter.setObject(New_Pfad,    {type: 'state',   common: { name: ObjName, type: Type,  role: ObjName }, native: {} });
                };
                    // adapter.log.info(ObjName + ' ' + Pfad + ' ' + New_Pfad + ' ' + Type);
                if (New_Pfad.split('.')[0] === 'Devices' && !New_Pfad.split('.')[2]) {
                    adapter.setObject(New_Pfad + '.LightOn', { type: 'state', common: { name: 'LightOn',type: 'boolean',role: 'button' },native: {}});
                    adapter.setObject(New_Pfad + '.LightOff', { type: 'state', common: { name: 'LightOn',type: 'boolean',role: 'button' },native: {}});
                };
                if (Pfad === 'Devices') {
                    adapter.setObject(Pfad + '.GetDevices', { type: 'state', common: { name: 'GetDevices',type: 'boolean',role: 'button' },native: {}});
                };
                    //console.log(ObjName)
                GetDevices(data[ObjName],New_Pfad);
                break;
            case 'boolean':
            case 'string':
            case 'number':
            case 'none':
                    //                adapter.log.info('ist none '+ObjName+ ' ' + New_Pfad);
                if (!adapter.getObject(New_Pfad)){
                    adapter.setObject(New_Pfad,    {type: 'state',   common: { name: ObjName, type: Type,  role: ObjName }, native: {} });
                    adapter.setState(New_Pfad,data[ObjName],true)
                }
                else{adapter.setState(New_Pfad,data[ObjName],true)}
                    //console.log(ObjName)
                break;
            default:
                    //                adapter.log.info('ist '+Type+ ' '+ObjName+ ' ' + New_Pfad);
                adapter.setObject(New_Pfad,    {type:Type,   common: {   role: ObjName }, native: {} });
                if (Array.isArray(data[ObjName])===true){
                        //    adapter.log.info('ist Array'+ObjName);
                    for (i = 0; i < data[ObjName].length; i++) {
                        GetDevices(data[ObjName[i]]);
                    }
                }
                else{adapter.log.info('is nix')}
                break;
        }
    }
}//End of Function


function main() {
    
        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // adapter.config:
    adapter.log.info('config Client_ID: '    + adapter.config.Client_ID);
    adapter.log.info('config Client_secret: '    + adapter.config.Client_secret);
    adapter.log.info('config Miele_account: ' + adapter.config.Miele_account);
    
    
    adapter.setObject('Authorization', {
                      type: 'channel',
                      common: {
                      name: 'Authorization',
                      type: 'text',
                      role: 'authorization'
                      },
                      native: {}
                      });
    
    adapter.setObject('Authorization.Authorized', {
                      type: 'state',
                      common: {
                      name: 'Authorized',
                      type: 'boolean',
                      role: 'indicator'
                      },
                      native: {}
                      });
    
    adapter.setObject('Authorization.Token', {
                      type: 'state',
                      common: {
                      name: 'Token',
                      type: 'text',
                      role: 'indicator'
                      },
                      native: {}
                      });
    
    adapter.setObject('Authorization.Refresh_Token', {
                      type: 'state',
                      common: {
                      name: 'Refresh_Token',
                      type: 'text',
                      role: 'indicator'
                      },
                      native: {}
                      });
    adapter.setObject('Devices', {
                      type: 'state',
                      common: {
                      name: 'Devices',
                      type: 'text',
                      role: 'devices'
                      },
                      native: {}
                      });
    
    if (adapter.config.Miele_account && adapter.config.Miele_pwd && adapter.config.Client_ID && adapter.config.Client_secret )
        {
            //    var miele = new mieleathome;
    var miele = new mieleathome(adapter.config.Miele_account, adapter.config.Miele_pwd, adapter.config.Client_ID,adapter.config.Client_secret);
    
    adapter.getState('Authorization.Token', function (err, state) {
                     if (!err) {adapter.log.info("Tokenwert" + state.val);
                     var  access_token = state.val ;
                     };
                     adapter.getState('Authorization.Refresh_Token', function (err, state) {
                                      if (!err) {adapter.log.info("Refresh_Tokenwert" + state.val);
                                      var  rrefresh_token = state.val ;
                                      };
                                      adapter.log.info('Authorization.Access_Token:' + access_token);
                                      adapter.log.info('Authorization.Refresh_Token:' + rrefresh_token);
                                      if ( !access_token || 0 === access_token.length) {
                                      //                                      miele.GetToken(adapter.config.Miele_pwd,adapter.config.Miele_account,adapter.config.Client_ID,
                                      //                                                     adapter.config.Client_secret,
                                      miele.NGetToken(function(err,access_token,refresh_token){
                                                      
                                                      if(!err){
                                                      adapter.setState('Authorization.Authorized',true,true);
                                                      adapter.setState('Authorization.Token',access_token,true);
                                                      adapter.setState('Authorization.Refresh_Token',refresh_token,true);
                                                      adapter.log.info("Send GET Devices");
                                                      /*miele.SendRequest(adapter.config.Miele_account,adapter.config.Miele_pwd,rrefresh_token,'v1/devices/','GET',access_token,'',function(err,data,atoken,rtoken){
                                                       adapter.log.info(err);
                                                       if(!err){GetDevices(data,'Devices')}
                                                       });*/
                                                      //                                                     miele.GetDevices(adapter.config.Miele_account,adapter.config.Miele_pwd,rrefresh_token,
                                                      //                                                                      access_token,function(err,data,atoken,rtoken){
                                                      miele.NGetDevices(rrefresh_token, access_token,function(err,data,atoken,rtoken){
                                                                        adapter.log.info(err);
                                                                        if(!err){GetDevices(data,'Devices')}
                                                                        });
                                                      }
                                                      else{adapter.setState('Authorization.Authorized',false,true)}
                                                      });
                                      }
                                      else {
                                      adapter.log.info("Devices lesen");
                                      //                                    miele.SendRequest(adapter.config.Miele_account,adapter.config.Miele_pwd,rrefresh_token,'v1/devices/','GET',access_token,'',function(err,data,atoken,rtoken){
                                      //                                                        //            adapter.log.info(err);
                                      //                                                        //                  adapter.log.info(data);
                                      //                                                        if(!err){/*adapter.log.info(data);*/GetDevices(data,'Devices')}
                                      //                                                        });
                                      //                                      miele.GetDevices(adapter.config.Miele_account,adapter.config.Miele_pwd,rrefresh_token,
                                      //                                                       access_token,function(err,data,atoken,rtoken){
                                      miele.NGetDevices(rrefresh_token, access_token,function(err,data,atoken,rtoken){
                                                        adapter.log.info(err);
                                                        if(!err){GetDevices(data,'Devices')}
                                                        });
                                      
                                      };
                                      //Schedule einplanen
                                      var j = schedule.scheduleJob('*/10 * * * *', function(){
                                                                   //                                                                   miele.SendRequest(adapter.config.Miele_account,adapter.config.Miele_pwd,rrefresh_token,'v1/devices/','GET',access_token,'',function(err,data,atoken,rtoken){
                                                                   //                                                                                     if(!err){GetDevices(data,'Devices')}
                                                                   //                                                                                     });
                                                                   //                                                                   });
                                                                   //                                                                   miele.GetDevices(adapter.config.Miele_account,adapter.config.Miele_pwd,rrefresh_token,
                                                                   //                                                                                    access_token,function(err,data,atoken,rtoken){
                                                                   miele.NGetDevices(rrefresh_token, access_token,function(err,data,atoken,rtoken){
                                                                                     adapter.log.info(err);
                                                                                     if(!err){GetDevices(data,'Devices')}
                                                                                     });
                                                                   });
                                      });
                     });
    miele.log("Test exports");
    
        // in this mieleathome all states changes inside the adapters namespace are subscribed
    adapter.subscribeStates('*');
        }
}//Ende Functin main


    // If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
        // or start the instance directly
    startAdapter();
}

adapter.on('stateChange', (id, state) => {
           //           var miele = new mieleathome;
           var miele = new mieleathome(adapter.config.Miele_account, adapter.config.Miele_pwd, adapter.config.Client_ID,adapter.config.Client_secret);
           
           //           adapter.log.info(id + ' ' + state.ack );
           if (!id || !state || state.ack) {
           //  return;
           }
           const devices = id.split('.')[3];
           //           adapter.log.info('stateChange ' + devices + id + ' ' + JSON.stringify(state));
           adapter.getState('Authorization.Token', function (err, state) {
                            if (!err) {//adapter.log.info("Tokenwert" + state.val);
                            var  access_token = state.val ;
                            };
                            adapter.getState('Authorization.Refresh_Token', function (err, state) {
                                             if (!err) {//adapter.log.info("Refresh_Tokenwert" + state.val);
                                             var  rrefresh_token = state.val ;
                                             };
                                             //adapter.log.info('Authorization.Access_Token:' + access_token);
                                             // adapter.log.info('Authorization.Refresh_Token:' + rrefresh_token);
                                             if ( !access_token || 0 === access_token.length) {}
                                             else {
                                             //adapter.log.info('Devices:' + devices);
                                             if (!devices === "GetDevices") {
                                             id = id.split('.')[4];
                                             //adapter.log.info('id' + id + 'Value');
                                             switch (id)
                                             {
                                             case 'LightOn':
                                             //                                             miele.SetLightEnable(adapter.config.Miele_account,adapter.config.Miele_pwd,rrefresh_token,
                                             //                                                                                  access_token,devices,function(err,data,atoken,rtoken){
                                             miele.NSetLightEnable(rrefresh_token, access_token,devices,function(err,data,atoken,rtoken){
                                                                   if(err){adapter.log.info(err);}
                                                                   if(!err){adapter.log.info(devices + 'LightOn Set')}
                                                                   });
                                             adapter.log.debug('LightOn');
                                             //   receiver.power(state.val);
                                             break;
                                             case 'LightOff':
                                             miele.NSetLightDisable(rrefresh_token, access_token,devices,function(err,data,atoken,rtoken){
                                                                    if(err){adapter.log.info(err);}
                                                                    if(!err){adapter.log.info(devices + 'LightOn Set')}
                                                                    });
                                             adapter.log.debug('LightOff');
                                             //   receiver.power(state.val);
                                             break;
                                             }
                                             } else {
                                             id = id.split('.')[3];
                                             switch (id)
                                             {
                                             case 'GetDevices':
                                             //                                             miele.GetDevices(adapter.config.Miele_account,adapter.config.Miele_pwd,rrefresh_token,
                                             //                                                                                 access_token,function(err,data,atoken,rtoken){
                                             miele.NGetDevices(rrefresh_token, access_token,function(err,data,atoken,rtoken){
                                                               adapter.log.info(err);
                                                               if(!err){GetDevices(data,'Devices')}
                                                               });
                                             break;
                                             }
                                             }
                                             }
                                             
                                             });
                            });
           });

/*
 var mieleStates = {
 1: 'STATE_OFF',
 2: 'STATE_STAND_BY',
 3: 'STATE_PROGRAMMED',
 4: 'STATE_PROGRAMMED_WAITING_TO_START',
 5: 'STATE_RUNNING',
 6: 'STATE_PAUSE',
 7: 'STATE_END_PROGRAMMED',
 8: 'STATE_FAILURE',
 9: 'STATE_PROGRAMME_INTERRUPTED',
 10: 'STATE_IDLE',
 11: 'STATE_RINSE_HOLD',
 12: 'STATE_SERVICE',
 13: 'STATE_SUPERFREEZING',
 14: 'STATE_SUPERCOOLING',
 15: 'STATE_SUPERHEATING',
 144: 'STATE_DEFAULT',
 145: 'STATE_LOCKED',
 146: 'STATE_SUPERCOOLING_SUPERFREEZING'
 };
 */
