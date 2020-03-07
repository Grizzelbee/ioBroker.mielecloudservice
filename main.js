/* jshint -W097 */
/* jshint -W030 */
/* jshint strict:true */
/* jslint esversion: 6 */
/* jslint node: true */
/**
*
* mieleCloudService Adapter for ioBroker
*
*/
'use strict';

// you have to require the utils module and call adapter function
const BaseURL = 'https://api.mcs3.miele.com/';
const adapterName = require('./package.json').name.split('.').pop();
const utils = require('@iobroker/adapter-core'); // Get common adapter utils
const request = require('request');
const salt = 'Zgfr56gFe87jJOM';
const START = 1;
const STOP  = 2;
const PAUSE = 3;
const START_SUPERFREEZING = 4;
const STOP_SUPERFREEZING  = 5;
const START_SUPERCOOLING  = 6;
const STOP_SUPERCOOLING   = 7;
const LIGHT_ON  = 1;
const LIGHT_OFF = 2;
// Global Variables (all uppercase)
let ACCESS_TOKEN;
let REFRESH_TOKEN;
let adapter;
let pollTimeout;
let expiryDate;

function startadapter(options) {
    options = options || {};
    Object.assign(options, {
        // name has to be set and has to be equal to adapters folder name and main file name excluding extension
        name: adapterName,
        // is called when adapter shuts down - callback has to be called under any circumstances!
        unload: function (callback) {
            try {
                if (pollTimeout) {
                    adapter.log.info('Clearing Timeout: pollTimeout');
                    clearTimeout(pollTimeout);
                }
                adapter.unsubscribeObjects('*');
                adapter.unsubscribeStates('*');
                adapter.setState('info.connection', false);
                adapter.log.info('Unloading MieleCloudService...');
                callback();
            } catch (e) {
                callback();
            }
        },
        // is called if a subscribed object changes
        /*
        objectChange: function (id, obj) {
            // Warning, obj can be null if it was deleted
            ADAPTER.log.debug('objectChange ' + id + ' ' + JSON.stringify(obj));
        },
         */
        // is called if a subscribed state changes
        stateChange: function (id, state) {
            // Warning, state can be null if it was deleted
            if (state && !state.ack) {
              adapter.log.debug('ack is not set!');
              // you can use the ack flag to detect if it is status (true) or command (false)
              adapter.log.debug('stateChange [' + id + '] [' + JSON.stringify(state)+']');
              let action = id.split('.').pop();
              APIStartAction(REFRESH_TOKEN, ACCESS_TOKEN, id, action, state.val);
            }
          },
        // stateChange: function(id, state){
        //    ADAPTER.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));
        // },
        // Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
        message: function (obj) {
            if (typeof obj === 'object' && obj.message) {
                if (obj.command === 'send') {
                    // e.g. send email or pushover or whatever
                    adapter.log.info('send command');
                    // Send response in callback if required
                    if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
                }
            }
        },
        // is called when databases are connected and adapter received configuration.
        // start here!
        ready: () => {
            adapter.getForeignObject('system.config', (err, obj) => {
                if (obj && obj.native && obj.native.secret) {
                    //noinspection JSUnresolvedVariable
                    adapter.config.Miele_pwd = decrypt(obj.native.secret, adapter.config.Miele_pwd);
                    adapter.config.Client_secret = decrypt(obj.native.secret, adapter.config.Client_secret);
                } else {
                    //noinspection JSUnresolvedVariable
                    adapter.config.Miele_pwd = decrypt(salt, adapter.config.Miele_pwd);
                    adapter.config.Client_secret = decrypt(salt, adapter.config.Client_secret);
                }
                // Execute main after pwds have been decrypted
                main();
            });
        }
    });
    // you have to call the adapter function and pass a options object
    // adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.mielecloudservice.0
    adapter = new utils.adapter(options);

    return adapter;
}

function addActionButton(path, action, description) {
    // If no buttontype is given, use the default
    addActionButton(path, action, description, "button");
}

function addActionButton(path, action, description, buttonType){
   adapter.log.debug('addActionButton: Path['+ path +']');
    createExtendObject(path + '.ACTIONS.' + action, {
            type: 'state',
            common: {"name": description,
                "read": "false",
                "write": "true",
                "role": "button",
                "type": "boolean"
            },
            native: {"type": buttonType // "button"
            }
        }
    );
    adapter.subscribeStates(path + '.ACTIONS.' + action);
}

function proofAdapterConfig() {
    if ('' === adapter.config.Miele_account) {
        adapter.log.warn('Miele account is missing.');
    }
    if ('' === adapter.config.Miele_pwd) {
        adapter.log.warn('Miele password is missing.');
    }
    if ('' === adapter.config.Client_ID) {
        adapter.log.warn('Miele API client ID is missing.');
    }
    if ('' === adapter.config.Client_secret) {
        adapter.log.warn('Miele API client secret is missing.');
    }
    if ('' === adapter.config.locale) {
        adapter.log.warn('Locale is missing.');
    }
    if ('' === adapter.config.oauth2_vg) {
        adapter.log.warn('OAuth2_vg is missing.');
    }
    if ('' === adapter.config.pollinterval) {
        adapter.log.warn('PollInterval is missing.');
    }
}

function createExtendObject(id, objData, callback) {
    adapter.getObject(id, function (err, oldObj) {
        if (!err && oldObj) {
            adapter.extendObject(id, objData, callback);
        } else {
            adapter.setObjectNotExists(id, objData, callback);
        }
    });
}

function createEODeviceTypes(deviceTypeID){
/* List of possible devicetypes:
    2 = TUMBLE DRYER
    1 = WASHING MACHINE
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

    let deviceFolder;
    let description;

    switch (deviceTypeID) {
        case 1 :
            deviceFolder = 'Washing machines';
            description  = 'Washing machines reported by Miele@Home API';
            break;
        case 2:
            deviceFolder = 'Tumble dryers';
            description  = 'Tumble dryers reported by Miele@Home API';
            break;
        case 7:
        case 8:
            deviceFolder = 'Dishwashers';
            description  = 'Dishwashers reported by Miele@Home API';
            break;
        case 12:
        case 13:
        case 15:
        case 31:
        case 39:
        case 40:
        case 41:
        case 43:
        case 45:
        case 67:
            deviceFolder = 'Ovens';
            description  = 'Ovens reported by Miele@Home API';
            break;
        case 14:
        case 27:
        case 28:
            deviceFolder = 'Cooktops';
            description  = 'Cooktops reported by Miele@Home API';
            break;
        case 16:
        case 42:
            deviceFolder = 'Microwaves';
            description  = 'Microwaves reported by Miele@Home API';
            break;
        case 17:
            deviceFolder = 'Coffee Systems';
            description  = 'Coffee Systems reported by Miele@Home API';
            break;
        case 18:
            deviceFolder = 'Hoods';
            description  = 'Hoods reported by Miele@Home API';
            break;
        case 19:
        case 20:
        case 21:
        case 32:
        case 33:
        case 34:
        case 68:
            deviceFolder = 'Fridges';
            description  = 'Fridges reported by Miele@Home API';
            break;
        case 23:
            deviceFolder = 'Vacuum cleaners';
            description  = 'Vacuum cleaners reported by Miele@Home API';
            break;
        case 25:
            deviceFolder = 'Dish warmers';
            description  = 'Dish warmers reported by Miele@Home API';
            break;
        case 48:
            deviceFolder = 'Vacuum drawers';
            description  = 'Vacuum drawers reported by Miele@Home API';
            break;
    }

    createExtendObject(deviceFolder, {
        type: 'channel',
        common: {
            name: description
        },
        native: {}
    });

    return deviceFolder;
}

function splitMieleDevices(devices){
    // this lets you iterate over each device returned by the API - each mieleDevice is one device
    for (let mieleDevice in devices) {
        adapter.log.debug('splitMieleDevices: ' + mieleDevice+ ': [' + mieleDevice + '] *** Value: [' + JSON.stringify(devices[mieleDevice]) + ']');
        parseMieleDevice(devices[mieleDevice]);
    }
}

function parseMieleDevice(mieleDevice){
    let deviceFolder;
    adapter.log.debug('This is a ' + mieleDevice.ident.type.value_localized );
    deviceFolder = createEODeviceTypes(mieleDevice.ident.type.value_raw); // create folder for device
    addMieleDevice(deviceFolder, mieleDevice);

    // add special datapoints to devices
    // spinning speed
    switch (mieleDevice.ident.type.value_raw) {
        case  1: // Washing machine
            createStringDatapointRaw(deviceFolder + '.' + mieleDevice.ident.deviceIdentLabel.fabNumber, 'Spinning speed of a washing machine.', mieleDevice.state.spinningSpeed.key_localized, mieleDevice.state.spinningSpeed.value_localized, mieleDevice.state.spinningSpeed.value_raw, mieleDevice.state.spinningSpeed.unit);
            break;
    }
    // elapsedTime
    switch (mieleDevice.ident.type.value_raw) {
        case  1: // Washing machine
        case  2: // Tumble dryer
        case  7: // Dishwasher
        case 10: // Oven
        case 13: // Oven microwave
        case 15: // Steam oven
        case 12: // Washer dryer
        case 31: // Steam oven combination
        case 43: // Steam oven microwave combination
        case 67: // DialogOven
            createTimeDatapoint(deviceFolder + '.' + mieleDevice.ident.deviceIdentLabel.fabNumber + '.elapsedTime', 'ElapsedTime since program start (only present for certain devices)', mieleDevice.state.elapsedTime);
            break;
        case 18: // Hood
            createStringDatapointRaw(deviceFolder + '.' + mieleDevice.ident.deviceIdentLabel.fabNumber, 'This field is only valid for hoods.', mieleDevice.state.ventilationStep.key_localized, mieleDevice.state.ventilationStep.value_localized, mieleDevice.state.ventilationStep.value_raw, '');
            break;
    }
    // dryingStep
    switch (mieleDevice.ident.type.value_raw) {
        case  2: // tumble dryer
        case 24: // washer dryer
            createStringDatapointRaw(deviceFolder + '.' + mieleDevice.ident.deviceIdentLabel.fabNumber, 'This field is only valid for tumble dryers and washer-dryer combinations.', mieleDevice.state.dryingStep.key_localized, mieleDevice.state.dryingStep.value_localized, mieleDevice.state.dryingStep.value_raw, '');
            break;
    }
}

function addMieleDevice(path, mieleDevice){
    let newPath = path + '.' + mieleDevice.ident.deviceIdentLabel.fabNumber;
    adapter.log.debug('addMieleDevice: NewPath = [' + newPath + ']');
    createExtendObject(newPath, {
        type: 'device',
        common: {name:   (mieleDevice.ident.deviceName === ''? mieleDevice.ident.type.value_localized: mieleDevice.ident.deviceName) , read: true, write: false},
        native: {}
    });

    // add device specific actions
    addMieleDeviceActions(newPath, mieleDevice.ident.type.value_raw);
    addDeviceNicknameAction(newPath, mieleDevice);

    // add device states and idents
    for (let deviceInfo in mieleDevice){
        adapter.log.debug('addMieleDevice:' + deviceInfo);
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

function createBoolDatapoint(path, description, value){
    adapter.log.debug('createBoolDatapoint: Path['+ path +'] Value[' + value + ']');
    createExtendObject(path, {
        type: 'state',
        common: {"name": description,
            "read": "true",
            "write": "false",
            "role": "state",
            "type": "boolean"
        },
        native: {}
    });
    adapter.setState(path, value, true);
}

function createStringDatapoint(path, description, value){
    adapter.log.debug('createStringDatapoint: Path['+ path +'] Value[' + value + ']');
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
    adapter.setState(path, value, true);
}

function createStringDatapointRaw(path, description, key_localized, value_localized, value_raw, unit){
    adapter.log.debug('createStringDatapointRaw: Path:[' + path + '] key_localized:[' + key_localized + '] value_localized[' + value_localized + '] value_raw[' + value_raw +'] unit[' + unit   +']' );
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
    adapter.setState(path + '.' + key_localized +'_raw', value_raw, true);

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
    adapter.setState(path + '.' + key_localized, value_localized + ' ' + unit, true);
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
    adapter.log.debug('createTimeDatapoint: Path:['+ path +'], value:['+ value +']');
    let assembledValue = value[0] + ':' + (value[1]<10? '0': '') + value[1];
    adapter.setState(path, assembledValue, true);
}

function createTemperatureDatapoint(path, description, value){
    // depending on the device we receive up to 3 values
    // there is a min of 1 and a max of 3 temps returned by the miele API
    for (let n in value) {
        createExtendObject(path + '_' + n, {
            type: 'state',
            common: {
                "name": description,
                "read": "true",
                "write": "false",
                "role": "state",
                "type": "string"
            },
            native: {}
        });
        adapter.log.debug('createTemperatureDatapoint: Path:[' + path + '_' + n + '], value:[' + JSON.stringify(value) + ']');
        let prettyValue = value[n].value_localized + '° ' + value[n].unit;
        adapter.setState(path + '_' + n, prettyValue, true);
    }
}

function addMieleDeviceIdent(path, currentDeviceIdent){
    adapter.log.debug('addMieleDeviceIdent: Path = [' + path + ']');
    createStringDatapoint(path + '.ComModFirmware', "the release version of the communication module", currentDeviceIdent.xkmIdentLabel.releaseVersion);
    createStringDatapoint(path + '.ComModTechType', "the technical type of the communication module", currentDeviceIdent.xkmIdentLabel.techType);
    createStringDatapoint(path + '.DeviceSerial', "the serial number of the device", currentDeviceIdent.deviceIdentLabel.fabNumber);
    createStringDatapoint(path + '.DeviceTechType', "the technical type of the device", currentDeviceIdent.deviceIdentLabel.techType);
    createStringDatapoint(path + '.DeviceMatNumber', "the material number of the device", currentDeviceIdent.deviceIdentLabel.matNumber);
}

function addMieleDeviceState(path, currentDeviceState){
    adapter.log.debug('addMieleDeviceState: Path: [' + path + ']');

    createStringDatapointRaw(path, 'main Device state', currentDeviceState.status.key_localized, currentDeviceState.status.value_localized, currentDeviceState.status.value_raw, '');
    createStringDatapointRaw(path, 'ID of the running Program', currentDeviceState.ProgramID.key_localized, currentDeviceState.ProgramID.value_localized, currentDeviceState.ProgramID.value_raw, '');
    createStringDatapointRaw(path, 'programType of the running Program', currentDeviceState.programType.key_localized,  currentDeviceState.programType.value_localized, currentDeviceState.programType.value_raw), '';
    createStringDatapointRaw(path, 'phase of the running Program', currentDeviceState.programPhase.key_localized,  currentDeviceState.programPhase.value_localized, currentDeviceState.programPhase.value_raw, '');
    createTimeDatapoint(path + '.remainingTime', 'The RemainingTime equals the relative remaining time', currentDeviceState.remainingTime);
    createTimeDatapoint(path + '.startTime', 'The StartTime equals the relative starting time', currentDeviceState.startTime);
    createTemperatureDatapoint(path + '.targetTemperature', 'The TargetTemperature field contains information about one or multiple target temperatures of the process.', currentDeviceState.targetTemperature);
    createTemperatureDatapoint(path + '.Temperature', 'The Temperature field contains information about one or multiple temperatures of the device.', currentDeviceState.temperature);
    createBoolDatapoint(path + '.signalInfo', 'The SignalInfo field indicates, if a notification is active for this Device.', currentDeviceState.signalInfo);
    createBoolDatapoint(path + '.signalFailure', 'The SignalFailure field indicates, if a failure is active for this Device.', currentDeviceState.signalFailure);
    createBoolDatapoint(path + '.signalDoor', 'The SignalDoor field indicates, if a door-open message is active for this Device.', currentDeviceState.signalDoor);
    createBoolDatapoint(path + '.Light', 'The light field indicates the status of the device light.', currentDeviceState.light === 1?'Enabled':(currentDeviceState.light === 2?'Disabled':'Invalid') );
    createBoolDatapoint(path + '.fullRemoteControl', 'The device can be controlled from remote.', currentDeviceState.remoteEnable.fullRemoteControl);
    createBoolDatapoint(path + '.smartGrid', 'The device is set to Smart Grid mode.', currentDeviceState.remoteEnable.smartGrid);
}

function addDeviceNicknameAction(path, mieledevice) {
    adapter.log.debug( 'addDeviceNicknameAction: Path:['+ path +'], mieledevice:['+JSON.stringify(mieledevice)+']' );
    // addDeviceNicknameAction - suitable for each and every device
    createExtendObject(path + '.ACTIONS.Nickname', {
        type: 'state',
        common: {
            name: 'Nickname of your device. Can be edited in Miele APP or here!',
            read: true,
            write: true,
            type: 'String'
        },
        native: {}
    });
    adapter.setState(path + '.ACTIONS.Nickname', (mieledevice.ident.deviceName === '' ? mieledevice.ident.type.value_localized : mieledevice.ident.deviceName), true);
    adapter.subscribeStates(path + '.ACTIONS.Nickname');
}

function addPowerActionButtons(path) {
    // addPowerOnAction
    addActionButton(path,'Power On', 'Power the Device on.');
    // addPowerOffAction
    addActionButton(path,'Power Off', 'Power the Device off.');
}

function addStartActionButton(path) {
    // addStartAction
    addActionButton(path,'Start', 'Starts the Device.', 'button.start');
}

function addStopActionButton(path) {
    // addStopAction
    addActionButton(path,'Stop', 'Stops the Device.', 'button.stop');
}

function addStartStopActionButtons(path) {
    addStartActionButton(path);
    addStopActionButton(path);
}

function addLightActionButtons(path) {
    // addLightOnAction
    addActionButton(path,'Light On', 'Switches the lights of the Device on.');
    // addLightOffAction
    addActionButton(path,'Light Off', 'Switches the lights of the Device off.');
}

function addSupercoolingActionButtons(path) {
    // addLightOnAction
    addActionButton(path,'Start Supercooling', 'Brings the Device into Supercooling mode.');
    // addLightOffAction
    addActionButton(path,'Stop Supercooling', 'Brings the Device out of Supercooling mode.');
}

function addSuperfreezingActionButtons(path) {
    // addLightOnAction
    addActionButton(path,'Start Superfreezing', 'Brings the Device into Superfreezing mode.');
    // addLightOffAction
    addActionButton(path,'Stop Superfreezing', 'Brings the Device out of Superfreezing mode.');
}

function addMieleDeviceActions(path, DeviceType){
    adapter.log.debug(`addMieleDeviceActions: Path: [${path}]`);
    // Create ACTIONS folder if not already existing
    createExtendObject(path + '.ACTIONS', {
        type: 'channel',
        common: {name: 'Supported Actions for this device.', read: true, write: true},
        native: {}
    });

    // Add Actions depending on devicetype
    switch (DeviceType) {
        case 1:
        case 2:
        case 7:
            addPowerActionButtons(path);
            addStartStopActionButtons(path);
            // addStartTimeAction
            break;
        case 12:
        case 13:
            // addStopAction
            addStopActionButton(path);
            break;
        case 17:
        case 18:
            // addStopAction
            addStopActionButton(path);
            // addLightEnable
            // addLightDisable
            addLightActionButtons(path);
            break;
        case 19:
            // addStartSuperCoolingAction
            // addStopSuperCoolingAction
            addSupercoolingActionButtons(path);
            break;
        case 20:
            // addStartSuperFreezingAction
            // addStopSuperFreezingAction
            addSuperfreezingActionButtons(path);
            break;
        case 21:
            // addStartSuperCoolingAction
            // addStopSuperCoolingAction
            addSupercoolingActionButtons(path);
            // addStartSuperFreezingAction
            // addStopSuperFreezingAction
            addSuperfreezingActionButtons(path);
            break;
        case 24:
            // addStopAction
            addStopActionButton(path);
            break;
        case 31:
            // addStopAction
            addStopActionButton(path);
            break;
        case 32:
            // addLightEnable
            // addLightDisable
            addLightActionButtons(path);
            break;
        case 33:
            // addLightEnable
            // addLightDisable
            addLightActionButtons(path);
            break;
        case 34:
            // addLightEnable
            // addLightDisable
            addLightActionButtons(path);
            break;
        case 45:
            // addStopAction
            addStopActionButton(path);
            break;
        case 67:
            // addStopAction
            addStopActionButton(path);
            break;
        case 68:
            // addLightEnable
            // addLightDisable
            addLightActionButtons(path);
            // addStartSuperFreezingAction
            // addStopSuperFreezingAction
            addSuperfreezingActionButtons(path);
            break;
    }
}

function refreshMieledata(err){
    APIGetDevices(REFRESH_TOKEN, ACCESS_TOKEN, adapter.config.locale, function (err, data, atoken, rtoken) {
        if (err) {
            adapter.log.error('*** Error during APIGetDevices. ***');
            adapter.log.error('Errormessage: ' + err);
        }else{
            splitMieleDevices(data);
        }
        return err;
    });
}

/*
 * decrypt
 */
function decrypt(key, value) {
    let result = '';
    for (let i = 0; i < value.length; ++i) {
        result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
    }
    return result;
}

/*
 *  Main function
 */
function main() {
    // The adapters config (in the instance object everything under the attribute "native") is accessible via
    // ADAPTER.config:
    if (adapter.config.Miele_account && adapter.config.Miele_pwd && adapter.config.Client_ID && adapter.config.Client_secret && adapter.config.locale && adapter.config.oauth2_vg && adapter.config.pollinterval) {
        adapter.log.debug('*** Trying to get Authorization Tokens ***');
        APIGetAccessToken( function (err, access_token, refresh_token) {
            if (err) {
                adapter.log.error('Error during Access-Token request.');
                adapter.log.error('Errormessage : ' + err);
            } else {
                // put tokens to global variables
                ACCESS_TOKEN  = access_token;
                REFRESH_TOKEN = refresh_token;
                adapter.log.info('Starting Polltimer with a ' +  adapter.config.pollinterval + ' Minutes interval.');
                // start refresh scheduler with interval from adapters config
                pollTimeout= setTimeout(function schedule() {
                    adapter.log.debug("Updating device states (polling API scheduled).");
                    refreshMieledata(err);
                    pollTimeout= setTimeout(schedule , adapter.config.pollinterval * 60000);
                    } , 100);
            }
        });
    } else {
        adapter.log.warn('Adapter config is invalid. Please fix.');
        proofAdapterConfig();
        adapter.setState('info.connection', false);
        adapter.terminate('Invalid Configuration.', 11);
    }
}//End Function main


// API-Functions
function APIGetAccessToken(callback) {
    let options = {
        url: BaseURL + 'thirdparty/token/',
        method: 'POST',
        form: {
            grant_type: 'password',
            password: adapter.config.Miele_pwd,
            username: adapter.config.Miele_account,
            client_id: adapter.config.Client_ID,
            client_secret: adapter.config.Client_secret,
            vg: adapter.config.oauth2_vg
        },
        headers: {accept: 'application/json; charset=utf-8'}
    };
    adapter.log.debug('OAuth2-URL: ['            + options.url + ']');
    adapter.log.debug('OAuth2 grant_type: ['     + options.form.grant_type + ']');
    adapter.log.debug('options OAuth2-VG: ['     + options.form.vg + ']');
    adapter.log.debug('config API Language: ['   + adapter.config.locale + ']');
    adapter.log.debug('options Miele_account: [' + options.form.username + ']');
    adapter.log.debug('options Client_ID: ['     + options.form.client_id + ']');
    // Logging of passwords has been commended out intentionally. May be enabled again by user for debugging purposes
    // ADAPTER.log.debug('options Miele_Password: ['+ ADAPTER.config.Miele_pwd + ']');
    // ADAPTER.log.debug('options Client_Secret: [' + options.form.client_secret + ']');

    request(options, function (error, response, body) {
            if (response.statusCode === 200) {
                let P = JSON.parse(body);
                // let expiry = now + expiry in seconds
                expiryDate = new Date();
                expiryDate.setSeconds(expiryDate.getSeconds() + P.expires_in );
                adapter.log.info('Got new Access-Token!');
                adapter.log.debug('New Access-Token:  [' + P.access_token + ']');
                adapter.log.debug('Access-Token-Type:  [' + P.token_type + ']');
                adapter.log.info('Access-Token expires in:  [' + P.expires_in + '] Seconds (='+ P.expires_in/3600 +'hours  = '+ P.expires_in/86400 +'days)');
                adapter.log.info('Access-Token expires at:  [' + expiryDate.toString() + ']');
                adapter.log.debug('New Refresh-Token: [' + P.refresh_token + ']');
                // ADAPTER.log.debug('plain body:  [' + body + ']');
                adapter.setState('info.connection', true);
                return callback(false, P.access_token, P.refresh_token);
            } else {
                adapter.log.error('*** Error during APIGetAccessToken ***');
                adapter.log.error('HTTP-Responsecode: ' + response.statusCode);
                let message = JSON.parse(body).message;
                adapter.log.error('Response from Miele API: ' + message);
                if ( (message === 'Client credentials are not valid') || (message === 'username/password is invalid') ){
                    adapter.setState('info.connection', false);
                    adapter.terminate('Terminated due to invalid Client credentials. No need to try again.', 11);
                }
                return callback(true, null, null);
            }
        }
    )
}

function APIRefreshToken(callback) {
    let options = {
        url: BaseURL + 'thirdparty/token/',
        method: 'POST',
        form: {
            grant_type: 'refresh_token',
            refresh_token: adapter.config.refresh_token,
            client_id:     adapter.config.Client_ID,
            client_secret: adapter.config.Client_secret,
            vg: adapter.config.oauth2_vg
        },
        headers: {accept: 'application/json'}
    };
    adapter.log.debug('OAuth2-URL: ['            + options.url + ']');
    adapter.log.debug('options OAuth2-VG: ['     + options.form.oauth2_vg + ']');
    adapter.log.debug('refresh_token: ['         + options.form.refresh_token + ']');
    adapter.log.debug('options Client_ID: ['     + options.form.client_id + ']');

    request(options, function (error, response, body) {
            if (response.statusCode === 200) {
                let P = JSON.parse(body);
                expiryDate = new Date();
                expiryDate.setSeconds(expiryDate.getSeconds() + P.expires_in );
                adapter.log.info('Successfully refreshed Access-Token!');
                adapter.log.debug('New Access-Token:  [' + P.access_token + ']');
                adapter.log.debug('Access-Token-Type:  [' + P.token_type + ']');
                adapter.log.Info('Access-Token expires in:  [' + P.expires_in + '] Seconds (='+ P.expires_in/3600 +'hours  = '+ P.expires_in/86400 +'days)');
                adapter.log.info('Access-Token expires at:  [' + expiryDate.toString() + ']');
                adapter.log.debug('New Refresh-Token: [' + P.refresh_token + ']');
                // ADAPTER.log.debug('plain body:  [' + body + ']');
                return callback(false, P.access_token, P.refresh_token);
            } else {
                adapter.log.error('*** Error during APIRefreshToken ***');
                adapter.log.error('HTTP-Responsecode: ' + response.statusCode);
                let message = JSON.parse(body).message;
                adapter.log.error(message);
                return callback(true, null, null);
            }
        }
    )
}

function APIGetDevices(Refresh_Token, Access_Token, locale, callback) {
    adapter.log.debug("APIGetDevices: Querying devices from API.");
    APISendRequest(Refresh_Token, 'v1/devices/?language=' + locale, 'GET', Access_Token, '', function (err, data, atoken, rtoken) {
        if (!err) {
            return callback(err, data, atoken, rtoken)
        } else {
            adapter.log.error("Error during function APIGetDevices.");
            adapter.log.error('Errormessage : ' + err);        }
    });
}

function APIGetActions(Refresh_Token, Access_Token, device, callback) {
    adapter.log.debug("APIGetActions: Querying supported actions from API.");
    APISendRequest(Refresh_Token, 'v1/devices/' + device + '/actions', 'GET', Access_Token, '', function (err, data, atoken, rtoken) {
        if (!err) {
            adapter.log.debug(`Got DeviceActions: [${JSON.stringify(data)}]`);
            return callback(err, data, atoken, rtoken)
        } else {
            adapter.log.error("Error during function APIGetActions.");
            adapter.log.error('Errormessage : ' + err);
        }
    });
}

function APIStartAction(Refresh_Token, Access_Token, device, action) {
    APIStartAction(Refresh_Token, Access_Token, device, action, '');
}

function APIStartAction(Refresh_Token, Access_Token, path, action, value) {
    let currentAction;
    let paths = path.split('.');    // transform into array
    paths.pop();                    // remove last element of path
    let device = paths[3];          // device is the fourth element of the path array
    let currentPath = paths.join('.');         // join all elements back together
    adapter.log.debug("APIStartAction: received Action: ["+action+"] with value: ["+value+"] for device ["+device+"] / path:["+currentPath+"]");
    switch (action) {
        case 'Nickname': currentAction = {deviceName:value};
            break;
        case 'Power On': currentAction = {powerOn:true};
            break;
        case 'Power Off': currentAction = {powerOff:true};
            break;
        case 'Start': currentAction = {processAction:START};
            break;
        case 'Stop': currentAction = {processAction:STOP};
            break;
        case 'Pause': currentAction = {processAction:PAUSE};
            break;
        case 'Start Superfreezing': currentAction = {processAction:START_SUPERFREEZING};
            break;
        case 'Stop Superfreezing': currentAction = {processAction:STOP_SUPERFREEZING};
            break;
        case 'Start Supercooling': currentAction = {processAction:START_SUPERCOOLING};
            break;
        case 'Stop Supercooling': currentAction = {processAction:STOP_SUPERCOOLING};
            break;
        case 'Light On': currentAction = {light:LIGHT_ON};
            break;
        case 'Light Off': currentAction = {light:LIGHT_OFF};
            break;
    }
    adapter.log.debug("APIStartAction: Executing Action: [" +JSON.stringify(currentAction) +"]");
    APISendRequest(Refresh_Token, 'v1/devices/' + device + '/actions', 'PUT', Access_Token, currentAction, function (err, data, atoken, rtoken) {
        // return result of action back as datapoints in actions-folder
        createBoolDatapoint(currentPath + '.Action successful', 'Indicator if last executed Action has been successful.', !err);
        createStringDatapoint(currentPath + '.Action information', 'Additional Information returned from API.', action + ': ' + data.message);
        refreshMieledata(null);
        if (!err) {
            adapter.log.debug(`Result returned from Action(${action})-execution: [${JSON.stringify(data)}]`);
        } else {
            adapter.log.warn("Error during function APIStartAction.");
            adapter.log.warn('Errormessage : ' + JSON.stringify(data));
        }
    });
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
    adapter.log.debug('http request options: ['+JSON.stringify(options)+']');
    request(options, function (error, response, body) {
        adapter.log.debug('APISendRequest - HTTP StatusCode: ' + response.statusCode);
        adapter.log.debug('APISendRequest - Received body data: [' + JSON.stringify(body)+']');
        adapter.log.debug('APISendRequest - Received body data: [' + body+']');
        switch (response.statusCode) {
            case 200: // OK
            case 202: //Accepted, processing has not been completed.
                return callback(false, JSON.parse(body), null, null);
            case 204: // OK, No Content
                return callback(false, {"message":"OK"}, null, null);
            /*
           case 400: //Bad Request, message body will contain more information
               return callback(true, result, null, null);
             */
            case 401: //Unauthorized
                APIRefreshToken();
                break;
            default:
                // return callback(true, JSON.parse(body), null, null);
                return callback(true, body, null, null);
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