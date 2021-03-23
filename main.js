/* jshint -W097 */
/* jshint -W030 */
/* jshint strict:true */
/* jslint esversion: 6 */
/* jslint node: true */
'use strict';

/**
*
* mieleCloudService Adapter for ioBroker (main file)
*
*/

// you have to require the utils module and call adapter function
const adapterName = require('./package.json').name.split('.').pop();
const utils = require('@iobroker/adapter-core'); // Get common adapter utils
const mieleAPITools = require('./miele-apiTools.js');
const mieleTools = require('./miele-Tools.js');
const mieleConst = require('./miele-constants.js');

// Global Variables
let adapter;
let _auth;
let _pollTimeout;
let _expiryDate;
let _knownDevices = {}; // structure of _knownDevices{deviceId: {name:'', icon:'', deviceFolder:''}, ... }

function startadapter(options) {
    options = options || {};
    Object.assign(options, {
        // name has to be set and has to be equal to adapters folder name and main file name excluding extension
        name: adapterName,
        // is called when adapter shuts down - callback has to be called under any circumstances!
        unload: async function (callback) {
            try {
                if (_pollTimeout) {
                    adapter.log.info('Clearing Timeout: _pollTimeout');
                    clearTimeout(_pollTimeout);
                }
                adapter.unsubscribeObjects('*');
                adapter.unsubscribeStates('*');
                adapter.setState('info.connection', false);
                if (_auth.refresh_token) {
                    await mieleAPITools.APILogOff(adapter, _auth, "refresh_token")
                }
                if (_auth.access_token) {
                    await mieleAPITools.APILogOff(adapter, _auth, "access_token")
                }
                _auth = undefined;
                _pollTimeout = null;
                _expiryDate = null;
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
        stateChange: async function (id, state) {
            // Warning, state can be null if it was deleted
            if (state && !state.ack) {
              adapter.log.debug('ack is not set!');
              // you can use the ack flag to detect if it is status (true) or command (false)
              adapter.log.debug('stateChange [' + id + '] [' + JSON.stringify(state)+']');
              let action = id.split('.').pop();
                await mieleAPITools.APIStartAction(adapter, _auth, id, action, state.val, false);
            }
          },
        // stateChange: function(id, state){
        //    ADAPTER.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));
        // },
        // Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
        /* Currently not used ...
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
         */
        // is called when databases are connected and adapter received configuration.
        // start here!
        ready: async () => {
                // Execute main after passwords have been decrypted
                // The adapters config (in the instance object everything under the attribute "native") is accessible via
                // adapter.config:
                if ( mieleTools.adapterConfigIsValid(adapter) ) {
                    mieleTools.decryptPasswords(adapter)
                        .then(() => {
                            main();
                        })
                        .catch((error) => {
                            adapter.log.error(error);
                        });
                } else {
                    adapter.log.warn('Adapter config is invalid. Please fix.');
                    adapter.setState('info.connection', false);
                    adapter.terminate('Invalid Configuration.', 11);
                }
        }
    });
    // you have to call the adapter function and pass a options object
    // adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.mielecloudservice.0
    adapter = new utils.adapter(options);

    return adapter;
}



/**
 * Function getDeviceObj
 *
 * generates the deviceObj with specific information for this individual device type
 *
 * @param deviceTypeID {number} Miele device type ID which indicates the current device type
 */
function getDeviceObj(deviceTypeID){
    let deviceObj = {deviceFolder:'', name:'', icon:''};
    switch (deviceTypeID) {
        case 1 : // 1 = WASHING MACHINE*
            deviceObj.deviceFolder = 'Washing_machines';
            deviceObj.name  = 'Washing machines reported by Miele@Home API';
            deviceObj.icon = 'icons/01_washingmachine.svg'
            break;
        case 2: // 2 = TUMBLE DRYER*
            deviceObj.deviceFolder = 'Tumble_dryers';
            deviceObj.name  = 'Tumble dryers reported by Miele@Home API';
            deviceObj.icon = 'icons/02_dryer.svg'
            break;
        case 24: // 24 = WASHER DRYER*
            deviceObj.deviceFolder = 'Washer_Dryers';
            deviceObj.name  = 'Washer dryers reported by Miele@Home API';
            deviceObj.icon = 'icons/24_washerdryer.svg'
            break;
        case 7: // 7 = DISHWASHER*
        case 8: // 8 = DISHWASHER SEMI-PROF
            deviceObj.deviceFolder = 'Dishwashers';
            deviceObj.name  = 'Dishwashers reported by Miele@Home API';
            deviceObj.icon = 'icons/07_dishwasher.svg'
            break;
        case 12: // 12 = OVEN*
        case 39: // 39 = DOUBLE OVEN
        case 40: // 40 = DOUBLE STEAM OVEN
        case 41: // 41 = DOUBLE STEAM OVEN COMBINATION
        case 43: // 43 = DOUBLE MICROWAVE OVEN
        case 45: // 45 = STEAM OVEN MICROWAVE COMBINATION*
            deviceObj.deviceFolder = 'Ovens';
            deviceObj.description  = 'Ovens reported by Miele@Home API';
            deviceObj.icon = 'icons/12_oven.svg'
            break;
        case 13: // 13 = OVEN MICROWAVE*
            deviceObj.deviceFolder = 'Ovens';
            deviceObj.description  = 'Ovens reported by Miele@Home API';
            deviceObj.icon = 'icons/13_ovenmicrowave.svg'
            break;
        case 15: // 15 = STEAM OVEN*
            deviceObj.deviceFolder = 'Ovens';
            deviceObj.description  = 'Ovens reported by Miele@Home API';
            deviceObj.icon = 'icons/15_steamoven.svg'
            break;
        case 31: // 31 = STEAM OVEN COMBINATION*
            deviceObj.deviceFolder = 'Ovens';
            deviceObj.description  = 'Ovens reported by Miele@Home API';
            deviceObj.icon = 'icons/31_steamovencombination.svg'
            break;
        case 67: // 67 = DIALOG OVEN*
            deviceObj.deviceFolder = 'Ovens';
            deviceObj.description  = 'Ovens reported by Miele@Home API';
            deviceObj.icon = 'icons/67_dialogoven.svg'
            break;
        case 14: // 14 = HOB HIGHLIGHT*
        case 27: // 27 = HOB INDUCTION*
        case 28: // 28 = HOB GAS
            deviceObj.deviceFolder = 'Hobs';
            deviceObj.name  = 'Hobs reported by Miele@Home API';
            deviceObj.icon = 'icons/14_hobhighlight.svg'
            break;
        case 16: // 16 = MICROWAVE*
        case 42: // 42 = DOUBLE MICROWAVE
            deviceObj.deviceFolder = 'Microwaves';
            deviceObj.name  = 'Microwaves reported by Miele@Home API';
            deviceObj.icon = 'icons/16_microwave.svg'
            break;
        case 17: // 17 = COFFEE SYSTEM*
            deviceObj.deviceFolder = 'Coffee_Systems';
            deviceObj.name  = 'Coffee Systems reported by Miele@Home API';
            deviceObj.icon = 'icons/17_coffeesystem.svg'
            break;
        case 18: // 18 = HOOD*
            deviceObj.deviceFolder = 'Hoods';
            deviceObj.name  = 'Hoods reported by Miele@Home API';
            deviceObj.icon = 'icons/18_hood.svg'
            break;
        case 19: // 19 = FRIDGE*
            deviceObj.deviceFolder = 'Fridges';
            deviceObj.name  = 'Fridges reported by Miele@Home API';
            deviceObj.icon = 'icons/19_fridge.svg'
            break;
        case 20: // 20 = FREEZER*
            deviceObj.deviceFolder = 'Freezers';
            deviceObj.name  = 'Freezers reported by Miele@Home API';
            deviceObj.icon = 'icons/20_freezer.svg'
            break;
        case 21: // 21 = FRIDGE-/FREEZER COMBINATION*
            deviceObj.deviceFolder = 'Fridge/Freezer_Combination';
            deviceObj.name  = 'Fridge/Freezer combinations reported by Miele@Home API';
            deviceObj.icon = 'icons/21_fridgefreezer.svg'
            break;
        case 32: // 32 = WINE CABINET*
        case 33: // 33 = WINE CONDITIONING UNIT
        case 34: // 34 = WINE STORAGE CONDITIONING UNIT
        case 68: // 68 = WINE CABINET FREEZER COMBINATION
            deviceObj.deviceFolder = 'Wine_cabinets';
            deviceObj.name  = 'Wine cabinets reported by Miele@Home API';
            deviceObj.icon = 'icons/32_winecabinet.svg'
            break;
        case 23: // 23 = VACUUM CLEANER, AUTOMATIC ROBOTIC VACUUM CLEANER*
            deviceObj.deviceFolder = 'Vacuum_cleaners';
            deviceObj.name  = 'Vacuum cleaners reported by Miele@Home API';
            deviceObj.icon = 'icons/23_roboticvacuumcleaner.svg'
            break;
        case 25: // 25 = DISH WARMER*
            deviceObj.deviceFolder = 'Dish_warmers';
            deviceObj.name  = 'Dish warmers reported by Miele@Home API';
            deviceObj.icon = 'icons/25_dishwarmer.svg'
            break;
        case 48: // 48 = VACUUM DRAWER
            deviceObj.deviceFolder = 'Vacuum_drawers';
            deviceObj.name  = 'Vacuum drawers reported by Miele@Home API';
            deviceObj.icon = 'icons/00_genericappliance.svg'
            break;
    }
    mieleTools.createExtendObject(adapter, deviceObj.deviceFolder, {
        type: 'channel',
        common: deviceObj,
        native: {}
    }, null);
    return deviceObj;
}



/**
 * Function splitMieleDevices
 *
 * splits the json data received from cloud API into separate device
 *
 * @param devices {object} the whole JSON which needs to be split into devices
 * @param setup {boolean} indicator whether the devices need to setup or only states are to be updated
 */
async function splitMieleDevices(devices, setup){
    // Splits the data-package returned by the API into single devices
    // and lets you iterate over each single device
    adapter.log.debug('[splitMieleDevices] Splitting JSON to single devices.');
    for (let mieleDevice in devices) {
        adapter.log.debug('splitMieleDevices: ' + mieleDevice+ ': [' + mieleDevice + '] *** Value: [' + JSON.stringify(devices[mieleDevice]) + ']');
        if (devices[mieleDevice].ident.deviceIdentLabel.fabNumber === ''){
            adapter.log.debug('Device: [' + mieleDevice + '] has no serial number/fabNumber. Taking DeviceNumber instead.');
            devices[mieleDevice].ident.deviceIdentLabel.fabNumber = mieleDevice;
        }
        await parseMieleDevice(devices[mieleDevice], setup);
    }
}



/**
 * Function parseMieleDevice
 *
 * parses the JSON of each single device and creates the needed states
 *
 * @param mieleDevice {object} the JSON for a single device
 * @param setup {boolean} indicator whether the devices need to setup or only states are to be updated
 */
async function parseMieleDevice(mieleDevice, setup){
    adapter.log.debug('This is a ' + mieleDevice.ident.type.value_localized );

    const deviceObj = getDeviceObj(mieleDevice.ident.type.value_raw); // create folder for device
    if (setup) {
        _knownDevices[mieleDevice.ident.deviceIdentLabel.fabNumber]=deviceObj;
        adapter.log.debug(`_knownDevices=${JSON.stringify(_knownDevices)}`)
    }
    await addMieleDevice(deviceObj.deviceFolder, mieleDevice, setup);
}



/**
 * Function addMieleDevice
 *
 * adds the current miele device to the device tree beneath it's device type folder (channel)
 *
 * @param path {string} path where the device is to be created (aka deviceFolder)
 * @param mieleDevice {object} the JSON for a single device
 * @param setup {boolean} indicator whether the devices need to setup or only states are to be updated
 */
async function addMieleDevice(path, mieleDevice, setup){
    let newPath = path + '.' + mieleDevice.ident.deviceIdentLabel.fabNumber;
    adapter.log.debug('addMieleDevice: NewPath = [' + newPath + ']');

    mieleTools.createExtendObject(adapter, newPath, {
        type: 'device',
        common: {name:   (mieleDevice.ident.deviceName === ''? mieleDevice.ident.type.value_localized: mieleDevice.ident.deviceName),
            read: true,
            write: false,
            icon: _knownDevices[mieleDevice.ident.deviceIdentLabel.fabNumber].icon
        },
        native: {}
    }, null);

    mieleTools.createChannelActions(adapter, newPath, setup) ;
    mieleTools.createChannelIdent(adapter, newPath, setup) ;
    // add device states and ident
    for (let deviceInfo in mieleDevice){
        adapter.log.debug('addMieleDevice:' + deviceInfo);
        switch (deviceInfo) {
            case 'ident':
                if (setup) {
                    await mieleTools.addMieleDeviceIdent(adapter, newPath + '.IDENT', mieleDevice[deviceInfo], setup);
                }
                break;
            case 'state':
                await addMieleDeviceState(newPath, mieleDevice, mieleDevice[deviceInfo], setup);
                break;
        }
    }
}



/**
 * Function addMieleDeviceState
 *
 * adds the current miele device states to the device tree beneath it's device type folder (channel) and device Id (device)
 *
 * @param path {string} path where the device is to be created (aka deviceFolder)
 * @param currentDevice {object} the complete JSON for the current device
 * @param currentDeviceState {object} the JSON for a single device
 * @param setup {boolean} indicator whether the devices need to setup or only states are to be updated
 */
async function addMieleDeviceState(path, currentDevice, currentDeviceState, setup,){
    // create for ALL devices
    await mieleTools.createStateDeviceMainState(adapter, setup,  `${path}.${currentDeviceState.status.key_localized}`, currentDeviceState.status.value_localized, currentDeviceState.status.value_raw);
    await mieleTools.createStateSignalFailure(adapter, setup, path, currentDeviceState.signalFailure);
    // set the values for self designed redundant state indicators
    await mieleTools.createStateConnected(adapter, setup, path, currentDeviceState.status.value_raw !== 255);
    await mieleTools.createStateSignalInUse(adapter, setup, path, currentDeviceState.status.value_raw !== 1);
    // nickname action is supported by all devices
    await mieleTools.createStateActionsInformation(adapter, setup, path, '');
    await mieleTools.addDeviceNicknameAction(adapter, path, currentDevice);

    // checkPermittedActions
    const actions = await mieleAPITools.getPermittedActions(adapter, _auth, currentDevice.ident.deviceIdentLabel.fabNumber);
    adapter.log.debug('CurrentlyPermittedActions: ' + JSON.stringify(actions));

    try{
        // set/create device dependant states
        switch (currentDevice.ident.type.value_raw) {
            case 1 : // 1 = WASHING MACHINE*
                // setup ecoFeedback channel for this device if needed
                mieleTools.createChannelEcoFeedback(adapter, path, setup) ;
                // states
                await mieleTools.createStateProgramID(adapter, setup, `${path}.${currentDeviceState.ProgramID.key_localized}`, currentDeviceState.ProgramID.value_localized, currentDeviceState.ProgramID.value_raw );
                await mieleTools.createStateProgramType(adapter, setup, `${path}.${currentDeviceState.programType.key_localized}`, currentDeviceState.programType.value_localized, currentDeviceState.programType.value_raw );
                await mieleTools.createStateProgramPhase(adapter, setup, `${path}.${currentDeviceState.programPhase.key_localized}`, currentDeviceState.programPhase.value_localized, currentDeviceState.programPhase.value_raw );
                await mieleTools.createStateRemainingTime(adapter, setup, path, currentDeviceState.remainingTime);
                await mieleTools.createStateStartTime(adapter, setup, path, currentDeviceState.startTime);
                await mieleTools.createStateSignalInfo(adapter, setup, path, currentDeviceState.signalInfo);
                await mieleTools.createStateFullRemoteControl(adapter, setup, path, currentDeviceState.remoteEnable.fullRemoteControl);
                await mieleTools.createStateSmartGrid(adapter, setup, path, currentDeviceState.remoteEnable.smartGrid);
                await mieleTools.createStateMobileStart(adapter, setup, path, currentDeviceState.remoteEnable.mobileStart);
                await mieleTools.createStateEstimatedEndTime(adapter, setup, path, currentDeviceState.remainingTime);
                await mieleTools.createStateElapsedTime(adapter, setup, path, currentDeviceState.elapsedTime);
                await mieleTools.createStateSpinningSpeed(adapter, setup, `${path}.${currentDeviceState.spinningSpeed.key_localized}`, currentDeviceState.spinningSpeed.value_localized, currentDeviceState.spinningSpeed.unit);
                await mieleTools.createStateEcoFeedbackEnergy(adapter, setup, path, currentDeviceState.ecoFeedback);
                await mieleTools.createStateEcoFeedbackWater(adapter, setup, path, currentDeviceState.ecoFeedback);
                // actions
                await mieleTools.addPowerSwitch(adapter, path, actions);
                await mieleTools.addStartButton(adapter, setup, path, Array(actions.processAction).includes(mieleConst.START));
                await mieleTools.addStopButton(adapter, setup, path, Array(actions.processAction).includes(mieleConst.STOP));
                break;
            case 2: // 2 = TUMBLE DRYER*
                // setup ecoFeedback channel for this device if needed
                mieleTools.createChannelEcoFeedback(adapter, path, setup) ;
                // states
                await mieleTools.createStateProgramID(adapter, setup, `${path}.${currentDeviceState.ProgramID.key_localized}`, currentDeviceState.ProgramID.value_localized, currentDeviceState.ProgramID.value_raw );
                await mieleTools.createStateProgramType(adapter, setup, `${path}.${currentDeviceState.programType.key_localized}`, currentDeviceState.programType.value_localized, currentDeviceState.programType.value_raw );
                await mieleTools.createStateProgramPhase(adapter, setup, `${path}.${currentDeviceState.programPhase.key_localized}`, currentDeviceState.programPhase.value_localized, currentDeviceState.programPhase.value_raw );
                await mieleTools.createStateRemainingTime(adapter, setup, path, currentDeviceState.remainingTime);
                await mieleTools.createStateStartTime(adapter, setup, path, currentDeviceState.startTime);
                await mieleTools.createStateSignalInfo(adapter, setup, path, currentDeviceState.signalInfo);
                await mieleTools.createStateFullRemoteControl(adapter, setup, path, currentDeviceState.remoteEnable.fullRemoteControl);
                await mieleTools.createStateSmartGrid(adapter, setup, path, currentDeviceState.remoteEnable.smartGrid);
                await mieleTools.createStateMobileStart(adapter, setup, path, currentDeviceState.remoteEnable.mobileStart);
                await mieleTools.createStateEstimatedEndTime(adapter, setup, path, currentDeviceState.remainingTime);
                await mieleTools.createStateElapsedTime(adapter, setup, path, currentDeviceState.elapsedTime);
                await mieleTools.createStateDryingStep(adapter, setup, `${path}.${currentDeviceState.dryingStep.key_localized}`, currentDeviceState.dryingStep.value_localized, currentDeviceState.dryingStep.value_raw );
                await mieleTools.createStateEcoFeedbackEnergy(adapter, setup, path, currentDeviceState.ecoFeedback);
                // Actions
                await mieleTools.addPowerSwitch(adapter, path, actions);
                await mieleTools.addStartButton(adapter, setup, path, Array(actions.processAction).includes(mieleConst.START));
                await mieleTools.addStopButton(adapter, setup, path, Array(actions.processAction).includes(mieleConst.STOP));
                break;
            case 24: // 24 = WASHER DRYER*
                // setup ecoFeedback channel for this device if needed
                mieleTools.createChannelEcoFeedback(adapter, path, setup) ;
                // states
                await mieleTools.createStateProgramID(adapter, setup, `${path}.${currentDeviceState.ProgramID.key_localized}`, currentDeviceState.ProgramID.value_localized, currentDeviceState.ProgramID.value_raw );
                await mieleTools.createStateProgramType(adapter, setup, `${path}.${currentDeviceState.programType.key_localized}`, currentDeviceState.programType.value_localized, currentDeviceState.programType.value_raw );
                await mieleTools.createStateProgramPhase(adapter, setup, `${path}.${currentDeviceState.programPhase.key_localized}`, currentDeviceState.programPhase.value_localized, currentDeviceState.programPhase.value_raw );
                await mieleTools.createStateRemainingTime(adapter, setup, path, currentDeviceState.remainingTime);
                await mieleTools.createStateStartTime(adapter, setup, path, currentDeviceState.startTime);
                await mieleTools.createStateSignalInfo(adapter, setup, path, currentDeviceState.signalInfo);
                await mieleTools.createStateFullRemoteControl(adapter, setup, path, currentDeviceState.remoteEnable.fullRemoteControl);
                await mieleTools.createStateSmartGrid(adapter, setup, path, currentDeviceState.remoteEnable.smartGrid);
                await mieleTools.createStateMobileStart(adapter, setup, path, currentDeviceState.remoteEnable.mobileStart);
                await mieleTools.createStateEstimatedEndTime(adapter, setup, path, currentDeviceState.remainingTime);
                await mieleTools.createStateElapsedTime(adapter, setup, path, currentDeviceState.elapsedTime);
                await mieleTools.createStateSpinningSpeed(adapter, setup, `${path}.${currentDeviceState.spinningSpeed.key_localized}`, currentDeviceState.spinningSpeed.value_localized, currentDeviceState.spinningSpeed.unit);
                await mieleTools.createStateDryingStep(adapter, setup, `${path}.${currentDeviceState.dryingStep.key_localized}`, currentDeviceState.dryingStep.value_localized, currentDeviceState.dryingStep.value_raw );
                await mieleTools.createStateEcoFeedbackEnergy(adapter, setup, path, currentDeviceState.ecoFeedback);
                await mieleTools.createStateEcoFeedbackWater(adapter, setup, path, currentDeviceState.ecoFeedback);
                // Actions
                await mieleTools.addPowerSwitch(adapter, path, actions);
                await mieleTools.addStartButton(adapter, setup, path, Array(actions.processAction).includes(mieleConst.START));
                await mieleTools.addStopButton(adapter, setup, path, Array(actions.processAction).includes(mieleConst.STOP));
                break;
            case 7: // 7 = DISHWASHER*
            case 8: // 8 = DISHWASHER SEMI-PROF
                // setup ecoFeedback channel for this device if needed
                mieleTools.createChannelEcoFeedback(adapter, path, setup) ;
                // states
                await mieleTools.createStateProgramID(adapter, setup, `${path}.${currentDeviceState.ProgramID.key_localized}`, currentDeviceState.ProgramID.value_localized, currentDeviceState.ProgramID.value_raw );
                await mieleTools.createStateProgramType(adapter, setup, `${path}.${currentDeviceState.programType.key_localized}`, currentDeviceState.programType.value_localized, currentDeviceState.programType.value_raw );
                await mieleTools.createStateProgramPhase(adapter, setup, `${path}.${currentDeviceState.programPhase.key_localized}`, currentDeviceState.programPhase.value_localized, currentDeviceState.programPhase.value_raw );
                await mieleTools.createStateRemainingTime(adapter, setup, path, currentDeviceState.remainingTime);
                await mieleTools.createStateStartTime(adapter, setup, path, currentDeviceState.startTime);
                await mieleTools.createStateSignalInfo(adapter, setup, path, currentDeviceState.signalInfo);
                await mieleTools.createStateSignalDoor(adapter, setup, path, currentDeviceState.signalDoor);
                await mieleTools.createStateFullRemoteControl(adapter, setup, path, currentDeviceState.remoteEnable.fullRemoteControl);
                await mieleTools.createStateSmartGrid(adapter, setup, path, currentDeviceState.remoteEnable.smartGrid);
                await mieleTools.createStateMobileStart(adapter, setup, path, currentDeviceState.remoteEnable.mobileStart);
                await mieleTools.createStateEstimatedEndTime(adapter, setup, path, currentDeviceState.remainingTime);
                await mieleTools.createStateElapsedTime(adapter, setup, path, currentDeviceState.elapsedTime);
                await mieleTools.createStateEcoFeedbackEnergy(adapter, setup, path, currentDeviceState.ecoFeedback);
                await mieleTools.createStateEcoFeedbackWater(adapter, setup, path, currentDeviceState.ecoFeedback);
                // Actions
                await mieleTools.addPowerSwitch(adapter, path, actions);
                await mieleTools.addStartButton(adapter, setup, path, Array(actions.processAction).includes(mieleConst.START));
                await mieleTools.addStopButton(adapter, setup, path, Array(actions.processAction).includes(mieleConst.STOP));
                break;
            case 12: // 12 = OVEN*
                await mieleTools.createStateProgramID(adapter, setup, `${path}.${currentDeviceState.ProgramID.key_localized}`, currentDeviceState.ProgramID.value_localized, currentDeviceState.ProgramID.value_raw );
                await mieleTools.createStateProgramType(adapter, setup, `${path}.${currentDeviceState.programType.key_localized}`, currentDeviceState.programType.value_localized, currentDeviceState.programType.value_raw );
                await mieleTools.createStateProgramPhase(adapter, setup, `${path}.${currentDeviceState.programPhase.key_localized}`, currentDeviceState.programPhase.value_localized, currentDeviceState.programPhase.value_raw );
                await mieleTools.createStateRemainingTime(adapter, setup, path, currentDeviceState.remainingTime);
                await mieleTools.createStateStartTime(adapter, setup, path, currentDeviceState.startTime);
                await mieleTools.createStateSignalInfo(adapter, setup, path, currentDeviceState.signalInfo);
                await mieleTools.createStateSignalDoor(adapter, setup, path, currentDeviceState.signalDoor);
                await mieleTools.createStateFullRemoteControl(adapter, setup, path, currentDeviceState.remoteEnable.fullRemoteControl);
                await mieleTools.createStateSmartGrid(adapter, setup, path, currentDeviceState.remoteEnable.smartGrid);
                await mieleTools.createStateMobileStart(adapter, setup, path, currentDeviceState.remoteEnable.mobileStart);
                await mieleTools.createStateEstimatedEndTime(adapter, setup, path, currentDeviceState.remainingTime);
                await mieleTools.createStateElapsedTime(adapter, setup, path, currentDeviceState.elapsedTime);
                await mieleTools.createStateTemperature(adapter, setup, path, currentDeviceState.temperature);
                await mieleTools.createStateTargetTemperature(adapter, setup, path, currentDeviceState.targetTemperature);
                // Actions
                await mieleTools.addStopButton(adapter, setup, path, Array(actions.processAction).includes(mieleConst.STOP));
                await mieleTools.addLightSwitch(adapter, setup, path, actions);
                break;
            case 13: // 13 = OVEN Microwave*
            case 15: // 15 = STEAM OVEN*
            case 16: // 16 = MICROWAVE*
            case 31: // 31 = STEAM OVEN COMBINATION*
            case 45: // 45 = STEAM OVEN MICROWAVE COMBINATION*
            case 67: // 67 = DIALOG OVEN*
                await mieleTools.createStateProgramID(adapter, setup, `${path}.${currentDeviceState.ProgramID.key_localized}`, currentDeviceState.ProgramID.value_localized, currentDeviceState.ProgramID.value_raw );
                await mieleTools.createStateProgramType(adapter, setup, `${path}.${currentDeviceState.programType.key_localized}`, currentDeviceState.programType.value_localized, currentDeviceState.programType.value_raw );
                await mieleTools.createStateProgramPhase(adapter, setup, `${path}.${currentDeviceState.programPhase.key_localized}`, currentDeviceState.programPhase.value_localized, currentDeviceState.programPhase.value_raw );
                await mieleTools.createStateRemainingTime(adapter, setup, path, currentDeviceState.remainingTime);
                await mieleTools.createStateStartTime(adapter, setup, path, currentDeviceState.startTime);
                await mieleTools.createStateSignalInfo(adapter, setup, path, currentDeviceState.signalInfo);
                await mieleTools.createStateSignalDoor(adapter, setup, path, currentDeviceState.signalDoor);
                await mieleTools.createStateFullRemoteControl(adapter, setup, path, currentDeviceState.remoteEnable.fullRemoteControl);
                await mieleTools.createStateSmartGrid(adapter, setup, path, currentDeviceState.remoteEnable.smartGrid);
                await mieleTools.createStateMobileStart(adapter, setup, path, currentDeviceState.remoteEnable.mobileStart);
                await mieleTools.createStateEstimatedEndTime(adapter, setup, path, currentDeviceState.remainingTime);
                await mieleTools.createStateElapsedTime(adapter, setup, path, currentDeviceState.elapsedTime);
                await mieleTools.createStateTemperature(adapter, setup, path, currentDeviceState.temperature);
                await mieleTools.createStateTargetTemperature(adapter, setup, path, currentDeviceState.targetTemperature);
                // Actions
                await mieleTools.addPowerSwitch(adapter, path, actions);
                await mieleTools.addLightSwitch(adapter, setup, path, actions);
                await mieleTools.addStopButton(adapter, setup, path, Array(actions.processAction).includes(mieleConst.STOP));
                break;
            case 14: // 14 = HOB HIGHLIGHT*
            case 27: // 27 = HOB INDUCTION*
                await mieleTools.createStatePlateStep(adapter, setup, path, currentDeviceState.plateStep);
                break;
            case 17: // 17 = COFFEE SYSTEM*
                await mieleTools.createStateProgramID(adapter, setup, `${path}.${currentDeviceState.ProgramID.key_localized}`, currentDeviceState.ProgramID.value_localized, currentDeviceState.ProgramID.value_raw );
                await mieleTools.createStateProgramPhase(adapter, setup, `${path}.${currentDeviceState.programPhase.key_localized}`, currentDeviceState.programPhase.value_localized, currentDeviceState.programPhase.value_raw );
                await mieleTools.createStateSignalInfo(adapter, setup, path, currentDeviceState.signalInfo);
                await mieleTools.createStateFullRemoteControl(adapter, setup, path, currentDeviceState.remoteEnable.fullRemoteControl);
                await mieleTools.createStateSmartGrid(adapter, setup, path, currentDeviceState.remoteEnable.smartGrid);
                await mieleTools.createStateMobileStart(adapter, setup, path, currentDeviceState.remoteEnable.mobileStart);
                // Actions
                await mieleTools.addPowerSwitch(adapter, path, actions);
                await mieleTools.addLightSwitch(adapter, setup, path, actions);
                break;
            case 18: // 18 = HOOD*
                await mieleTools.createStateSignalInfo(adapter, setup, path, currentDeviceState.signalInfo);
                await mieleTools.createStateFullRemoteControl(adapter, setup, path, currentDeviceState.remoteEnable.fullRemoteControl);
                await mieleTools.createStateSmartGrid(adapter, setup, path, currentDeviceState.remoteEnable.smartGrid);
                await mieleTools.createStateMobileStart(adapter, setup, path, currentDeviceState.remoteEnable.mobileStart);
                await mieleTools.createStateVentilationStep(adapter, setup, path,currentDeviceState.ventilationStep.value_localized);
                // Actions
                await mieleTools.addPowerSwitch(adapter, path, actions);
                await mieleTools.addLightSwitch(adapter, setup, path, actions);
                await mieleTools.addStopButton(adapter, setup, path, Array(actions.processAction).includes(mieleConst.STOP));
                await mieleTools.addVentilationStepSwitch(adapter, setup, path);
                await mieleTools.addColorsAction(adapter, setup, path);
                // colors
                break;
            case 19: // 19 = FRIDGE*
                await mieleTools.createStateSignalInfo(adapter, setup, path, currentDeviceState.signalInfo);
                await mieleTools.createStateSignalDoor(adapter, setup, path, currentDeviceState.signalDoor);
                await mieleTools.createStateFullRemoteControl(adapter, setup, path, currentDeviceState.remoteEnable.fullRemoteControl);
                await mieleTools.createStateSmartGrid(adapter, setup, path, currentDeviceState.remoteEnable.smartGrid);
                await mieleTools.createStateMobileStart(adapter, setup, path, currentDeviceState.remoteEnable.mobileStart);
                await mieleTools.createStateTemperature(adapter, setup, path, currentDeviceState.temperature);
                await mieleTools.createStateTargetTemperatureFridge(adapter, setup, path, currentDeviceState.targetTemperature.hasOwnProperty('zone')?  currentDeviceState.targetTemperature.zone[1].value : null);
                await mieleTools.createStateTargetTemperatureFreezer(adapter, setup, path, currentDeviceState.targetTemperature.hasOwnProperty('zone')?  currentDeviceState.targetTemperature.zone[2].value : null);
                // Actions
                await mieleTools.addSuperCoolingSwitch(adapter, setup, path, actions);
                break;
            case 20: // 20 = FREEZER*
                await mieleTools.createStateSignalInfo(adapter, setup, path, currentDeviceState.signalInfo);
                await mieleTools.createStateSignalDoor(adapter, setup, path, currentDeviceState.signalDoor);
                await mieleTools.createStateFullRemoteControl(adapter, setup, path, currentDeviceState.remoteEnable.fullRemoteControl);
                await mieleTools.createStateSmartGrid(adapter, setup, path, currentDeviceState.remoteEnable.smartGrid);
                await mieleTools.createStateMobileStart(adapter, setup, path, currentDeviceState.remoteEnable.mobileStart);
                await mieleTools.createStateTemperature(adapter, setup, path, currentDeviceState.temperature);
                await mieleTools.createStateTargetTemperatureFridge(adapter, setup, path, currentDeviceState.targetTemperature.hasOwnProperty('zone')?  currentDeviceState.targetTemperature.zone[1].value : null);
                // Actions
                await mieleTools.addSuperFreezingSwitch(adapter, setup, path, actions);
                break;
            case 21: // 21 = FRIDGE-/FREEZER COMBINATION*
                await mieleTools.createStateSignalInfo(adapter, setup, path, currentDeviceState.signalInfo);
                await mieleTools.createStateSignalDoor(adapter, setup, path, currentDeviceState.signalDoor);
                await mieleTools.createStateFullRemoteControl(adapter, setup, path, currentDeviceState.remoteEnable.fullRemoteControl);
                await mieleTools.createStateSmartGrid(adapter, setup, path, currentDeviceState.remoteEnable.smartGrid);
                await mieleTools.createStateMobileStart(adapter, setup, path, currentDeviceState.remoteEnable.mobileStart);
                await mieleTools.createStateTemperature(adapter, setup, path, currentDeviceState.temperature);
                await mieleTools.createStateTargetTemperatureFridge(adapter, setup, path, currentDeviceState.targetTemperature.hasOwnProperty('zone')?  currentDeviceState.targetTemperature.zone[1].value : null);
                await mieleTools.createStateTargetTemperatureFreezer(adapter, setup, path, currentDeviceState.targetTemperature.hasOwnProperty('zone')?  currentDeviceState.targetTemperature.zone[2].value : null);
                // Actions
                await mieleTools.addSuperCoolingSwitch(adapter, setup, path, actions);
                await mieleTools.addSuperFreezingSwitch(adapter, setup, path, actions);
                break;
            case 32: // 32 = WINE CABINET*
            case 33: // 33 = WINE CONDITIONING UNIT
            case 34: // 34 = WINE STORAGE CONDITIONING UNIT
                await mieleTools.createStateSignalInfo(adapter, setup, path, currentDeviceState.signalInfo);
                await mieleTools.createStateSignalDoor(adapter, setup, path, currentDeviceState.signalDoor);
                await mieleTools.createStateFullRemoteControl(adapter, setup, path, currentDeviceState.remoteEnable.fullRemoteControl);
                await mieleTools.createStateSmartGrid(adapter, setup, path, currentDeviceState.remoteEnable.smartGrid);
                await mieleTools.createStateMobileStart(adapter, setup, path, currentDeviceState.remoteEnable.mobileStart);
                await mieleTools.createStateTemperature(adapter, setup, path, currentDeviceState.temperature);
                await mieleTools.createStateTargetTemperatureFridge(adapter, setup, path, currentDeviceState.targetTemperature.hasOwnProperty('zone')?  currentDeviceState.targetTemperature.zone[1].value : null);
                // Actions
                await mieleTools.addLightSwitch(adapter, setup, path, actions);
                break;
            case 28: // 28 = HOB GAS
                break;
            case 39: // 39 = DOUBLE OVEN
                break;
            case 40: // 40 = DOUBLE STEAM OVEN
                break;
            case 41: // 41 = DOUBLE STEAM OVEN COMBINATION
                break;
            case 42: // 42 = DOUBLE MICROWAVE
                break;
            case 43: // 43 = DOUBLE MICROWAVE OVEN
                break;
            case 68: // 68 = WINE CABINET FREEZER COMBINATION
                await mieleTools.createStateSignalInfo(adapter, setup, path, currentDeviceState.signalInfo);
                await mieleTools.createStateFullRemoteControl(adapter, setup, path, currentDeviceState.remoteEnable.fullRemoteControl);
                await mieleTools.createStateSmartGrid(adapter, setup, path, currentDeviceState.remoteEnable.smartGrid);
                await mieleTools.createStateMobileStart(adapter, setup, path, currentDeviceState.remoteEnable.mobileStart);
                await mieleTools.createStateTemperature(adapter, setup, path, currentDeviceState.temperature);
                await mieleTools.createStateTargetTemperatureFridge(adapter, setup, path, currentDeviceState.targetTemperature.hasOwnProperty('zone')?  currentDeviceState.targetTemperature.zone[1].value : null);
                await mieleTools.createStateTargetTemperatureFreezer(adapter, setup, path, currentDeviceState.targetTemperature.hasOwnProperty('zone')?  currentDeviceState.targetTemperature.zone[2].value : null);
                // Actions
                await mieleTools.addSuperFreezingSwitch(adapter, setup, path, actions);
                await mieleTools.addLightSwitch(adapter, setup, path, actions);
                await mieleTools.addModeSwitch(adapter, setup, path, actions);
                break;
            case 23: // 23 = VACUUM CLEANER, AUTOMATIC ROBOTIC VACUUM CLEANER*
                mieleTools.createStateBatteryLevel(adapter, setup, path, currentDeviceState.batteryLevel);
                // Actions
                mieleTools.addProgramIdAction(adapter, setup, path, currentDeviceState.programId);
                break;
            case 25: // 25 = DISH WARMER*
                await mieleTools.createStateSignalInfo(adapter, setup, path, currentDeviceState.signalInfo);
                // Actions
                mieleTools.addProgramIdAction(adapter, setup, path, currentDeviceState.programId);
                break;
            case 48: // 48 = VACUUM DRAWER
                break;
        }
    } catch(err){
        adapter.log.error('[addMieleDeviceState]: ' + err.message + ', Stacktrace: ' + err.stack);
    }
}



/**
 *  Main
 *
 */
async function main() {
    try {
        // todo: try 10 logins when it fails with a delay of 5 min each
        _auth = await mieleAPITools.APIGetAccessToken(adapter);
        if (_auth && _auth.hasOwnProperty('access_token') ) {
            adapter.log.info(`Setting up devices ...`);
            // do the first API call and setup all devices returned
            const result = await mieleAPITools.refreshMieleData( adapter, _auth );
            await splitMieleDevices(result, true);
            // start refresh scheduler with interval from adapters config
            adapter.log.info(`Starting poll timer with a [${adapter.config.pollinterval}] ${ adapter.config.pollUnit===1? 'Second(s)':'Minute(s)'} interval.`);
            try {
                _pollTimeout= setTimeout(async function schedule() {
                    adapter.log.debug("Updating device states (polling API scheduled).");
                    // don't setup devices again - only set states
                    const result = await mieleAPITools.refreshMieleData( adapter, _auth );
                    await splitMieleDevices(result, false);
                    _pollTimeout= setTimeout(schedule , (adapter.config.pollinterval * 1000 * adapter.config.pollUnit) );
                } , 10);

            } catch(err){
                adapter.log.error('Error during scheduled refresh. Error: ' + err.message + ', Stacktrace: ' + err.stack);
            }
        } else {
            adapter.log.error('[main] APIGetAccessToken returned neither a token nor an errormessage. Returned value=[' + JSON.stringify(_auth)+']');
        }
    } catch(err) {
        adapter.log.error('[main] :' + err.message + ', Stacktrace:' + err.stack);
        adapter.setState('info.connection', false);
    }
}//End Function main



// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startadapter;
} else {
    // or start the instance directly
    startadapter();
}