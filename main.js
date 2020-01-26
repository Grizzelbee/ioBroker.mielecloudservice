/* eslint-disable no-unused-vars */
/* jshint -W097 */
/* jshint -W030 */
/* jshint strict:true */
/* jslint esversion: 6 */
/* jslint node: true */

/**
*
* mieleathome adapter V1.0.0 alpha
*
*/
'use strict';

// you have to require the utils module and call adapter function
const BaseURL = 'https://api.mcs3.miele.com/';
const adapterName = require('./package.json').name.split('.').pop();
const utils = require('@iobroker/adapter-core'); // Get common adapter utils
const schedule = require('node-schedule');
const request = require("request");
//const mieledevice = require('./utils/devices.js');
// const req_sync = require('sync-request');

// Global Variables (all uppercase)
let ACCESS_TOKEN;
let REFRESH_TOKEN;
let ADAPTER;

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

function proofAdapterConfig() {
    if ('' === ADAPTER.config.Miele_account) {
        ADAPTER.log.warn('Miele account is missing.');
    }
    if ('' === ADAPTER.config.Miele_pwd) {
        ADAPTER.log.warn('Miele password is missing.');
    }
    if ('' === ADAPTER.config.Client_ID) {
        ADAPTER.log.warn('Miele API client ID is missing.');
    }
    if ('' === ADAPTER.config.Client_secret) {
        ADAPTER.log.warn('Miele API client secret is missing.');
    }
    if ('' === ADAPTER.config.locale) {
        ADAPTER.log.warn('Locale is missing.');
    }
}

function createExtendObject(id, objData, callback) {
    ADAPTER.getObject(id, function (err, oldObj) {
        if (!err && oldObj) {
            ADAPTER.extendObject(id, objData, callback);
        } else {
            ADAPTER.setObjectNotExists(id, objData, callback);
        }
    });
}

function createEODeviceTypes(deviceTypeID){
    // Extended Objects
    switch (deviceTypeID) {
        case 1 :
            createExtendObject('Washing machines', {
                type: 'channel',
                common: {
                    name: 'Washing machines reported by Miele@Home API'
                },
                native: {}
            });
            break;
        case 2:
            createExtendObject('Tumble dryer', {
                type: 'channel',
                common: {
                    name: 'Tumble dryer reported by  Miele@Home API'
                },
                native: {}
            });
            break;
        case 3:
            createExtendObject('Dishwasher', {
                type: 'channel',
                common: {
                    name: 'Dishwasher reported by  Miele@Home API'
                },
                native: {}
            });
            break;
    }
        /*
        // todo implement complete list
          List of possible devicetypes:

          1 = WASHING MACHINE
        2 = TUMBLE DRYER
        7 = DISHWASHER
        8 = DISHWASHER SEMI-PROF
        12 = OVEN
        13 = OVEN MICROWAVE
        14 = HOB HIGHLIGHT
        15 = STEAM OVEN
        16 = MICROWAVE
        17 = COFFEE SYSTEM
        18 = HOOD
        19 = FRIDGE
        20 = FREEZER
        21 = FRIDGE-/FREEZER COMBINATION
        23 = VACUUM CLEANER, AUTOMATIC ROBOTIC VACUUM CLEANER
        24 = WASHER DRYER
        25 = DISH WARMER
        27 = HOB INDUCTION
        28 = HOB GAS
        31 = STEAM OVEN COMBINATION
        32 = WINE CABINET
        33 = WINE CONDITIONING UNIT
        34 = WINE STORAGE CONDITIONING UNIT
        39 = DOUBLE OVEN
        40 = DOUBLE STEAM OVEN
        41 = DOUBLE STEAM OVEN COMBINATION
        42 = DOUBLE MICROWAVE
        43 = DOUBLE MICROWAVE OVEN
        45 = STEAM OVEN MICROWAVE COMBINATION
        48 = VACUUM DRAWER
        67 = DIALOGOVEN
        68 = WINE CABINET FREEZER COMBINATION

        */

}

function splitMieleDevices(devices){
    // this lets you iterate over each device returned by the API - each mieleDevice is one device
    for (let mieleDevice in devices) {
        ADAPTER.log.debug('splitMieleDevices: ' + mieleDevice+ ': [' + mieleDevice + '] *** Value: [' + JSON.stringify(devices[mieleDevice]) + ']');
        parseMieleDevice(devices[mieleDevice]);
    }
}

function parseMieleDevice(mieleDevice){
    switch (mieleDevice.ident.type.value_raw) {
        case 1: // washing machines
            ADAPTER.log.debug('Das ist eine ' + mieleDevice.ident.type.value_localized );
            createEODeviceTypes(1); // create folder for washing machines
            addMieleDevice('Washing machines', mieleDevice);
            createTimeDatapoint('Washing machines.' + mieleDevice.ident.deviceIdentLabel.fabNumber + '.elapsedTime', 'ElapsedTime since program start (only present for certain devices)', mieleDevice.state.elapsedTime);
            createStringDatapointRaw('Washing machines.' + mieleDevice.ident.deviceIdentLabel.fabNumber, 'Spinning speed of a washing machine', mieleDevice.state.spinningSpeed.key_localized, mieleDevice.state.spinningSpeed.value_localized, mieleDevice.state.spinningSpeed.value_raw, mieleDevice.state.spinningSpeed.unit);
            break;
        case 2: // tumble dryer
            ADAPTER.log.debug('Das ist ein ' + mieleDevice.ident.type.value_localized );
            createEODeviceTypes(2);// create folder for Tumble dryer
            addMieleDevice('Tumble dryer', mieleDevice);
            createTimeDatapoint('Tumble dryer.' + mieleDevice.ident.deviceIdentLabel.fabNumber + '.elapsedTime', 'ElapsedTime since program start (only present for certain devices)', mieleDevice.state.elapsedTime);
            createStringDatapointRaw('Tumble dryer.' + mieleDevice.ident.deviceIdentLabel.fabNumber, 'This field is only valid for tumble dryers and washer-dryer combinations.', mieleDevice.state.dryingStep.key_localized, mieleDevice.state.dryingStep.value_localized, mieleDevice.state.dryingStep.value_raw, '');

            break;
         // more to come

        // hood:
        //createStringDatapointRaw('Tumble dryer.' + mieleDevice.ident.deviceIdentLabel.fabNumber + '.state.ventilationStep', 'This field is only valid for hoods.', mieleDevice.state.ventilationStep.value_raw, mieleDevice.state.ventilationStep.key_localized, mieleDevice.state.ventilationStep.value_localized, '');
    }







    /*
    elapsedTime since program start (only present for certain devices)
    Device Device
    ID     Type
     1     Washing machine - done
     2     Tumble dryer    - done
     7     Dishwasher
    10     Oven
    13     Oven microwave
    15     Steam oven
    12     Washer dryer
    31     Steam oven combination
    43     Steam oven microwave combination
    67     DialogOven
    */

}

function addMieleDevice(path, mieleDevice){
    let newPath = path + '.' + mieleDevice.ident.deviceIdentLabel.fabNumber;
    ADAPTER.log.debug('addMieleDevice: NewPath = [' + newPath + ']');
    createExtendObject(newPath, {
        type: 'device',
        common: {name: mieleDevice.ident.deviceName, read: true},
        native: {}
    });

    for (let deviceInfo in mieleDevice){
        ADAPTER.log.debug('addMieleDevice:' + deviceInfo);
        switch (deviceInfo) {
            case 'ident':
                addMieleDeviceIdent(newPath, mieleDevice[deviceInfo]);
                break;
            case 'state':
                addMieleDeviceState(newPath, mieleDevice[deviceInfo]);
                break;
        }


    }
}

function createStringDatapoint(path, description, value){
    createExtendObject(path, {
        type: 'state',
        common: {"name": description,
            "read": "true",
            "write": "false",
            "role": "state",
            "type": "string"
        },
        native: {}
    });
    ADAPTER.setState(path, value);
}

function createStringDatapointRaw(path, description, key_localized, value_localized, value_raw, unit){
    ADAPTER.log.debug('createStringDatapointRaw: Path:[' + path + '] key_localized:[' + key_localized + '] value_localized[' + value_localized + '] value_raw[' + value_raw +'] unit[' + unit   +']' );
    createExtendObject(path + '.' + key_localized +'_raw', {
        type: 'state',
        common: {"name":  description + ' (value raw)',
            "read": "true",
            "write": "false",
            "role": "state",
            "type": "string"
        },
        native: {}
    });
    ADAPTER.setState(path + '.' + key_localized +'_raw', value_raw);

    createExtendObject(path + '.' + key_localized, {
        type: 'state',
        common: {"name":  description,
            "read": "true",
            "write": "false",
            "role": "state",
            "type": "string"
        },
        native: {}
    });
    ADAPTER.setState(path + '.' + key_localized, value_localized + unit);
}

function createTimeDatapoint(path, description, value){
    createExtendObject(path, {
        type: 'state',
        common: {"name": description,
            "read": "true",
            "write": "false",
            "role": "state",
            "type": "string"
        },
        native: {}
    });
    ADAPTER.log.debug('createTimeDatapoint: Path:['+ path +'], value:['+ value +']');
    let assembledValue = value[0] + ':' + (value[1]<10? '0': '') + value[1];
    ADAPTER.setState(path, assembledValue);
}

function createTemperatureDatapoint(path, description, value){
    // there is a max of 3 temps returned by the miele API
    // only the first will currently be supported
    createExtendObject(path, {
        type: 'state',
        common: {"name": description,
            "read": "true",
            "write": "false",
            "role": "state",
            "type": "string"
        },
        native: {}
    });
    ADAPTER.log.debug('createTemperatureDatapoint: Path:['+ path +'], value:['+ JSON.stringify(value) +']');
    let assembledValue = value[0].value_localized + '° ' + value[0].unit;
    ADAPTER.setState(path, assembledValue);
}

function addMieleDeviceIdent(path, currentDeviceIdent){
    ADAPTER.log.debug('addMieleDeviceIdent: Path = [' + path + ']');
    createStringDatapoint(path + '.ComModFirmware', "the release version of the communication module", currentDeviceIdent.xkmIdentLabel.releaseVersion);
    createStringDatapoint(path + '.ComModTechType', "the technical type of the communication module", currentDeviceIdent.xkmIdentLabel.techType);
    createStringDatapoint(path + '.DeviceSerial', "the serial number of the device", currentDeviceIdent.deviceIdentLabel.fabNumber);
    createStringDatapoint(path + '.DeviceTechType', "the technical type of the device", currentDeviceIdent.deviceIdentLabel.techType);
    createStringDatapoint(path + '.DeviceMatNumber', "the material number of the device", currentDeviceIdent.deviceIdentLabel.matNumber);
}

function addMieleDeviceState(path, currentDeviceState){
    ADAPTER.log.debug('addMieleDeviceState: Path: [' + path + ']');

    createStringDatapointRaw(path, 'main Device state', currentDeviceState.status.key_localized, currentDeviceState.status.value_localized, currentDeviceState.status.value_raw, '');
    createStringDatapointRaw(path, 'ID of the running Program', currentDeviceState.ProgramID.key_localized, currentDeviceState.ProgramID.value_localized, currentDeviceState.ProgramID.value_raw, '');
    createStringDatapointRaw(path, 'programType of the running Program', currentDeviceState.programType.key_localized,  currentDeviceState.programType.value_localized, currentDeviceState.programType.value_raw), '';
    createStringDatapointRaw(path, 'phase of the running Program', currentDeviceState.programPhase.key_localized,  currentDeviceState.programPhase.value_localized, currentDeviceState.programPhase.value_raw, '');
    createTimeDatapoint(path + '.remainingTime', 'The RemainingTime equals the relative remaining time', currentDeviceState.remainingTime);
    createTimeDatapoint(path + '.startTime', 'The StartTime equals the relative starting time', currentDeviceState.startTime);
    createTemperatureDatapoint(path + '.targetTemperature', 'The TargetTemperature field contains information about one or multiple target temperatures of the process.', currentDeviceState.targetTemperature);
    createTemperatureDatapoint(path + '.Temperature', 'The Temperature field contains information about one or multiple temperatures of the device.', currentDeviceState.temperature);

    // missing:
/*
        "signalInfo": false,
        "signalFailure": false,
        "signalDoor": false,
        "remoteEnable": {
        "fullRemoteControl": true,
            "smartGrid": false
    },
    "light": 0,
*/
//    createTimeDatapoint(path + '.elapsedTime', 'ElapsedTime since program start (only present for certain devices)', currentDeviceState.elapsedTime);
//    createStringDatapointRaw(path, 'main Device state', currentDeviceState.status.key_localized, currentDeviceState.status.value_localized, currentDeviceState.status.value_raw);
//    createStringDatapointRaw(path, 'main Device state', currentDeviceState.status.key_localized, currentDeviceState.status.value_localized, currentDeviceState.status.value_raw);


}

function refreshMieledata(){
    APIGetDevices(REFRESH_TOKEN, ACCESS_TOKEN, ADAPTER.config.locale, function (err, data, atoken, rtoken) {
        if (err) {
            ADAPTER.log.debug('*** Error during mieleathome.APIGetDevices. ***');
            ADAPTER.log.debug('Errormessage: ' + err);
        }else{
            splitMieleDevices(data);
        }
    });
}

function main() {
    // The adapters config (in the instance object everything under the attribute "native") is accessible via
    // ADAPTER.config:
    // create needed channels to sort devices returned from API to
    if (ADAPTER.config.Miele_account && ADAPTER.config.Miele_pwd && ADAPTER.config.Client_ID && ADAPTER.config.Client_secret && ADAPTER.config.locale) {
        ADAPTER.log.debug('*** Trying to get Authorization Tokens ***');
        APIGetToken( function (err, access_token, refresh_token) {
            if (err) {
                ADAPTER.log.info('Error during Access-Token request.');
                ADAPTER.log.info('Errormessage : ' + err);
            } else {
                ACCESS_TOKEN  = access_token;
                REFRESH_TOKEN = refresh_token;
                ADAPTER.log.info("Querying Devices from API");
                refreshMieledata();
            }
        });
    } else {
        ADAPTER.log.warn('Adapter config is invalid. Please fix.');
        proofAdapterConfig();
    }
    // start refresh scheduler with interval from adapters config
    let scheduler = schedule.scheduleJob('*/' + ADAPTER.config.pollinterval.toString() + ' * * * *', function () {
        setTimeout(function () {
            ADAPTER.log.info("Updating device states (polling API scheduled).");
            refreshMieledata();
        }, 8000);
    });
    // in this mieleathome all states changes inside the adapters namespace are subscribed
    ADAPTER.subscribeStates('*');
}//End Function main


// API-Functions
function APIGetToken(callback) {
    let options = {
        url: BaseURL + 'thirdparty/token/',
        method: 'POST',
        form: {
            grant_type: 'password',
            password:      ADAPTER.config.Miele_pwd,
            username:      ADAPTER.config.Miele_account,
            client_id:     ADAPTER.config.Client_ID,
            client_secret: ADAPTER.config.Client_secret,
            vg: 'de-DE'
        },
        headers: {accept: 'application/json'}
    };
    ADAPTER.log.debug('OAuth2-URL: ['            + options.url + ']');
    ADAPTER.log.debug('config locale: ['         + ADAPTER.config.locale + ']');
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
                ADAPTER.log.error('*** Error during APIGetToken ***')
                ADAPTER.log.error('HTTP-Responsecode: ' + response.statusCode);
                ADAPTER.log.error(body);
                return callback(true, null, null);
            }
        }
    )
}

function APISendRequest(Refresh_Token, Endpoint, Method, Token, Send_Body, callback) {
    let options;

    if (Method === 'GET') {
        options = {
            url: BaseURL + Endpoint,
            method: Method,
            headers: {Authorization: 'Bearer ' + Token, accept: 'application/json'},// Content-Type: 'application/json'},
            form: Send_Body
        }
    } else {
        options = {
            url: BaseURL + Endpoint,
            method: Method,
            json: true,
            headers: {Authorization: 'Bearer ' + Token, accept: '*/*'}, //,  'Content-Type': 'application/json;charset=UTF-8'},
            body: Send_Body
        }
    }
    request(options, function (error, response, body) {
        ADAPTER.log.debug('APISendRequest - HTTP StatusCode: ' + response.statusCode);
        ADAPTER.log.debug('APISendRequest - Received body data:' + body);
        switch (response.statusCode) {
            case 200: // OK
                //if (!body){return callback(false,JSON.parse(body),null,null);} else {callback(false,null,null,null)};
            {
                return callback(false, JSON.parse(body), null, null)
            }
            case 202: //Accepted, processing has not been completed.
                break;
            case 204: // OK, No Content
                return callback(false, null, null, null);
            case 400: //Bad Request, message body will contain more information
                return callback(true, null, null, null);
            case 401: //Unauthorized
                // @todo implement this
                /*
                this.NRefreshToken(Token, Refresh_Token, function (err, access_token, refresh_token) {
                    if (!err) {
                        APISendRequest(Refresh_Token, Endpoint, Method, access_token, Send_Body, function (err, data) {
                            if (!err) {
                                return callback(false, data, access_token, refresh_token)
                            } else {
                                return callback(true, null, access_token, refresh_token)
                            }
                        });
                    } else {
                        return callback(true, null, null, null);
                    }
                });
                */
                break;
            default:
                return callback(true, null, null, null);
        }
    });
}

function APIGetDevices(Refresh_Token, Access_Token, locale, callback) {
    ADAPTER.log.debug("this is function APIGetDevices");
    APISendRequest(Refresh_Token, 'v1/devices/?language=' + locale, 'GET', Access_Token, '', function (err, data, atoken, rtoken) {
        if (!err) {
            return callback(err, data, atoken, rtoken)
        }
    });
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
