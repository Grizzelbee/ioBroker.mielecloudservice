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
let _sse;

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
                adapter.setState('info.connection', false, true);
                if (_auth.refresh_token) {
                    await mieleAPITools.APILogOff(adapter, _auth, "refresh_token")
                }
                if (_auth.access_token) {
                    await mieleAPITools.APILogOff(adapter, _auth, "access_token")
                }
                _auth = undefined;
                _pollTimeout = null;
                _expiryDate = null;
                _sse.close();
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
                // you can use the ack flag to detect if it is status (true) or command (false)
                adapter.log.debug('stateChange: [' + id + '] [' + JSON.stringify(state)+']');
                const action = id.split('.').pop();
                const deviceId = id.split('.', 3).pop();
                adapter.log.debug(`stateChange: DeviceId [${deviceId}], requested action [${action}], state [${state.val}]`);
                const actions = await mieleAPITools.getPermittedActions(adapter, _auth,  _knownDevices[deviceId].API_Id );
                adapter.log.debug(`stateChange: permitted actions for device [${deviceId}]->[${JSON.stringify(actions)}]`);
                await mieleAPITools.APIStartAction(adapter, _auth, id, action, state.val, false, _knownDevices);
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
                    adapter.setState('info.connection', false, true);
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
 * Function splitMieleDevices
 *
 * splits the json data received from cloud API into separate device
 *
 * @param {object} devices The whole JSON which needs to be split into devices
 * @param {string} devices.ident.deviceIdentLabel.fabNumber SerialNumber of the device
 * @param {boolean} setup  indicator whether the devices need to setup or only states are to be updated
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
        await parseMieleDevice(devices[mieleDevice], setup, mieleDevice);
    }
}



/**
 * Function getDeviceObj
 *
 * generates the deviceObj with specific information for this individual device type
 *
 * @param deviceTypeID {number} Miele device type ID which indicates the current device type
 */
function getDeviceObj(deviceTypeID){
    let deviceObj = {name:'', icon:''};
    switch (deviceTypeID) {
        case 1 : // 1 = WASHING MACHINE*
            deviceObj.icon = 'icons/01_washingmachine.svg'
            break;
        case 2: // 2 = TUMBLE DRYER*
            deviceObj.icon = 'icons/02_dryer.svg'
            break;
        case 24: // 24 = WASHER DRYER*
            deviceObj.icon = 'icons/24_washerdryer.svg'
            break;
        case 7: // 7 = DISHWASHER*
        case 8: // 8 = DISHWASHER SEMI-PROF
            deviceObj.icon = 'icons/07_dishwasher.svg'
            break;
        case 12: // 12 = OVEN*
        case 39: // 39 = DOUBLE OVEN
        case 40: // 40 = DOUBLE STEAM OVEN
        case 41: // 41 = DOUBLE STEAM OVEN COMBINATION
        case 43: // 43 = DOUBLE MICROWAVE OVEN
        case 45: // 45 = STEAM OVEN MICROWAVE COMBINATION*
            deviceObj.icon = 'icons/12_oven.svg'
            break;
        case 13: // 13 = OVEN MICROWAVE*
            deviceObj.icon = 'icons/13_ovenmicrowave.svg'
            break;
        case 15: // 15 = STEAM OVEN*
            deviceObj.icon = 'icons/15_steamoven.svg'
            break;
        case 31: // 31 = STEAM OVEN COMBINATION*
            deviceObj.icon = 'icons/31_steamovencombination.svg'
            break;
        case 67: // 67 = DIALOG OVEN*
            deviceObj.icon = 'icons/67_dialogoven.svg'
            break;
        case 14: // 14 = HOB HIGHLIGHT*
        case 27: // 27 = HOB INDUCTION*
        case 28: // 28 = HOB GAS
            deviceObj.icon = 'icons/14_hobhighlight.svg'
            break;
        case 16: // 16 = MICROWAVE*
        case 42: // 42 = DOUBLE MICROWAVE
            deviceObj.icon = 'icons/16_microwave.svg'
            break;
        case 17: // 17 = COFFEE SYSTEM*
            deviceObj.icon = 'icons/17_coffeesystem.svg'
            break;
        case 18: // 18 = HOOD*
            deviceObj.icon = 'icons/18_hood.svg'
            break;
        case 19: // 19 = FRIDGE*
            deviceObj.icon = 'icons/19_fridge.svg'
            deviceObj.fridgeZone = 1;
            break;
        case 20: // 20 = FREEZER*
            deviceObj.icon = 'icons/20_freezer.svg'
            deviceObj.freezerZone = 1;
            break;
        case 21: // 21 = FRIDGE-/FREEZER COMBINATION*
            deviceObj.icon = 'icons/21_fridgefreezer.svg'
            deviceObj.fridgeZone = 1;
            deviceObj.freezerZone = 2;
            break;
        case 32: // 32 = WINE CABINET*
        case 33: // 33 = WINE CONDITIONING UNIT
        case 34: // 34 = WINE STORAGE CONDITIONING UNIT
            deviceObj.icon = 'icons/32_winecabinet.svg'
            deviceObj.fridgeZone = 1;
            break;
        case 68: // 68 = WINE CABINET FREEZER COMBINATION
            deviceObj.icon = 'icons/32_winecabinet.svg'
            deviceObj.fridgeZone = 1;
            deviceObj.freezerZone = 2;
            break;
        case 23: // 23 = VACUUM CLEANER, AUTOMATIC ROBOTIC VACUUM CLEANER*
            deviceObj.icon = 'icons/23_roboticvacuumcleaner.svg'
            break;
        case 25: // 25 = DISH WARMER*
            deviceObj.icon = 'icons/25_dishwarmer.svg'
            break;
        case 48: // 48 = VACUUM DRAWER
            deviceObj.icon = 'icons/00_genericappliance.svg'
            break;
        default: deviceObj.icon =  'icons/0_genericappiance.svg';
    }
    return deviceObj;
}


/**
 * Function parseMieleDevice
 *
 * parses the JSON of each single device and creates the needed states
 *
 * @param {object} mieleDevice the JSON for a single device
 * @param {string} mieleDevice.ident the ident number of the device
 * @param {string} mieleDevice.ident.deviceName the nickname of the device
 * @param {string} mieleDevice.ident.type.value_localized localized name of the device type
 * @param {number} mieleDevice.ident.type.value_raw numerical representation of the device type
 * @param {string} mieleDevice.ident.deviceIdentLabel.fabNumber SerialNumber of the device
 * @param {boolean} setup  indicator whether the devices need to setup or only states are to be updated
 * @param {string} API_Id  the API-ID for the current device
 */
async function parseMieleDevice(mieleDevice, setup, API_Id){
    adapter.log.debug('This is a ' + mieleDevice.ident.type.value_localized );
    const deviceObj = getDeviceObj(mieleDevice.ident.type.value_raw); // create folder for device
    if (setup) {
        _knownDevices[mieleDevice.ident.deviceIdentLabel.fabNumber]=deviceObj;
        if (mieleDevice.ident.deviceName === '') {
            _knownDevices[mieleDevice.ident.deviceIdentLabel.fabNumber].name = mieleDevice.ident.type.value_localized;
        } else {
            _knownDevices[mieleDevice.ident.deviceIdentLabel.fabNumber].name = mieleDevice.ident.deviceName;
        }
        _knownDevices[mieleDevice.ident.deviceIdentLabel.fabNumber].API_Id = API_Id;
        _knownDevices[mieleDevice.ident.deviceIdentLabel.fabNumber].deviceType=mieleDevice.ident.type.value_raw;
        adapter.log.debug(`_knownDevices=${JSON.stringify(_knownDevices)}`)
    }
    await addMieleDevice(mieleDevice, setup);
}



/**
 * Function addMieleDevice
 *
 * adds the current miele device to the device tree beneath it's device type folder (channel)
 *
 * @param mieleDevice {object} the JSON for a single device
 * @param setup {boolean} indicator whether the devices need to setup or only states are to be updated
 */
async function addMieleDevice(mieleDevice, setup){
    let newPath = mieleDevice.ident.deviceIdentLabel.fabNumber;
    // adapter.log.debug('addMieleDevice: NewPath = [' + newPath + ']');

    // addresses sentry issue: MIELECLOUDSERVICE-28
    if (typeof mieleDevice.ident.deviceIdentLabel.fabNumber === 'undefined'){
        adapter.log.warn('This device has no fabNumber and can therefore not being identified. Not able to add it to the device tree.');
        return;
    }
    if (typeof _knownDevices === 'undefined'){
        adapter.log.warn('_knownDevices has not been initialized. Not able to add this device to the device tree.');
        return;
    }
    if (!_knownDevices[mieleDevice.ident.deviceIdentLabel.fabNumber].hasOwnProperty('name')){
        adapter.log.warn('This device is known but has no name. Not able to add this device to the device tree.');
        return;
    }

    mieleTools.createExtendObject(adapter, newPath, {
        type: 'device',
        common: {name:   _knownDevices[mieleDevice.ident.deviceIdentLabel.fabNumber].name,
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
        // adapter.log.debug('addMieleDevice:' + deviceInfo);
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
    const actions = await mieleAPITools.getPermittedActions(adapter, _auth,  _knownDevices[currentDevice.ident.deviceIdentLabel.fabNumber].API_Id );
    // programs
    await mieleTools.addPrograms(adapter, setup, _auth, path, currentDevice.ident.deviceIdentLabel.fabNumber);

    try{
        // set/create device dependant states
        switch (currentDevice.ident.type.value_raw) {
            case 1 : // 1 = WASHING MACHINE*
                // setup ecoFeedback channel for this device if needed
                mieleTools.createChannelEcoFeedback(adapter, path, setup) ;
                // states the device is known to support
                await mieleTools.createStateProgramID(adapter, setup, `${path}.${currentDeviceState.ProgramID.key_localized}`, currentDeviceState.ProgramID.value_localized, currentDeviceState.ProgramID.value_raw );
                await mieleTools.createStateProgramType(adapter, setup, `${path}.${currentDeviceState.programType.key_localized}`, currentDeviceState.programType.value_localized, currentDeviceState.programType.value_raw );
                await mieleTools.createStateProgramPhase(adapter, setup, `${path}.${currentDeviceState.programPhase.key_localized}`, currentDeviceState.programPhase.value_localized, currentDeviceState.programPhase.value_raw );
                await mieleTools.createStateRemainingTime(adapter, setup, path, currentDeviceState.remainingTime);
                await mieleTools.createStateStartTime(adapter, setup, path, currentDeviceState.startTime);
                await mieleTools.createStateSignalInfo(adapter, setup, path, currentDeviceState.signalInfo);
                await mieleTools.createStateFullRemoteControl(adapter, setup, path, currentDeviceState.remoteEnable.fullRemoteControl);
                await mieleTools.createStateSmartGrid(adapter, setup, path, currentDeviceState.remoteEnable.smartGrid);
                await mieleTools.createStateMobileStart(adapter, setup, path, currentDeviceState.remoteEnable.mobileStart);
                await mieleTools.createStateEstimatedEndTime(adapter, setup, path, currentDeviceState);
                await mieleTools.createStateElapsedTime(adapter, setup, path, currentDeviceState.elapsedTime);
                await mieleTools.createStateSpinningSpeed(adapter, setup, `${path}.${currentDeviceState.spinningSpeed.key_localized}`, currentDeviceState.spinningSpeed.value_localized, currentDeviceState.spinningSpeed.unit);
                await mieleTools.createStateEcoFeedbackEnergy(adapter, setup, path, currentDeviceState.ecoFeedback);
                await mieleTools.createStateEcoFeedbackWater(adapter, setup, path, currentDeviceState.ecoFeedback);
                await mieleTools.createStateTargetTemperature(adapter, setup, path, currentDeviceState.targetTemperature);
                // actions
                await mieleTools.addPowerSwitch(adapter, path, actions);
                await mieleTools.addStartButton(adapter, setup, path, Array(actions.processAction).includes(mieleConst.START));
                await mieleTools.addStopButton(adapter, setup, path, Array(actions.processAction).includes(mieleConst.STOP));
                await mieleTools.addLightSwitch(adapter, path, actions, currentDeviceState.light);
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
                await mieleTools.createStateEstimatedEndTime(adapter, setup, path, currentDeviceState);
                await mieleTools.createStateElapsedTime(adapter, setup, path, currentDeviceState.elapsedTime);
                await mieleTools.createStateDryingStep(adapter, setup, `${path}.${currentDeviceState.dryingStep.key_localized}`, currentDeviceState.dryingStep.value_localized, currentDeviceState.dryingStep.value_raw );
                await mieleTools.createStateEcoFeedbackEnergy(adapter, setup, path, currentDeviceState.ecoFeedback);
                await mieleTools.createStateTargetTemperature(adapter, setup, path, currentDeviceState.targetTemperature);
                // Actions
                await mieleTools.addPowerSwitch(adapter, path, actions);
                await mieleTools.addStartButton(adapter, setup, path, Array(actions.processAction).includes(mieleConst.START));
                await mieleTools.addStopButton(adapter, setup, path, Array(actions.processAction).includes(mieleConst.STOP));
                await mieleTools.addLightSwitch(adapter, path, actions, currentDeviceState.light);
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
                await mieleTools.createStateEstimatedEndTime(adapter, setup, path, currentDeviceState);
                await mieleTools.createStateElapsedTime(adapter, setup, path, currentDeviceState.elapsedTime);
                await mieleTools.createStateSpinningSpeed(adapter, setup, `${path}.${currentDeviceState.spinningSpeed.key_localized}`, currentDeviceState.spinningSpeed.value_localized, currentDeviceState.spinningSpeed.unit);
                await mieleTools.createStateDryingStep(adapter, setup, `${path}.${currentDeviceState.dryingStep.key_localized}`, currentDeviceState.dryingStep.value_localized, currentDeviceState.dryingStep.value_raw );
                await mieleTools.createStateEcoFeedbackEnergy(adapter, setup, path, currentDeviceState.ecoFeedback);
                await mieleTools.createStateEcoFeedbackWater(adapter, setup, path, currentDeviceState.ecoFeedback);
                await mieleTools.createStateTargetTemperature(adapter, setup, path, currentDeviceState.targetTemperature);
                // Actions
                await mieleTools.addPowerSwitch(adapter, path, actions);
                await mieleTools.addStartButton(adapter, setup, path, Array(actions.processAction).includes(mieleConst.START));
                await mieleTools.addStopButton(adapter, setup, path, Array(actions.processAction).includes(mieleConst.STOP));
                await mieleTools.addLightSwitch(adapter, path, actions, currentDeviceState.light);
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
                await mieleTools.createStateEstimatedEndTime(adapter, setup, path, currentDeviceState);
                await mieleTools.createStateElapsedTime(adapter, setup, path, currentDeviceState.elapsedTime);
                await mieleTools.createStateEcoFeedbackEnergy(adapter, setup, path, currentDeviceState.ecoFeedback);
                await mieleTools.createStateEcoFeedbackWater(adapter, setup, path, currentDeviceState.ecoFeedback);
                // Actions
                await mieleTools.addPowerSwitch(adapter, path, actions);
                await mieleTools.addStartButton(adapter, setup, path, Array(actions.processAction).includes(mieleConst.START));
                await mieleTools.addStopButton(adapter, setup, path, Array(actions.processAction).includes(mieleConst.STOP));
                await mieleTools.addPauseButton(adapter, setup, path, Array(actions.processAction).includes(mieleConst.PAUSE));
                await mieleTools.addLightSwitch(adapter, path, actions, currentDeviceState.light);
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
                await mieleTools.createStateEstimatedEndTime(adapter, setup, path, currentDeviceState);
                await mieleTools.createStateElapsedTime(adapter, setup, path, currentDeviceState.elapsedTime);
                await mieleTools.createStateTemperature(adapter, setup, path, currentDeviceState.temperature);
                await mieleTools.createStateTargetTemperature(adapter, setup, path, currentDeviceState.targetTemperature);
                // Actions
                await mieleTools.addStopButton(adapter, setup, path, Array(actions.processAction).includes(mieleConst.STOP));
                await mieleTools.addLightSwitch(adapter, path, actions, currentDeviceState.light);
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
                await mieleTools.createStateEstimatedEndTime(adapter, setup, path, currentDeviceState);
                await mieleTools.createStateElapsedTime(adapter, setup, path, currentDeviceState.elapsedTime);
                await mieleTools.createStateTemperature(adapter, setup, path, currentDeviceState.temperature);
                await mieleTools.createStateTargetTemperature(adapter, setup, path, currentDeviceState.targetTemperature);
                // Actions
                await mieleTools.addPowerSwitch(adapter, path, actions);
                await mieleTools.addLightSwitch(adapter, path, actions, currentDeviceState.light);
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
                await mieleTools.addLightSwitch(adapter, path, actions, currentDeviceState.light);
                break;
            case 18: // 18 = HOOD*
                // States
                await mieleTools.createStateSignalInfo(adapter, setup, path, currentDeviceState.signalInfo);
                await mieleTools.createStateFullRemoteControl(adapter, setup, path, currentDeviceState.remoteEnable.fullRemoteControl);
                await mieleTools.createStateSmartGrid(adapter, setup, path, currentDeviceState.remoteEnable.smartGrid);
                await mieleTools.createStateMobileStart(adapter, setup, path, currentDeviceState.remoteEnable.mobileStart);
                await mieleTools.createStateVentilationStep(adapter, setup, path, currentDeviceState.ventilationStep.value_raw);
                // Actions
                await mieleTools.addPowerSwitch(adapter, path, actions);
                await mieleTools.addLightSwitch(adapter, path, actions, currentDeviceState.light);
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
                await mieleTools.createStateTargetTemperatureFridge(adapter, setup, path, currentDeviceState.targetTemperature[0].value_localized, actions.targetTemperature[0].min, actions.targetTemperature[0].max, currentDeviceState.targetTemperature[0].unit);
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
                await mieleTools.createStateTargetTemperatureFreezer(adapter, setup, path, currentDeviceState.targetTemperature[0].value_localized, actions.targetTemperature[0].min, actions.targetTemperature[0].max, currentDeviceState.targetTemperature[0].unit);
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
                await mieleTools.createStateTargetTemperatureFridge(adapter, setup, path, currentDeviceState.targetTemperature[0].value_localized, actions.targetTemperature[0].min, actions.targetTemperature[0].max, currentDeviceState.targetTemperature[0].unit);
                await mieleTools.createStateTargetTemperatureFreezer(adapter, setup, path, currentDeviceState.targetTemperature[1].value_localized, actions.targetTemperature[1].min, actions.targetTemperature[1].max, currentDeviceState.targetTemperature[1].unit);
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
                await mieleTools.createStateTargetTemperatureFridge(adapter, setup, path, currentDeviceState.targetTemperature[0].value_localized, actions.targetTemperature[0].min, actions.targetTemperature[0].max, currentDeviceState.targetTemperature[0].unit);
                // Actions
                await mieleTools.addLightSwitch(adapter, path, actions, currentDeviceState.light);
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
                await mieleTools.createStateTargetTemperatureFridge(adapter, setup, path, currentDeviceState.targetTemperature[0].value_localized, actions.targetTemperature[0].min, actions.targetTemperature[0].max, currentDeviceState.targetTemperature[0].unit);
                await mieleTools.createStateTargetTemperatureFreezer(adapter, setup, path, currentDeviceState.targetTemperature[1].value_localized, actions.targetTemperature[1].min, actions.targetTemperature[1].max, currentDeviceState.targetTemperature[1].unit);
                // Actions
                await mieleTools.addSuperFreezingSwitch(adapter, setup, path, actions);
                await mieleTools.addLightSwitch(adapter, path, actions, currentDeviceState.light);
                await mieleTools.addModeSwitch(adapter, setup, path, actions);
                break;
            case 23: // 23 = VACUUM CLEANER, AUTOMATIC ROBOTIC VACUUM CLEANER*
                await mieleTools.createStateBatteryLevel(adapter, setup, path, currentDeviceState.batteryLevel);
                // Actions
                await mieleTools.addProgramIdAction(adapter, setup, path, currentDeviceState.programId);
                await mieleTools.addStartButton(adapter, setup, path, Array(actions.processAction).includes(mieleConst.START));
                await mieleTools.addStopButton(adapter, setup, path, Array(actions.processAction).includes(mieleConst.STOP));
                await mieleTools.addPauseButton(adapter, setup, path, Array(actions.processAction).includes(mieleConst.PAUSE));
                break;
            case 25: // 25 = DISH WARMER*
                await mieleTools.createStateSignalInfo(adapter, setup, path, currentDeviceState.signalInfo);
                // Actions
                await mieleTools.addProgramIdAction(adapter, setup, path, currentDeviceState.programId);
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
        let n=1;
        do {
            adapter.log.info(`Login attempt #${n} @Miele-API`);
            _auth = await mieleAPITools.APIGetAccessToken(adapter);
            if (!_auth){
                adapter.log.info(`Login attempt wasn't successful. Trying again in 60 Seconds.`);
                let timeHandler = setTimeout(function (){ n++; },60000);
                clearTimeout(timeHandler);
            }
        } while (!_auth);
        if (_auth && _auth.hasOwnProperty('access_token') ) {
            adapter.log.info(`Setting up devices ...`);
            // do the first API call and setup all devices returned
            const result = await mieleAPITools.refreshMieleData( adapter, _auth, '' );
            await splitMieleDevices(result, true);
            // start refresh scheduler with interval from adapters config
            adapter.log.info(`Registering for appliance events at Miele API.`);
            _sse = mieleAPITools.APIregisterForEvents(adapter, _auth);
            _sse.addEventListener( 'devices', function(event) {
                // adapter.log.info('Received DEVICES message by SSE.');
                adapter.log.debug('Received devices message by SSE: ' + JSON.stringify(event));
                splitMieleDevices(JSON.parse(event.data), false);
            });
            _sse.addEventListener( 'actions', function(event) {
                // adapter.log.info('Received ACTIONS message by SSE.');
                // adapter.log.info('EL: Actions: '+ JSON.stringify(event));
            });
            _sse.addEventListener( 'error', function(event) {
                adapter.log.warn('Received error message by SSE: ' + JSON.stringify(event));
                if (event.readyState === EventSource.CLOSED) {
                    adapter.log.info('The connection has been closed. Trying to reconnect.');
                    adapter.setState('info.connection', false, true);
                    _sse = mieleAPITools.APIregisterForEvents(adapter, _auth);
                }
            });
            _sse.onopen = function() {
                adapter.log.info('Server Sent Events-Connection has been (re)established @Miele-API.');
            };
            _sse.onerror = function (err) {
                if (err) {
                    if (err.status === 401 || err.status === 403) {
                        adapter.log.error('not authorized');
                    } else  if (err.status) adapter.log.error( JSON.stringify(err));
                }
            };
        } else {
            adapter.log.error('[main] APIGetAccessToken returned neither a token nor an errormessage. Returned value=[' + JSON.stringify(_auth)+']');
        }
    } catch(err) {
        adapter.log.error('[main] :' + err.message + ', Stacktrace:' + err.stack);
        adapter.setState('info.connection', false, true);
    }
}//End Function main



// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startadapter;
} else {
    // or start the instance directly
    startadapter();
}