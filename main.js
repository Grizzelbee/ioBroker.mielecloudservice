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
const mieleAPIUtils = require('./miele-apiTools.js');
const mieleTools = require('./miele-Tools.js');
// const mieleConst = require('./miele-constants.js');

// Global Variables
let adapter;
let auth;
let pollTimeout;
let expiryDate;

function startadapter(options) {
    options = options || {};
    Object.assign(options, {
        // name has to be set and has to be equal to adapters folder name and main file name excluding extension
        name: adapterName,
        // is called when adapter shuts down - callback has to be called under any circumstances!
        unload: async function (callback) {
            try {
                if (pollTimeout) {
                    adapter.log.info('Clearing Timeout: pollTimeout');
                    clearTimeout(pollTimeout);
                }
                adapter.unsubscribeObjects('*');
                adapter.unsubscribeStates('*');
                adapter.setState('info.connection', false);
                if (auth.refresh_token) {
                    await mieleAPIUtils.APILogOff(adapter, auth, "refresh_token")
                }
                if (auth.access_token) {
                    await mieleAPIUtils.APILogOff(adapter, auth, "access_token")
                }
                auth = undefined;
                pollTimeout = null;
                expiryDate = null;
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
                await mieleAPIUtils.APIStartAction(adapter, auth, id, action, state.val);
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

function createEODeviceTypes(deviceTypeID){
/* List of possible device types:
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
    67 = DIALOG OVEN
    68 = WINE CABINET FREEZER COMBINATION
    */

    let deviceFolder;
    let description;

    switch (deviceTypeID) {
        case 1 :
            deviceFolder = 'Washing_machines';
            description  = 'Washing machines reported by Miele@Home API';
            break;
        case 2:
            deviceFolder = 'Tumble_dryers';
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
            deviceFolder = 'Hobs';
            description  = 'Hobs reported by Miele@Home API';
            break;
        case 16:
        case 42:
            deviceFolder = 'Microwaves';
            description  = 'Microwaves reported by Miele@Home API';
            break;
        case 17:
            deviceFolder = 'Coffee_Systems';
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
            deviceFolder = 'Vacuum_cleaners';
            description  = 'Vacuum cleaners reported by Miele@Home API';
            break;
        case 25:
            deviceFolder = 'Dish_warmers';
            description  = 'Dish warmers reported by Miele@Home API';
            break;
        case 48:
            deviceFolder = 'Vacuum_drawers';
            description  = 'Vacuum drawers reported by Miele@Home API';
            break;
    }

    mieleTools.createExtendObject(adapter, deviceFolder, {
        type: 'device',
        common: {
            name: description,
            icon : 'icons/00_genericappliance.svg'
        },
        native: {}
    }, null);

    return deviceFolder;
}

async function splitMieleDevices(devices){
    // Splits the data-package returned by the API into single devices
    // and lets you iterate over each single device
    adapter.log.debug('[splitMieleDevices] Splitting JSON to single devices.');
    for (let mieleDevice in devices) {
        adapter.log.debug('splitMieleDevices: ' + mieleDevice+ ': [' + mieleDevice + '] *** Value: [' + JSON.stringify(devices[mieleDevice]) + ']');
        if (devices[mieleDevice].ident.deviceIdentLabel.fabNumber === ''){
            adapter.log.debug('Device: [' + mieleDevice + '] has no serial number/fabNumber. Taking DeviceNumber instead.');
            devices[mieleDevice].ident.deviceIdentLabel.fabNumber = mieleDevice;
        }
        await parseMieleDevice(devices[mieleDevice]);
    }
}

async function parseMieleDevice(mieleDevice){
    let deviceFolder;
    adapter.log.debug('This is a ' + mieleDevice.ident.type.value_localized );
    deviceFolder = createEODeviceTypes(mieleDevice.ident.type.value_raw); // create folder for device
    await addMieleDevice(deviceFolder, mieleDevice);

    // add special data points to devices
    // Action required due to wet clothes, dry clothes, clean dishes, ...
    // set to true when device has finished and door hasn't opened yet
    // set to false when device has finished and door is open
    // set to false when device has been started and door is closed
    switch (mieleDevice.ident.type.value_raw) {
        case  1: // Washing machine
        case  2: // Tumble dryer
        case  7: // Dishwasher
        case 12: // Washer dryer
            // set to true when device has finished (Value_raw 7 => end programmed) and door hasn't opened yet
            if (mieleDevice.state.status.value_raw === 7 && !mieleDevice.signalDoor) {
                await mieleTools.createBool(adapter,deviceFolder + '.' + mieleDevice.ident.deviceIdentLabel.fabNumber + '.signalActionRequired', 'Action required on device due to wet clothes, dry clothes, clean dishes, ...', true, '');
            }
            // set to false when device has finished and door is open
            if ( ((mieleDevice.state.status.value_raw === 7) || mieleDevice.state.status.value_raw === 1) && mieleDevice.signalDoor) {
                await mieleTools.createBool(adapter,deviceFolder + '.' + mieleDevice.ident.deviceIdentLabel.fabNumber + '.signalActionRequired', 'Action required on device due to wet clothes, dry clothes, clean dishes, ...', false, '');
            }
            // set to false when device has been started and door is closed
            if (mieleDevice.state.status.value_raw === 5 && !mieleDevice.signalDoor) {
                await mieleTools.createBool(adapter,deviceFolder + '.' + mieleDevice.ident.deviceIdentLabel.fabNumber + '.signalActionRequired', 'Action required on device due to wet clothes, dry clothes, clean dishes, ...', false, '');
            }
    }

            // spinning speed
    switch (mieleDevice.ident.type.value_raw) {
        case  1: // Washing machine
            mieleTools.createNumber(adapter,deviceFolder + '.' + mieleDevice.ident.deviceIdentLabel.fabNumber + '.' + mieleDevice.state.spinningSpeed.key_localized,
                    'Spinning speed of a washing machine.',
                              mieleDevice.state.spinningSpeed.value_localized,
                              mieleDevice.state.spinningSpeed.unit,
                         'value');
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
            mieleTools.createTime(adapter,deviceFolder + '.' + mieleDevice.ident.deviceIdentLabel.fabNumber + '.elapsedTime', 'ElapsedTime since program start (only present for certain devices)', mieleDevice.state.elapsedTime, '');
            break;
        case 18: // Hood
            mieleTools.createStringAndRaw(adapter,deviceFolder + '.' + mieleDevice.ident.deviceIdentLabel.fabNumber, 'This field is only valid for hoods.', mieleDevice.state.ventilationStep.key_localized, mieleDevice.state.ventilationStep.value_localized, mieleDevice.state.ventilationStep.value_raw, '');
            break;
    }
    // dryingStep
    switch (mieleDevice.ident.type.value_raw) {
        case  2: // tumble dryer
        case 24: // washer dryer
            mieleTools.createStringAndRaw(adapter,deviceFolder + '.' + mieleDevice.ident.deviceIdentLabel.fabNumber, 'This field is only valid for tumble dryers and washer-dryer combinations.', mieleDevice.state.dryingStep.key_localized, mieleDevice.state.dryingStep.value_localized, mieleDevice.state.dryingStep.value_raw, '');
            break;
    }
    // PlateStep - occurs at Hobs
    switch (mieleDevice.ident.type.value_raw) {
        case 14: // Highlight Hob
        case 27: // Induction Hob
            mieleTools.createArray(adapter,deviceFolder + '.' + mieleDevice.ident.deviceIdentLabel.fabNumber + mieleDevice.state.plateStep[0].key_localized,
                   'The plateStep object represents the selected cooking zone levels for a hob.',
                             mieleDevice.state.plateStep);
            break;
    }

}

async function addMieleDevice(path, mieleDevice){
    let newPath = path + '.' + mieleDevice.ident.deviceIdentLabel.fabNumber;
    adapter.log.debug('addMieleDevice: NewPath = [' + newPath + ']');

    mieleTools.createExtendObject(adapter, newPath, {
        type: 'device',
        common: {name:   (mieleDevice.ident.deviceName === ''? mieleDevice.ident.type.value_localized: mieleDevice.ident.deviceName) , read: true, write: false},
        native: {}
    }, null);

    // add device specific actions
    addMieleDeviceActions(newPath, mieleDevice.ident.type.value_raw);
    addDeviceNicknameAction(newPath, mieleDevice);

    // add device states and ident
    for (let deviceInfo in mieleDevice){
        adapter.log.debug('addMieleDevice:' + deviceInfo);
        switch (deviceInfo) {
            case 'ident':
                await addMieleDeviceIdent(newPath, mieleDevice[deviceInfo]);
                break;
            case 'state':
                await addMieleDeviceState(newPath, mieleDevice[deviceInfo]);
                break;
        }
    }
}


async function addMieleDeviceIdent(path, currentDeviceIdent){
    adapter.log.debug('addMieleDeviceIdent: Path = [' + path + ']');
    await mieleTools.createString(adapter,path + '.ComModFirmware', "the release version of the communication module", currentDeviceIdent.xkmIdentLabel.releaseVersion);
    await mieleTools.createString(adapter,path + '.ComModTechType', "the technical type of the communication module", currentDeviceIdent.xkmIdentLabel.techType);
    await mieleTools.createString(adapter,path + '.DeviceSerial', "the serial number of the device", currentDeviceIdent.deviceIdentLabel.fabNumber);
    await mieleTools.createString(adapter,path + '.DeviceTechType', "the technical type of the device", currentDeviceIdent.deviceIdentLabel.techType);
    await mieleTools.createString(adapter,path + '.DeviceMatNumber', "the material number of the device", currentDeviceIdent.deviceIdentLabel.matNumber);
}

async function addMieleDeviceState(path, currentDeviceState){
    let now = new Date;
    let estimatedEndTime = new Date;
    adapter.log.debug('addMieleDeviceState: Path: [' + path + ']');
    // set the values for redundant state indicators
    await mieleTools.createBool(adapter,path + '.Connected', 'Indicates whether the device is connected to WLAN or Gateway.', currentDeviceState.status.value_raw !== 255, 'indicator.reachable');
    await mieleTools.createBool(adapter,path + '.signalInUse', 'Indicates whether the device is in use or switched off.', currentDeviceState.status.value_raw !== 1, 'indicator.InUse');
    // regular states
    mieleTools.createStringAndRaw(adapter,path, 'main Device state', currentDeviceState.status.key_localized, currentDeviceState.status.value_localized, currentDeviceState.status.value_raw, '');
    mieleTools.createStringAndRaw(adapter,path, 'ID of the running Program', currentDeviceState.ProgramID.key_localized, currentDeviceState.ProgramID.value_localized, currentDeviceState.ProgramID.value_raw, '');
    mieleTools.createStringAndRaw(adapter,path, 'programType of the running Program', currentDeviceState.programType.key_localized,  currentDeviceState.programType.value_localized, currentDeviceState.programType.value_raw, '');
    mieleTools.createStringAndRaw(adapter,path, 'phase of the running Program', currentDeviceState.programPhase.key_localized,  currentDeviceState.programPhase.value_localized, currentDeviceState.programPhase.value_raw, '');
    mieleTools.createTime(adapter,path + '.remainingTime', 'The RemainingTime equals the relative remaining time', currentDeviceState.remainingTime, '');
    estimatedEndTime.setMinutes((now.getMinutes() + ((currentDeviceState.remainingTime[0]*60) + (currentDeviceState.remainingTime[1]*1))));
    await mieleTools.createString(adapter,path + '.estimatedEndTime', 'The EstimatedEndTime is the current time plus remaining time.', estimatedEndTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    mieleTools.createTime(adapter,path + '.startTime', 'The StartTime equals the relative starting time', currentDeviceState.startTime, '');
    mieleTools.createArray(adapter,path + '.targetTemperature', 'The TargetTemperature field contains information about one or multiple target temperatures of the process.', currentDeviceState.targetTemperature);
    mieleTools.createArray(adapter,path + '.Temperature', 'The Temperature field contains information about one or multiple temperatures of the device.', currentDeviceState.temperature);
    await mieleTools.createBool(adapter,path + '.signalInfo', 'The SignalInfo field indicates, if a notification is active for this Device.', currentDeviceState.signalInfo, '');
    await mieleTools.createBool(adapter,path + '.signalFailure', 'The SignalFailure field indicates, if a failure is active for this Device.', currentDeviceState.signalFailure, '');
    await mieleTools.createBool(adapter,path + '.signalDoor', 'The SignalDoor field indicates, if a door-open message is active for this Device.', currentDeviceState.signalDoor, '');
    // Light - create only if not null
    if (currentDeviceState.light) {
        await mieleTools.createString(adapter,path + '.Light', 'The light field indicates the status of the device light.', currentDeviceState.light === 1 ? 'Enabled' : (currentDeviceState.light === 2 ? 'Disabled' : 'Invalid'));
    }
    // NEW API 1.0.4 - ambientLight
    if (currentDeviceState.ambientLight) {
        await mieleTools.createString(adapter,path + '.ambientLight', 'The ambientLight field indicates the status of the device ambient light.', currentDeviceState.ambientLight);
    }
    await mieleTools.createBool(adapter,path + '.fullRemoteControl', 'The device can be controlled from remote.', currentDeviceState.remoteEnable.fullRemoteControl, '');
    await mieleTools.createBool(adapter,path + '.smartGrid', 'The device is set to Smart Grid mode.', currentDeviceState.remoteEnable.smartGrid, '');
    // NEW API 1.0.4 - ecoFeedback
    // the ecoFeedback object returns the amount of water and energy used by the current running program up to the present moment.
    // Furthermore it returns a forecast for water and energy consumption for a selected program.
    if (currentDeviceState.ecoFeedback){
        if (currentDeviceState.ecoFeedback.currentWaterConsumption){
            mieleTools.createNumber(adapter,path + '.currentWaterConsumption', 'The amount of water used by the current running program up to the present moment.', currentDeviceState.ecoFeedback.currentWaterConsumption.value.valueOf(), currentDeviceState.ecoFeedback.currentWaterConsumption.unit.valueOf(), 'value');
            mieleTools.createNumber(adapter,path + '.waterForecast', 'The relative water usage for the selected program from 0 to 100.', (currentDeviceState.ecoFeedback.waterForecast * 100), '%', 'value');
        }
        if (currentDeviceState.ecoFeedback.currentEnergyConsumption) {
            mieleTools.createNumber(adapter,path + '.currentEnergyConsumption', 'The amount of energy used by the current running program up to the present moment.', currentDeviceState.ecoFeedback.currentEnergyConsumption.value.valueOf(), currentDeviceState.ecoFeedback.currentEnergyConsumption.unit.valueOf(), 'value.power.consumption');
            mieleTools.createNumber(adapter,path + '.energyForecast', 'The relative energy usage for the selected program from 0 to 100.', (currentDeviceState.ecoFeedback.energyForecast * 100), '%', 'value');
        }
    }
    // NEW API 1.0.4 - batteryLevel - create only if not null
    if (currentDeviceState.batteryLevel) {
        mieleTools.createNumber(adapter,path + '.batteryLevel', 'The batteryLevel object returns the charging level of a builtin battery as a percentage value between 0 .. 100', currentDeviceState.batteryLevel, '%', 'value');
    }

}

function addDeviceNicknameAction(path, mieleDevice) {
    adapter.log.debug( 'addDeviceNicknameAction: Path:['+ path +'], mieleDevice:['+JSON.stringify(mieleDevice)+']' );
    // addDeviceNicknameAction - suitable for each and every device
    mieleTools.createExtendObject(adapter,path + '.ACTIONS.Nickname', {
        type: 'state',
        common: {
            name: 'Nickname of your device. Can be edited in Miele APP or here!',
            read: true,
            write: true,
            type: 'string',
            role:'text'
        },
        native: {}
    }, () => {
        adapter.setState(path + '.ACTIONS.Nickname', (mieleDevice.ident.deviceName === '' ? mieleDevice.ident.type.value_localized : mieleDevice.ident.deviceName), true);
        adapter.subscribeStates(path + '.ACTIONS.Nickname');
    });
}

function addPowerActionButtons(path) {
    // addPowerOnAction
    mieleTools.addActionButton(adapter,path,'Power_On', 'Power the Device on.', '');
    // addPowerOffAction
    mieleTools.addActionButton(adapter,path,'Power_Off', 'Power the Device off.', '');
}

function addStartActionButton(path) {
    // addStartAction
    mieleTools.addActionButton(adapter,path,'Start', 'Starts the Device.', 'button.start');
}

function addStopActionButton(path) {
    // addStopAction
    mieleTools.addActionButton(adapter,path,'Stop', 'Stops the Device.', 'button.stop');
}

function addStartStopActionButtons(path) {
    addStartActionButton(path);
    addStopActionButton(path);
}

function addLightActionButtons(path) {
    // addLightOnAction
    mieleTools.addActionButton(adapter,path,'Light_On', 'Switches the lights of the Device on.', '');
    // addLightOffAction
    mieleTools.addActionButton(adapter,path,'Light_Off', 'Switches the lights of the Device off.', '');
}

function addSupercoolingActionButtons(path) {
    // addLightOnAction
    mieleTools.addActionButton(adapter,path,'Start_Supercooling', 'Brings the Device into Supercooling mode.', '');
    // addLightOffAction
    mieleTools.addActionButton(adapter,path,'Stop_Supercooling', 'Brings the Device out of Supercooling mode.', '');
}

function addSuperfreezingActionButtons(path) {
    // addLightOnAction
    mieleTools.addActionButton(adapter,path,'Start_Superfreezing', 'Brings the Device into Superfreezing mode.', '');
    // addLightOffAction
    mieleTools.addActionButton(adapter,path,'Stop_Superfreezing', 'Brings the Device out of Superfreezing mode.', '');
}

function addMieleDeviceActions(path, DeviceType){
    adapter.log.debug(`addMieleDeviceActions: Path: [${path}]`);
    // Create ACTIONS folder if not already existing
    mieleTools.createExtendObject(adapter,path + '.ACTIONS', {
        type: 'channel',
        common: {name: 'Supported Actions for this device.', read: true, write: true},
        native: {}
    }, null);

    // Add Actions depending on device type
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
            addPowerActionButtons(path);
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



/*
 *  Main function
 */
async function main() {
    try {
        // todo: try 10 logins when it fails with a delay of 5 min each
        auth = await mieleAPIUtils.APIGetAccessToken(adapter);
        if (auth.hasOwnProperty('access_token') ) {
            adapter.log.info(`Starting poll timer with a [${adapter.config.pollinterval}] ${ adapter.config.pollUnit===1? 'Second(s)':'Minute(s)'} interval.`);
            // start refresh scheduler with interval from adapters config
            pollTimeout= setTimeout(async function schedule() {
                adapter.log.debug("Updating device states (polling API scheduled).");
                const result = await mieleAPIUtils.refreshMieleData( adapter, auth );
                await splitMieleDevices(result);
                pollTimeout= setTimeout(schedule , (adapter.config.pollinterval * 1000 * adapter.config.pollUnit) );
            } , 100);
        } else {
            adapter.log.error('[main] APIGetAccessToken returned neither a token nor an errormessage. Returned value=[' + JSON.stringify(auth)+']');
        }
    } catch(err) {
        adapter.log.error('[main] ' + JSON.stringify(err));
    }
}//End Function main




// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startadapter;
} else {
    // or start the instance directly
    startadapter();
}