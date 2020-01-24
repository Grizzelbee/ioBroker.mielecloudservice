/**
 *
 * mieleathome adapter V1.0.0 alpha
 *
 */

/* jshint -W097 */
/* jshint -W030 */
/* jshint strict:true */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';


// you have to require the utils module and call adapter function
const utils = require('@iobroker/adapter-core'); // Get common adapter utils
// read the adapter name from package.json
const adapterName = require('./package.json').name.split('.').pop();
// const mieleathome = require('./utils/mieleathome');
//const mieledevice = require('./utils/devices.js');
const schedule = require('node-schedule');

const request = require("request");
// const req_sync = require('sync-request');
const BaseURL = 'https://api.mcs3.miele.com/';

// Global Variables (all capital)
let ACCESS_TOKEN;
let REFRESH_TOKEN;
// create adapter instance which will be used for communication with controller
let ADAPTER;
// let miele;

function startadapter(options) {
    options = options || {};
    Object.assign(options, {
        // name has to be set and has to be equal to adapters folder name and main file name excluding extension
        name: adapterName,
        // is called when adapter shuts down - callback has to be called under any circumstances!
        unload: function (callback) {
            try {
                ADAPTER.log.info('Unloading Miele@Home-adapter ...');
                ADAPTER.log.info('Goodbye and have a good time!');
                callback();
            } catch (e) {
                callback();
            }
        },
        // is called if a subscribed object changes
        objectChange: function (id, obj) {
            // Warning, obj can be null if it was deleted
            if ( obj.isNotNull() ){
                ADAPTER.log.info('objectChange: ' + id + ' ' + JSON.stringify(obj));
            } else {
                ADAPTER.log.info('objectChange: Impossible because obj is null.' );
            }
        },
        // is called if a subscribed state changes
        //                  stateChange: function (id, state) {
        // Warning, state can be null if it was deleted
        // you can use the ack flag to detect if it is status (true) or command (false)
        //                  if (state && !state.ack) {
        //                  ADAPTER.log.info('ack is not set!');
        //                  }
        //                  },
        // Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
        message: function (obj) {
            if (typeof obj === 'object' && obj.message) {
                if (obj.command === 'send') {
                    // e.g. send email or pushover or whatever
                    ADAPTER.log.info('send command');
                    // Send response in callback if required
                    if (obj.callback) ADAPTER.sendTo(obj.from, obj.command, 'Message received', obj.callback);
                }
            }
        },
        // is called when databases are connected and adapter received configuration.
        // start here!
        ready: () => main()
    });
    // you have to call the adapter function and pass a options object
    // adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.mieleathome.0
    ADAPTER = new utils.adapter(options);

    return ADAPTER;
}


function NGetToken(callback) {
    let options = {
        url: BaseURL + 'thirdparty/token/',
        method: 'POST',
        form: {
            grant_type: 'password',
            password: ADAPTER.config.Miele_pwd,
            username: ADAPTER.config.Miele_account,
            client_id: ADAPTER.config.Client_ID,
            client_secret: ADAPTER.config.Client_secret,
            vg: 'de-DE'
        },
        headers: {accept: 'application/json'}
    };
    ADAPTER.log.debug('OAuth2-URL: ['           + options.url + ']');
    ADAPTER.log.debug('config locale: ['        + ADAPTER.config.locale + ']');
    ADAPTER.log.debug('options Miele_account: [' + options.form.username + ']');
    ADAPTER.log.debug('options Miele_Passwd: ['  + options.form.password + ']');
    ADAPTER.log.debug('options Client_ID: ['     + options.form.client_id + ']');
    ADAPTER.log.debug('options Client_Secret: [' + options.form.client_secret + ']');

    request(options, function (error, response, body) {
            if (response.statusCode === 200) {
                let P = JSON.parse(body);
                ADAPTER.log.info('Got new Access-Token!');
                ADAPTER.log.debug('New Access-Token:  [' + P.access_token + ']');
                ADAPTER.log.debug('New Refresh-Token: [' + P.refresh_token + ']');
                return callback(false, P.access_token, P.refresh_token);
            } else {
                ADAPTER.log.error('*** Error during NGetToken ***')
                ADAPTER.log.error('HTTP-Responsecode: ' + response.statusCode);
                ADAPTER.log.error(body);
                return callback(true, null, null);
            }
        }
    )
}

function main() {
    // The adapters config (in the instance object everything under the attribute "native") is accessible via
    // ADAPTER.config:
    ADAPTER.log.debug('**********************************************');
    ADAPTER.log.debug('* Miele@Home Adapter V1.0.0 - Function: Main *');
    ADAPTER.log.debug('**********************************************');

    // Extended Objects
    createExtendObject('Devices', {
        type: 'channel',
        common: {
            name: 'Devices detected and supported by Miele@Home',
            type: 'text',
            role: 'value'
        },
        native: {}
    });
    // Get adapter config from Admin
    if (ADAPTER.config.Miele_account && ADAPTER.config.Miele_pwd && ADAPTER.config.Client_ID && ADAPTER.config.Client_secret && ADAPTER.config.locale) {
        ADAPTER.log.info('*** Received adapter configuration from admin ***');
        ADAPTER.log.info('*** Trying to get Authorization Tokens ***');
        NGetToken( function (err, access_token, refresh_token) {
            if (err) {
                ADAPTER.log.info('Error during Access-Token request.');
                ADAPTER.log.info('Errormessage : ' + err);
            } else {
                ACCESS_TOKEN  = access_token;
                REFRESH_TOKEN = refresh_token;
            }
        });

        // Querying Devices from API
        ADAPTER.log.info("Querying Devices from API");
                /*
                miele.NGetDevices(REFRESH_TOKEN, access_token, ADAPTER.config.locale, function (err, data, atoken, rtoken) {
                    ADAPTER.log.debug('*** Error during mieleathome.NGetDevices. ***');
                    ADAPTER.log.debug('Errormessage: ' + err);
                    if (!err) {
                        // GetDevices(data, 'Devices')
                    }
                });
                */

    } else {
        ADAPTER.log.debug("Send GET Devices");
        setTimeout(function () {
             ADAPTER.log.info('Mock for getting Devices from API');
            /*
            miele.NGetDevices(REFRESH_TOKEN, REFRESH_TOKEN, ADAPTER.config.locale, function (err, data, atoken, rtoken) {
                ADAPTER.log.debug('NGetDevices Error: ' + err);
                if (!err) {
                    // GetDevices(data, 'Devices')
                }
            });
            */
        }, 8000);
    }
    // start refresh scheduler
    let j = schedule.scheduleJob('*/'+ADAPTER.config.pollinterval.toString()+' * * * *', function () {
        setTimeout(function () {
            /*
            miele.NGetDevices(REFRESH_TOKEN, REFRESH_TOKEN, ADAPTER.config.locale, function (err, data, atoken, rtoken) {
                ADAPTER.log.debug('NGetDevices Error: ' + err);
                if (!err) {
                    ADAPTER.log.info("Updating device states (polling API scheduled).");
                    GetDevices(data, 'Devices')
                }
            });
            */
        }, 8000);
    });
    // in this mieleathome all states changes inside the adapters namespace
    // are subscribed
    ADAPTER.subscribeStates('*');
}//End Function main




function GetDevices(data, Pfad) {
    let deviceType;

    for (let ObjName in data) {
        let New_Pfad = Pfad + '.' + ObjName;
        let Type = typeof data[ObjName];
        ADAPTER.log.debug('Main:Function GetDevices: ObjName: [' + ObjName + '] *** Pfad [' + Pfad + '] *** Type: [' + Type+ '] *** Value: [' + data[ObjName] + ']');
        switch (Type) {
            case 'object':
                ADAPTER.log.debug('Main:GetDevices:1: ObjName: [' + ObjName + '] *** New_Pfad: [' + New_Pfad + ']');
                if (!ADAPTER.getObject(New_Pfad)) {
                    ADAPTER.setObjectNotExists(New_Pfad, {
                        type: 'state',
                        common: {name: ObjName, type: Type, role: 'state'},
                        native: {}
                    });
                }
                // ADAPTER.log.debug(ObjName + ' ' + Pfad + ' ' + New_Pfad + ' ' + Type);
                ADAPTER.log.debug('Main:GetDevices:2: Pfad: [' + Pfad + '] *** New_Pfad: [' + New_Pfad + '] *** Type: [' + Type + ']');
                if (New_Pfad.split('.')[0] === 'Devices' && !New_Pfad.split('.')[2]) {
                    //    createExtendObject(New_Pfad + '.LightOn', { type: 'state', common: { name: 'LightOn',type: 'boolean',role: 'button' },native: {}});
                    //    createExtendObject(New_Pfad + '.LightOff', { type: 'state', common: { name: 'LightOn',type: 'boolean',role: 'button' },native: {}});
                    addDevicefunction(New_Pfad, deviceType, data);
                }

                if ( String(ObjName).includes('Time') ){
                    ADAPTER.log.debug("*****  Objekt [" + ObjName + "] gefunden! *****");
                    let niceTime = data[ObjName][0] + ':';
                    if	(data[ObjName][1] < 10) {
                        niceTime += '0' + data[ObjName][1];
                    } else {
                        niceTime += data[ObjName][1];
                    }
                    ADAPTER.log.debug("*****  NiceTime= [" + niceTime + "]  *****");
                    ADAPTER.log.debug("*****  New_Pfad= [" + New_Pfad + "]  *****");
                    ADAPTER.log.debug("*****  Pfad= [" + Pfad + "]  *****");
                    if (!ADAPTER.getObject(New_Pfad)) {
                        ADAPTER.log.debug("*****  State [" + New_Pfad + "] does not exist. Creating new one. *****");
                        createExtendObject(New_Pfad, {
                            type: 'state',
                            common: {name: ObjName, type: Type, role: 'state'},
                            native: {}
                        })
                    }
                    ADAPTER.log.debug("*****  Setting State [" + New_Pfad + "] *****");
                    ADAPTER.setState(New_Pfad, niceTime, true);
                    // break; // if breaking here the deeper states won't be written/updated anymore
                    // this will be a breaking change!! - but reduce runtime
                }

                if (Pfad === 'Devices') {
                    createExtendObject(Pfad + '.GetDevices', {
                        type: 'state',
                        common: {name: 'GetDevices', type: 'boolean', role: 'button'},
                        native: {}
                    });
                }
                GetDevices(data[ObjName], New_Pfad);
                break;
            case 'boolean':
            case 'string':
            case 'number':
            case 'none':
                ADAPTER.log.debug('Ist none ' + ObjName + ' ' + New_Pfad + ' ' + data[ObjName]);
                if (String(New_Pfad).includes('state\.status\.value_raw')) {
                    ADAPTER.log.debug('DeviceType:' + New_Pfad + data[ObjName]);
                    deviceType = data[ObjName];
                }
                if (!ADAPTER.getObject(New_Pfad)) {
                    createExtendObject(New_Pfad, {
                        type: 'state',
                        common: {name: ObjName, type: Type, role: 'state'},
                        native: {}
                    });
                    // TODO Cleanup: Remove else and put setState behind if
                    ADAPTER.setState(New_Pfad, data[ObjName], true)
                } else {
                    ADAPTER.setState(New_Pfad, data[ObjName], true)
                }
                break;
            default:
                ADAPTER.log.debug('Ist ' + Type + ' ' + ObjName + ' ' + New_Pfad);
                createExtendObject(New_Pfad, {type: Type, common: {role: 'state'}, native: {}});
                if (Array.isArray(data[ObjName]) === true) {
                    ADAPTER.log.debug('Ist Array' + ObjName);
                    for (let i = 0; i < data[ObjName].length; i++) {
                        GetDevices(data[ObjName[i]]);
                    }
                } else {
                    ADAPTER.log.debug('Ist nix')
                }
                break;
        }
    }
}//End of Function GetDevices


function createExtendObject(id, objData, callback) {
    ADAPTER.getObject(id, function (err, oldObj) {
        if (!err && oldObj) {
            ADAPTER.extendObject(id, objData, callback);
        } else {
            ADAPTER.setObjectNotExists(id, objData, callback);
        }
    });
}

function addDevicefunction(Pfad, Type, data) {
    let datajsonS = JSON.stringify(data);
    let datajson = JSON.parse(datajsonS);
    let devarray = Pfad.split('.');
    let dev = devarray[devarray.length - 1];
    Type = datajson[dev].state.status.value_raw;
    ADAPTER.log.debug('Function addDevicefunction: Dfunctions Call ' + Pfad + ' for Type ' + Type + ' ' + JSON.stringify(data));
    let dfunctions = mieledevice.readDevice(parseFloat(Type));
    for (let i = 0; i < dfunctions.length; i++) {
        ADAPTER.log.debug('Function: ' + Pfad + dfunctions[i][0] + dfunctions[i][1] + dfunctions[i][2]);
        createExtendObject(Pfad + '.' + dfunctions[i][0], {
            type: 'state',
            common: {name: dfunctions[i][0], type: 'boolean', role: 'button'},
            native: {}
        });
    }
}




// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startadapter;
} else {
    // or start the instance directly
    startadapter();
}

ADAPTER.on('stateChange', (id, state) => {
    if (!id || !state || state.ack) {
        //  return;
    }
    const devices = id.split('.')[3];
    let access_token;
    let rrefresh_token;
    ADAPTER.log.debug('Function dapter.on: stateChange ' + devices + id + ' ' + JSON.stringify(state));
    ADAPTER.getState('Authorization.Token', function (err, state) {
        if (!err) {
            ADAPTER.log.debug("Tokenwert: " + state.val);
            access_token = state.val;
        }
        ADAPTER.getState('Authorization.Refresh_Token', function (err, state) {
            if (!err) {
                ADAPTER.log.debug("Refresh_Tokenwert: " + state.val);
                rrefresh_token = state.val;
            }
            if (!access_token || 0 === access_token.length) {
            } else {
                ADAPTER.log.debug('Devices: ' + devices);
                if (devices !== "GetDevices") {
                    id = id.split('.')[4];
                    ADAPTER.log.debug('id' + id + 'Value');
                    switch (id) {
                        case 'LightOn':
                            miele.NSetLightEnable(rrefresh_token, access_token, devices, function (err, data, atoken, rtoken) {
                                if (err) {
                                    ADAPTER.log.error('NSetLightEnable: ' + err);
                                }
                                if (!err) {
                                    ADAPTER.log.debug(devices + 'LightOn Set')
                                }
                            });
                            ADAPTER.log.debug('LightOn');
                            break;
                        case 'LightOff':
                            miele.NSetLightDisable(rrefresh_token, access_token, devices, function (err, data, atoken, rtoken) {
                                if (err) {
                                    ADAPTER.log.error('NSetLightDisable: ' + err);
                                }
                                if (!err) {
                                    ADAPTER.log.dbug(devices + 'LightOn Set')
                                }
                            });
                            ADAPTER.log.debug('LightOff');
                            break;
                        default:
                            ADAPTER.getState('Devices.' + devices + '.ident.type.value_raw', function (err, state) {
                                if (!err) {
                                    ADAPTER.log.debug('Device-typ:' + state.val);
                                    let pAction = mieledevice.readProcessAction(parseFloat(state.val));
                                    ADAPTER.log.debug(pAction.toString());
                                    ADAPTER.log.debug('Info about change: ' + id);
                                    if (pAction.includes(id)) {
                                        ADAPTER.log.info('Button:' + id);
                                        miele.NSetProcessAction(rrefresh_token, access_token, id, devices, state.val, function (err, data, atoken, rtoken) {
                                            if (err) {
                                                ADAPTER.log.error('Function NSetProcessAction:' + err + ' ' + id)
                                            }
                                            if (!err) {
                                                ADAPTER.log.debug(devices + id)
                                            }
                                        });
                                    }
                                }
                            })
                    }
                } else {
                    id = id.split('.')[3];
                    switch (id) {
                        case 'GetDevices':
                            miele.NGetDevices(rrefresh_token, access_token, ADAPTER.config.locale, function (err, data, atoken, rtoken) {
                                if (err) {
                                    ADAPTER.log.error('Function NGetDevices:' + err + ' ' + id)
                                }
                                if (!err) {
                                    GetDevices(data, 'Devices')
                                }
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
