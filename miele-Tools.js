// @ts-nocheck
// jshint -W097
// jslint node: true
'use strict';

/**
 * Miele Tools
 *
 * This file contains some tool functions needed for this adapter to work
 *
 */

// required files to load
const mieleTools = require('./miele-Tools.js');


/**
 * Function decryptPasswords
 *
 * decrypts the passwords stored in ioBroker secure area and returns the decrypted values in their config variables.
 *
 * @param adapter {object} link to the adapter instance
 *
 * @returns promise {promise}
 *  resolves to true if password has been decrypted
 *  rejects with error message
 */
module.exports.decryptPasswords = async function(adapter) {
    return new Promise((resolve, reject) => {
        if (adapter.supportsFeature && adapter.supportsFeature('ADAPTER_AUTO_DECRYPT_NATIVE')) {
            adapter.getForeignObject('system.config', (err, obj) => {
                if (obj && obj.native && obj.native.secret) {
                    //noinspection JSUnresolvedVariable
                    adapter.config.Miele_pwd = adapter.decrypt(obj.native.secret, adapter.config.Miele_pwd);
                    adapter.config.Client_secret = adapter.decrypt(obj.native.secret, adapter.config.Client_secret);
                    resolve(true);
                } else {
                    reject('Error during password decryption: ' + err);
                }
            });
        } else {
            reject('This adapter requires at least js-controller V3.0.0. Your system is not compatible. Please update your system or use max. v2.0.3 of this adapter.');
        }
    })
}



/**
 * Function addActionButton
 *
 * Adds an action button to the device tree and subscribes for changes to it
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the action button is going to be created
 * @param action {string} name of the action button
 * @param description {string} description of the action button
 * @param buttonType {string} type of the action button (default: button)
 *
 */
module.exports.addActionButton = function(adapter, path, action, description, buttonType){
    adapter.log.debug('addActionButton: Path['+ path +']');
    buttonType = buttonType || "button";
    mieleTools.createExtendObject(adapter, path + '.ACTIONS.' + action, {
            type: 'state',
            common: {"name": description,
                "read": false,
                "write": true,
                "role": 'button',
                "type": 'boolean'
            },
            native: {"type": buttonType // "button"
            }
        }
        , () => {
            adapter.subscribeStates(path + '.ACTIONS.' + action);
        });
}



/**
 * Function createBool
 *
 * Adds a boolean data point to the device tree
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param description {string} description of the data point
 * @param value {boolean} value to set to the data point
 * @param role {string} role of the data point (default: indicator)
 *
 * @returns promise {promise}
 *
 */
module.exports.createBool = function(adapter, path, description, value, role){
    return new Promise(resolve => {
        role = role || 'indicator';
        adapter.log.debug('createBool: Path['+ path +'] Value[' + value + ']');
        mieleTools.createExtendObject(adapter, path, {
            type: 'state',
            common: {"name": description,
                "read": true,
                "write":false,
                "role": role,
                "type": "boolean"
            }
        }, () => {
            adapter.setState(path, value, true);
        });
        resolve(true);
    })
}



/**
 * Function createString
 *
 * Adds a string data point to the device tree
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param description {string} description of the data point
 * @param value {string} value to set to the data point
 *
 * @returns promise {promise}
 */
module.exports.createString = function(adapter, path, description, value){
    return new Promise(resolve => {
        adapter.log.debug('createString: Path['+ path +'] Value[' + value + ']');
        mieleTools.createExtendObject(adapter, path, {
            type: 'state',
            common: {"name": description,
                "read":  true,
                "write": false,
                "role": "text",
                "type": "string"
            }
        }, () => {
            adapter.setState(path, value, true);
        });
        resolve(true);
    })
}



/**
 * Function createStringAndRaw
 *
 * Adds a string data point to the device tree and in addition a raw data point containing a number representation of the string value
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param description {string} description of the data point
 * @param key_localized {string} localized key value (name) to set to the data point
 * @param value_localized {string} localized string value to set to the data point
 * @param value_raw {number} raw value to set to the data point
 * @param unit {string} unit to set to the data point if applicable
 *
 */
module.exports.createStringAndRaw = function(adapter, path, description, key_localized, value_localized, value_raw, unit){
    adapter.log.debug('createStringAndRaw: Path:[' + path + '] key_localized:[' + key_localized + '] value_localized[' + value_localized + '] value_raw[' + value_raw +'] unit[' + unit   +']' );
    mieleTools.createExtendObject(adapter, path + '.' + key_localized +'_raw', {
        type: 'state',
        common: {"name":  description + ' (value raw)',
            "read":  true,
            "write": false,
            "role": "value.raw",
            "type": "number"
        }
    }, ()  => {
        adapter.setState(path + '.' + key_localized +'_raw', value_raw, true);
    });

    mieleTools.createExtendObject(adapter, path + '.' + key_localized, {
        type: 'state',
        common: {"name":  description,
            "read":  true,
            "write": false,
            "role": "text",
            "type": "string"
        }
    }, () => {
        adapter.setState(path + '.' + key_localized, value_localized + ' ' + unit, true);
    });
}



/**
 * Function createTime
 *
 * Adds a time data point to the device tree by a given array containing [hours, minutes]
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param description {string} description of the data point
 * @param value {array} value to set to the data point
 * @param role {string} role to set to the data point (default: text)
 *
 */
module.exports.createTime = function(adapter, path, description, value, role){
    role = role || 'text';
    mieleTools.createExtendObject(adapter, path, {
        type: 'state',
        common: {"name": description,
            "read": true,
            "write":false,
            "role": role,
            "type": "string"
        }
    }, () => {
        adapter.log.debug('createTime: Path:['+ path +'], value:['+ value +']');
        let assembledValue = value[0] + ':' + (value[1]<10? '0': '') + value[1];
        adapter.setState(path, assembledValue, true);
    });
}



/**
 * Function createNumber
 *
 * Adds a number data point to the device tree
 * Unit "Celsius" will be converted to "°C" and "Fahrenheit" to "°F"
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param description {string} description of the data point
 * @param value {number} value to set to the data point
 * @param unit {string} unit to set to the data point
 * @param role {string} role to set to the data point (default: text)
 *
 */
module.exports.createNumber = function(adapter, path, description, value, unit, role){
    adapter.log.debug('[createNumber]: Path['+ path +'] Value[' + value + '] Unit[' + unit + ']');
    // get back to calling function if there is no valid value given.
    if ( !value || value === -32768 ) {
        adapter.log.debug('[createNumber]: invalid value detected. Skipping...');
        return;
    }
    role = role || 'value';

    switch (unit){
        case "Celsius" : unit = "°C";
            break;
        case "Fahrenheit" : unit = "°F";
            break;
    }
    adapter.log.debug('createNumber: Path['+ path +'] Value[' + value + '] Unit[' + unit + ']');
    mieleTools.createExtendObject(adapter, path, {
        type: 'state',
        common: {"name": description,
            "read": true,
            "write":false,
            "role": role,
            "type": "number",
            "unit": unit
        }
    }, () => {
        adapter.setState(path, value, true);
    });
}



/**
 * Function createArray
 *
 * Adds a number data point to the device tree for each element in the given array
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param description {string} description of the data point
 * @param value {number} value to set to the data point
 *
 */
module.exports.createArray = function(adapter, path, description, value){
    // depending on the device we receive up to 3 values
    // there is a min of 1 and a max of 3 temps returned by the miele API
    let MyPath = path;
    const items = Object.keys(value).length;
    adapter.log.debug('Number of Items in Array: [' + items +']');
    for (let n in value) {
        if (items > 1){
            MyPath = path + '_' + n;
        }
        adapter.log.debug('createArray: Path:['   + MyPath  + ']');
        adapter.log.debug('createArray:  value:[' + JSON.stringify(value)   + ']');
        adapter.log.debug('createArray:  OrgUnit: [' + value[n].unit + ']');
        mieleTools.createNumber(adapter, MyPath, description, value[n].value_localized, value[n].unit, 'value.temperature')
    }
}



/**
 * createExtendObject
 *
 * creates a new object in device tree or extends it if it's already existing
 *
 * @param adapter {object} link to the adapter instance
 * @param id {string} id of the object in the device tree
 * @param objData {object} informational data with which attributes the object should be created
 * @param callback {function} callback function
 *
 */
module.exports.createExtendObject = function(adapter, id, objData, callback) {
    adapter.getObject(id, function (err, oldObj) {
        if (!err && oldObj) {
            adapter.extendObject(id, objData, callback);
        } else {
            adapter.setObjectNotExists(id, objData, callback);
        }
    });
}



/**
 * adapterConfigIsValid
 *
 * tests the given adapter config whether it is valid
 *
 * @param adapter {object} link to the adapter instance
 *
 * @returns {boolean} true if config is valid. false if config is invalid
 */
module.exports.adapterConfigIsValid = function(adapter) {
    let configIsValid = true;

    if ('' === adapter.config.Miele_account) {
        adapter.log.warn('Miele account is missing.');
        configIsValid = false;
    }
    if ('' === adapter.config.Miele_pwd) {
        adapter.log.warn('Miele password is missing.');
        configIsValid = false;
    }
    if ('' === adapter.config.Client_ID) {
        adapter.log.warn('Miele API client ID is missing.');
        configIsValid = false;
    }
    if ('' === adapter.config.Client_secret) {
        adapter.log.warn('Miele API client secret is missing.');
        configIsValid = false;
    }
    if ('' === adapter.config.locale) {
        adapter.log.warn('Locale is missing.');
        configIsValid = false;
    }
    if ('' === adapter.config.oauth2_vg) {
        adapter.log.warn('OAuth2_vg is missing.');
        configIsValid = false;
    }
    if ('' === adapter.config.pollinterval) {
        adapter.log.warn('PollInterval is missing.');
        configIsValid = false;
    }
    return configIsValid;
}



/**
 * addMieleDeviceIdent
 *
 * add the ident data to the device tree
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param currentDeviceIdent {object} ident data of the device
 */
module.exports.addMieleDeviceIdent = async function(adapter, path, currentDeviceIdent){
    adapter.log.debug('addMieleDeviceIdent: Path = [' + path + ']');
    await mieleTools.createString(adapter,path + '.ComModFirmware', "the release version of the communication module", currentDeviceIdent.xkmIdentLabel.releaseVersion);
    await mieleTools.createString(adapter,path + '.ComModTechType', "the technical type of the communication module", currentDeviceIdent.xkmIdentLabel.techType);
    await mieleTools.createString(adapter,path + '.DeviceSerial', "the serial number of the device", currentDeviceIdent.deviceIdentLabel.fabNumber);
    await mieleTools.createString(adapter,path + '.DeviceTechType', "the technical type of the device", currentDeviceIdent.deviceIdentLabel.techType);
    await mieleTools.createString(adapter,path + '.DeviceMatNumber', "the material number of the device", currentDeviceIdent.deviceIdentLabel.matNumber);
}



/**
 * addDeviceNicknameAction
 *
 * add the nickname action to the device tree
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param mieleDevice {object} ident data of the device
 */
module.exports.addDeviceNicknameAction = function(adapter, path, mieleDevice) {
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



/**
 * addPowerActionButtons
 *
 * add the Power-button action to the device tree
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 */
module.exports.addPowerActionButtons = function(adapter, path) {
    // addPowerOnAction
    mieleTools.addActionButton(adapter,path,'Power_On', 'Power the Device on.', '');
    // addPowerOffAction
    mieleTools.addActionButton(adapter,path,'Power_Off', 'Power the Device off.', '');
}



/**
 * addStartActionButton
 *
 * add the Start-button action to the device tree
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 */
module.exports.addStartActionButton = function(adapter, path) {
    // addStartAction
    mieleTools.addActionButton(adapter,path,'Start', 'Starts the Device.', 'button.start');
}



/**
 * addStopActionButton
 *
 * add the Stop-button action to the device tree
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 */
module.exports.addStopActionButton = function(adapter, path) {
    // addStopAction
    mieleTools.addActionButton(adapter,path,'Stop', 'Stops the Device.', 'button.stop');
}



/**
 * addStartStopActionButtons
 *
 * add the Start+Stop-buttons action to the device tree
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 */
module.exports.addStartStopActionButtons = function(adapter, path) {
    mieleTools.addStartActionButton(adapter, path);
    mieleTools.addStopActionButton(adapter, path);
}



/**
 * addLightActionButtons
 *
 * add the Light-button actions to the device tree
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 */
module.exports.addLightActionButtons = function(adapter, path) {
    // addLightOnAction
    mieleTools.addActionButton(adapter,path,'Light_On', 'Switches the lights of the Device on.', '');
    // addLightOffAction
    mieleTools.addActionButton(adapter,path,'Light_Off', 'Switches the lights of the Device off.', '');
}



/**
 * addSupercoolingActionButtons
 *
 * add the Supercooling-button actions to the device tree
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 */
module.exports.addSupercoolingActionButtons = function(adapter, path) {
    // addLightOnAction
    mieleTools.addActionButton(adapter,path,'Start_Supercooling', 'Brings the Device into Supercooling mode.', '');
    // addLightOffAction
    mieleTools.addActionButton(adapter,path,'Stop_Supercooling', 'Brings the Device out of Supercooling mode.', '');
}



/**
 * addSuperfreezingActionButtons
 *
 * add the Superfreezing-button actions to the device tree
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 */
module.exports.addSuperfreezingActionButtons = function(adapter, path) {
    // addLightOnAction
    mieleTools.addActionButton(adapter,path,'Start_Superfreezing', 'Brings the Device into Superfreezing mode.', '');
    // addLightOffAction
    mieleTools.addActionButton(adapter,path,'Stop_Superfreezing', 'Brings the Device out of Superfreezing mode.', '');
}



/**
 * addMieleDeviceActions
 *
 * add all the actions to the device tree which are available for the given device type
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param DeviceType {string} type of the device to decide which actions needed to be added
 */
module.exports.addMieleDeviceActions = function(adapter, path, DeviceType){
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
            mieleTools.addPowerActionButtons(adapter,path);
            mieleTools.addStartStopActionButtons(adapter,path);
            // addStartTimeAction
            break;
        case 12:
        case 13:
            // addStopAction
            mieleTools.addStopActionButton(adapter,path);
            break;
        case 17:
        case 18:
            mieleTools.addPowerActionButtons(adapter,path);
            // addStopAction
            mieleTools.addStopActionButton(adapter,path);
            // addLightEnable
            // addLightDisable
            mieleTools.addLightActionButtons(adapter,path);
            break;
        case 19:
            // addStartSuperCoolingAction
            // addStopSuperCoolingAction
            mieleTools.addSupercoolingActionButtons(adapter,path);
            break;
        case 20:
            // addStartSuperFreezingAction
            // addStopSuperFreezingAction
            mieleTools.addSuperfreezingActionButtons(adapter,path);
            break;
        case 21:
            // addStartSuperCoolingAction
            // addStopSuperCoolingAction
            mieleTools.addSupercoolingActionButtons(adapter,path);
            // addStartSuperFreezingAction
            // addStopSuperFreezingAction
            mieleTools.addSuperfreezingActionButtons(adapter,path);
            break;
        case 24:
            // addStopAction
            mieleTools.addStopActionButton(adapter,path);
            break;
        case 31:
            // addStopAction
            mieleTools.addStopActionButton(adapter,path);
            break;
        case 32:
            // addLightEnable
            // addLightDisable
            mieleTools.addLightActionButtons(adapter,path);
            break;
        case 33:
            // addLightEnable
            // addLightDisable
            mieleTools.addLightActionButtons(adapter,path);
            break;
        case 34:
            // addLightEnable
            // addLightDisable
            mieleTools.addLightActionButtons(adapter,path);
            break;
        case 45:
            // addStopAction
            mieleTools.addStopActionButton(adapter,path);
            break;
        case 67:
            // addStopAction
            mieleTools.addStopActionButton(adapter,path);
            break;
        case 68:
            // addLightEnable
            // addLightDisable
            mieleTools.addLightActionButtons(adapter,path);
            // addStartSuperFreezingAction
            // addStopSuperFreezingAction
            mieleTools.addSuperfreezingActionButtons(adapter,path);
            break;
    }
}