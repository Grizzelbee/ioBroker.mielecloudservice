//@ts-check
'use strict';

/**
 * @typedef {import("../lib/adapter-config")._AdapterConfig} AdapterConfig
 * @typedef {import('./types.mieleCloudService').tokenSet} tokenSet
 * @typedef {import('./types.miele').actionsMsg} actionsMsg
 * @typedef {import('./types.miele').identMsg} identMsg
 * @typedef {import('./types.miele').stateMsg} stateMsg
 * @typedef {import('./types.miele').deviceMsg} deviceMsg
 * @typedef {import('./types.miele').deviceMsg} devicesMsg
 */

// required files to load
const axios = require('axios');
const mieleConst = require('./mieleConst.js');
const mieleTools = require('./mieleTools.js');
const flatted = require('flatted');
const knownDevices = {}; // structure of _knownDevices{deviceId: {name:'', icon:'', deviceFolder:''}, ... }
const queuedMessage = {};
let delayTimeOut;

/**
 * checkConfig
 *
 * tests the given adapter config whether it is valid
 *
 * @param {object} adapter link to the adapter instance
 * @param {AdapterConfig} config link to the adapters' configuration
 * @returns {Promise<boolean>} true if config is valid. false if config is invalid
 */
module.exports.checkConfig = async function (adapter, config) {
    return new Promise((resolve, reject) => {
        let configIsValid = true;
        if ('' === config.Client_ID) {
            adapter.log.warn('Miele API client ID is missing.');
            configIsValid = false;
        }
        if ('' === config.Client_secret) {
            adapter.log.warn('Miele API client secret is missing.');
            configIsValid = false;
        }
        if ('' === config.locale) {
            adapter.log.warn('Locale is missing.');
            configIsValid = false;
        }
        if (configIsValid) {
            resolve(configIsValid);
        } else {
            reject(configIsValid);
        }
    });
};

/**
 * generateRandomString
 *
 * generates a random string of given length out of A-Z, a-z, 0-9
 *
 * @param digits {number} length of the random string to generate
 * @returns {Promise<string>}
 */
module.exports.generateRandomString = async function (digits) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < digits; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
};

/**
 *
 * polls the miele cloud API to refresh the device data
 *
 * @param adapter {object} link to the adapter instance
 * @param auth {tokenSet}  OAuth2 object containing required credentials
 */
module.exports.getMieleDevices = async function (adapter, auth) {
    try {
        return await sendAPIRequest(
            adapter,
            auth,
            mieleConst.ENDPOINT_DEVICES.replace('LANG', adapter.config.locale),
            'GET',
            '',
        );
    } catch (error) {
        adapter.log.error(`[refreshMieleDevices] [${error}] |-> JSON.stringify(error):${JSON.stringify(error)}`);
    }
};

/**
 *
 * polls the miele cloud API to get the available events on the API
 *
 * @param adapter {object} link to the adapter instance
 * @param {tokenSet} auth   OAuth2 object containing required credentials
 */
module.exports.getMieleEvents = async function (adapter, auth) {
    try {
        return await sendAPIRequest(
            adapter,
            auth,
            mieleConst.ENDPOINT_EVENTS.replace('LANG', adapter.config.locale),
            'GET',
            '',
        );
    } catch (error) {
        adapter.log.error(`[getMieleEvents] [${error}] |-> JSON.stringify(error):${JSON.stringify(error)}`);
    }
};

/**
 * refreshMieleData
 *
 * polls the miele cloud API to refresh the device data
 *
 * @param adapter {object} link to the adapter instance
 * @param auth {tokenSet}  OAuth2 object containing required credentials
 * @param device {string}
 */
module.exports.getMieleActions = async function (adapter, auth, device) {
    try {
        const result = {};
        result[device] = await sendAPIRequest(
            adapter,
            auth,
            mieleConst.ENDPOINT_ACTIONS.replace('DEVICEID', device),
            'GET',
            '',
        );
        return result;
    } catch (error) {
        adapter.log.error(`[refreshMieleActions] [${error}] |-> JSON.stringify(error):${JSON.stringify(error)}`);
    }
};

/**
 * getMieleFillingLevels
 *
 * polls the miele cloud API to refresh the device filling levels
 *
 * @param adapter {object} link to the adapter instance
 * @param auth {tokenSet}  OAuth2 object containing required credentials
 * param device {string} ID of the device to query the filling levels for
 * @param DEVICEID
 */
module.exports.getMieleFillingLevels = async function (adapter, auth, DEVICEID = 'dummy') {
    try {
        //const result = {};
        //result[device] = await sendAPIRequest(
        return await sendAPIRequest(
            adapter,
            auth,
            //mieleConst.ENDPOINT_FILLINGLEVELS.replace('DEVICEID', device),
            mieleConst.ENDPOINT_FILLINGLEVELS.replace('LANG', adapter.config.locale).replace('DEVICEID', DEVICEID),
            'GET',
            '',
        );
    } catch (error) {
        adapter.log.error(`[refreshMieleFillingLevels] [${error}] |-> JSON.stringify(error):${JSON.stringify(error)}`);
    }
};

/**
 * getMieleFailureDetails
 *
 * polls the miele cloud API to refresh the device failure details
 *
 * @param adapter {object} link to the adapter instance
 * @param auth {tokenSet}  OAuth2 object containing required credentials
 * @param device {string} Id of the device to query the failure details for
 */
module.exports.getMieleFailureDetails = async function (adapter, auth, device) {
    try {
        const result = {};
        result[device] = await sendAPIRequest(
            adapter,
            auth,
            mieleConst.ENDPOINT_FAILUREDETAILS.replace('DEVICEID', device),
            'GET',
            '',
        );
        return result;
    } catch (error) {
        adapter.log.error(`[refreshMieleFailureDetails] [${error}] |-> JSON.stringify(error):${JSON.stringify(error)}`);
    }
};

/**
 * getMieleRooms
 *
 * polls the miele cloud API to refresh the device rooms
 *
 * @param adapter {object} link to the adapter instance
 * @param auth {tokenSet}  OAuth2 object containing required credentials
 * @param device {string} Id of the device to query the rooms for
 */
module.exports.getMieleRooms = async function (adapter, auth, device) {
    try {
        const result = {};
        result[device] = await sendAPIRequest(
            adapter,
            auth,
            mieleConst.ENDPOINT_ROOMS.replace('DEVICEID', device),
            'GET',
            '',
        );
        return result;
    } catch (error) {
        adapter.log.error(`[refreshMieleRooms] [${error}] |-> JSON.stringify(error):${JSON.stringify(error)}`);
    }
};

module.exports.getKnownDevices = function () {
    return knownDevices;
};


/**
 * sendAPIRequest
 *
 * build and send an http request to the miele server
 *
 * @param {object} adapter link to the adapter instance
 * @param {tokenSet} auth OAuth2 token object
 * @param {string} Endpoint the URI endpoint to call
 * @param {string} Method method to use for this request: POST or GET
 * @param {object} payload payload for this request
 */
async function sendAPIRequest(adapter, auth, Endpoint, Method, payload) {
    return new Promise((resolve, reject) => {
        // addressing sentry issues: MIELECLOUDSERVICE-2J, MIELECLOUDSERVICE-2K, MIELECLOUDSERVICE-7
        if (!auth || typeof auth === 'undefined' || Endpoint === '' || Method === '') {
            reject(
                `[sendAPIRequest] Aborting request due to: ${typeof auth === 'undefined' ? 'Missing auth token.' : Endpoint === '' ? 'Missing endpoint.' : 'No method (GET/POST) given.'}`,
            );
        }
        // build options object for axios
        if (auth.access_token.startsWith('$/aes-192-')) {
            auth.access_token = adapter.decrypt(auth.access_token);
        }
        const options = {
            headers: {
                Authorization: `Bearer ${auth.access_token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': mieleConst.UserAgent,
            },
            method: Method,
            data: payload,
            dataType: 'json',
            json: true,
            url: mieleConst.BASE_URL + Endpoint,
        };
        adapter.log.debug(`Doing axios request: ${JSON.stringify(options)}`);
        // @ts-expect-error -  axios is not callable
        axios(options)
            .then(response => {
                if (Object.prototype.hasOwnProperty.call(response, 'data')) {
                    if (Object.prototype.hasOwnProperty.call(response.data, 'message')) {
                        adapter.log.debug(`API returned Information: [${JSON.stringify(response.data.message)}]`);
                        resolve(response.data.message);
                    } else {
                        adapter.log.debug(`API returned Status: [${response.status}]`);
                        switch (response.status) {
                            case 202:
                                resolve({ message: 'Accepted, processing has not been completed.' });
                                break;
                            case 204: // OK, No Content
                                resolve({ message: 'OK, no content.' });
                                break;
                            default:
                                resolve(response.data);
                        }
                    }
                }
            })
            .catch(error => {
                if (error.response) {
                    switch (error.response.status) {
                        case 400:
                            {
                                const device = Endpoint.split('/', 3).pop();
                                adapter.log.debug(
                                    `The API returned http-error 400: ${error.response.data.message} for device: [${knownDevices[device].name} (${device})].`,
                                );
                                reject(error.response.data.message);
                            }
                            break;
                        case 401:
                            adapter.log.error(
                                "OAuth2 Access token has expired. This is okay so far. Trying to refresh it.",
                            );
                            reject('401 - OAuth2 Access token has expired.');
                            break;
                        case 404:
                            adapter.log.info('Device/fabNumber is unknown. Disabling all actions.');
                            resolve(mieleConst.ALL_ACTIONS_DISABLED);
                            break;
                        case 500:
                            adapter.log.info(
                                'HTTP 500: Internal Server Error @Miele-API servers. There is nothing you can do but waiting if if solves itself or get in contact with Miele.',
                            );
                            reject('Error 500: Internal Server Error.');
                            break;
                        case 504:
                            adapter.log.info(
                                'HTTP 504: Gateway Timeout! This error occurred outside of this adapter. Please google it for possible reasons and solutions.',
                            );
                            reject('Error 504: Gateway timeout');
                            break;
                        default:
                            reject(error.response.data.message);
                            break;
                    }
                    // Request made and server responded
                    adapter.log.debug(`Request made and server responded: ${flatted.stringify(error.response)}`);
                } else if (error.request) {
                    // The request was made but no response was received
                    adapter.log.warn(
                        `The request was made but no response was received: [${flatted.stringify(error.request)}]`,
                    );
                    reject(error);
                } else {
                    // Something happened in setting up the request that triggered an Error
                    adapter.log.warn(
                        `Something happened in setting up the request that triggered an Error: [${flatted.stringify(error)}]`,
                    );
                    reject(error);
                }
            });
    });
}



/**
 * send an action to the API to execute it
 *
 * @param {object} adapter link to the adapter instance
 * @param {tokenSet} auth the auth object
 * @param {string} endpoint the API endpoint to call
 * @param {string} device API-ID of the current device
 * @param {object} payload payload to send to the API
 * @returns {Promise<void>}
 */
module.exports.executeAction = async function (adapter, auth, endpoint, device, payload) {
    return new Promise(function (resolve, reject) {
        if (typeof device === 'undefined' || device === '') {
            reject(`Tried to execute an action with no device given. Aborting.`);
        } else {
            resolve(sendAPIRequest(adapter, auth, endpoint.replace('DEVICEID', device), 'PUT', payload));
        }
    });
};

/**
 * Function splitMieleDevices
 *
 * splits the json data received from cloud API into separate device
 *
 * @param {object} adapter Link to the adapter instance
 * @param {devicesMsg} mieleDevices The whole JSON which needs to be split into devices
 */
//module.exports.splitMieleDevices = async function (adapter, auth, mieleDevices) {
module.exports.splitMieleDevices = async function (adapter, mieleDevices) {
    // Splits the data-package returned by the API into single devices and iterates over each single device
    for (const mieleDevice in mieleDevices) {
        if (typeof mieleDevices === 'undefined' || typeof mieleDevice === 'undefined') {
            adapter.log.debug(
                `splitMieleDevices: Given dataset is undefined or not splittable. Returning without action.`,
            );
            return;
        } else if (typeof knownDevices[mieleDevice] === 'undefined') {
            adapter.log.debug(`Device ${mieleDevice} isn't already known. Registering now...`);
            adapter.log.debug(
                `splitMieleDevices: ${mieleDevice}: [${mieleDevice}] *** Value: [${JSON.stringify(mieleDevices[mieleDevice])}]`,
            );
            knownDevices[mieleDevice] = {};
            knownDevices[mieleDevice].lastMessage = Date.now();
            knownDevices[mieleDevice].icon = `icons/${mieleDevices[mieleDevice].ident.type.value_raw}.svg`;
            knownDevices[mieleDevice].API_ID = mieleDevice;
            knownDevices[mieleDevice].deviceType = mieleDevices[mieleDevice].ident.type.value_raw;
            if (mieleDevices[mieleDevice].ident.deviceName === '') {
                knownDevices[mieleDevice].name = mieleDevices[mieleDevice].ident.type.value_localized;
            } else {
                knownDevices[mieleDevice].name = mieleDevices[mieleDevice].ident.deviceName;
            }
            const obj = {
                type: 'device',
                common: {
                    name: knownDevices[mieleDevice].name,
                    read: true,
                    write: false,
                    icon: `icons/${mieleDevices[mieleDevice].ident.type.value_raw}.svg`,
                    type: 'object',
                },
            };
            createOrExtendObject(adapter, mieleDevice, obj, null); // create base object
        }
        // device is already known
        if (adapter.config.delayedProcessing) {
            if (Date.now() - knownDevices[mieleDevice].lastMessage < adapter.config.messageDelay) {
                adapter.log.debug(`Too many messages in a short period. Discarding message.`);
                // queue message
                queuedMessage.device = mieleDevice;
                queuedMessage.ident = mieleDevices[mieleDevice].ident;
                queuedMessage.state = mieleDevices[mieleDevice].state;
                // kill running timeout
                clearTimeout(delayTimeOut);
                // start new timeout
                delayTimeOut = setTimeout(
                    async queuedMessage => {
                        await createIdentTree(adapter, `${queuedMessage.device}.IDENT`, queuedMessage.ident);
                        await createStateTree(
                            adapter,
                            queuedMessage.device,
                            mieleDevices[queuedMessage.device],
                            queuedMessage.state,
                        );
                        knownDevices[mieleDevice].lastMessage = Date.now();
                    },
                    adapter.config.messageDelay,
                    queuedMessage,
                );
                // process queued message if timeout is reached
            } else {
                adapter.log.debug(`Last Event happened long enough ago. Processing message immediately.`);
                await createIdentTree(adapter, `${mieleDevice}.IDENT`, mieleDevices[mieleDevice].ident);
                await createStateTree(adapter, mieleDevice, mieleDevices[mieleDevice], mieleDevices[mieleDevice].state);
                knownDevices[mieleDevice].lastMessage = Date.now();
            }
        } else {
            await createIdentTree(adapter, `${mieleDevice}.IDENT`, mieleDevices[mieleDevice].ident);
            await createStateTree(adapter, mieleDevice, mieleDevices[mieleDevice], mieleDevices[mieleDevice].state);
        }
    }
};

/**
 * addProgramsToDevice
 * queries the supported programs of a device and adds them to the knownDevices structure
 *
 * @param {object} adapter link to the adapter instance
 * @param {tokenSet} auth link to the tokenSet object
 * @param {string} mieleDevice the device to query the programs for
 * @returns {Promise<void>}
 */
module.exports.addProgramsToDevice = async function (adapter, auth, mieleDevice) {
    // query supported programs of this device if needed
    if (Object.prototype.hasOwnProperty.call(knownDevices[mieleDevice], 'programs')) {
        adapter.log.debug(
            `Programs for device ${knownDevices[mieleDevice].name} are already registered. Skipping Query.`,
        );
    } else {
        adapter.log.debug(`KnownDevices before querying programs: ${JSON.stringify(knownDevices[mieleDevice])}`);
        await addPrograms(adapter, auth, mieleDevice);
    }
};

/**
 * createIdentTree
 *
 * add selected ident data to the device tree
 *
 * @param {object} adapter link to the adapter instance
 * @param {string} path path where the data point is going to be created
 * @param {identMsg} currentDeviceIdent ident data of the device
 */
async function createIdentTree(adapter, path, currentDeviceIdent) {
    adapter.log.debug(`createIdentTree: Input data: ${JSON.stringify(currentDeviceIdent)}`);
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
        await createChannelIdent(adapter, path);
        await createString(
            adapter,
            `${path}.ComModFirmware`,
            'The release version of the communication module',
            currentDeviceIdent.xkmIdentLabel.releaseVersion,
        ).catch(err => {
            reject(err);
        });
        await createString(
            adapter,
            `${path}.ComModTechType`,
            'The technical type of the communication module',
            currentDeviceIdent.xkmIdentLabel.techType,
        ).catch(err => {
            reject(err);
        });
        await createString(
            adapter,
            `${path}.DeviceSerial`,
            'The serial number of the device',
            currentDeviceIdent.deviceIdentLabel.fabNumber,
        ).catch(err => {
            reject(err);
        });
        await createString(
            adapter,
            `${path}.DeviceTechType`,
            'The technical type of the device',
            currentDeviceIdent.deviceIdentLabel.techType,
        ).catch(err => {
            reject(err);
        });
        await createString(
            adapter,
            `${path}.DeviceType`,
            currentDeviceIdent.type.key_localized,
            currentDeviceIdent.type.value_localized,
        ).catch(err => {
            reject(err);
        });
        await createNumber(
            adapter,
            `${path}.DeviceType_raw`,
            'Device type as number',
            currentDeviceIdent.type.value_raw,
            '',
            '',
        ).catch(err => {
            reject(err);
        });
        await createString(
            adapter,
            `${path}.DeviceMatNumber`,
            'The material number of the device',
            currentDeviceIdent.deviceIdentLabel.matNumber,
        ).catch(err => {
            reject(err);
        });
        resolve('OK');
    }).catch(err => {
        adapter.log.error(`Failed to create ident-Tree: ${err}`);
    });
}

/**
 * Function addMieleDeviceState
 *
 * adds the current miele device states to the device tree beneath its device type folder (channel) and device Id (device)
 *
 * @param {object} adapter link to the adapter instance
 * @param path {string} path where the device is to be created (aka deviceFolder)
 * @param currentDevice {deviceMsg} the entire JSON for the current device
 * @param currentDeviceState {stateMsg} the JSON for a single device
 */
async function createStateTree(adapter, path, currentDevice, currentDeviceState) {
    // create for ALL devices
    await createStateDeviceMainState(
        adapter,
        `${path}.${currentDeviceState.status.key_localized}`,
        currentDeviceState.status.value_localized,
        currentDeviceState.status.value_raw,
    );
    await createStateSignalFailure(adapter, path, currentDeviceState.signalFailure);
    // set the values for self designed redundant state indicators
    await createStateConnected(adapter, path, currentDeviceState.status.value_raw !== 255);
    await createStateSignalInUse(adapter, path, currentDeviceState.status.value_raw !== 1);
    // nickname action is supported by all devices
    await addDeviceNicknameAction(adapter, path, currentDevice);
    try {
        // set/create device dependant states
        switch (currentDevice.ident.type.value_raw) {
            case 1: // 1 = WASHING MACHINE*
                // setup ecoFeedback channel for this device if needed
                await createChannelEcoFeedback(adapter, path);
                // states the device is known to support
                await createStateProgramID(
                    adapter,
                    `${path}.${currentDeviceState.ProgramID.key_localized}`,
                    currentDeviceState.ProgramID.value_localized,
                    currentDeviceState.ProgramID.value_raw,
                );
                await createStateProgramType(
                    adapter,
                    `${path}.${currentDeviceState.programType.key_localized}`,
                    currentDeviceState.programType.value_localized,
                    currentDeviceState.programType.value_raw,
                );
                await createStateProgramPhase(
                    adapter,
                    `${path}.${currentDeviceState.programPhase.key_localized}`,
                    currentDeviceState.programPhase.value_localized,
                    currentDeviceState.programPhase.value_raw,
                );
                await createStateRemainingTime(adapter, path, currentDeviceState.remainingTime);
                await createStateSignalDoor(adapter, path, currentDeviceState.signalDoor);
                await createStateStartTime(adapter, path, currentDeviceState.startTime);
                await createStateSignalInfo(adapter, path, currentDeviceState.signalInfo);
                await createStateFullRemoteControl(adapter, path, currentDeviceState.remoteEnable.fullRemoteControl);
                await createStateSmartGrid(adapter, path, currentDeviceState.remoteEnable.smartGrid);
                await createStateMobileStart(adapter, path, currentDeviceState.remoteEnable.mobileStart);
                await createStateEstimatedEndTime(adapter, path, currentDeviceState);
                await createStateElapsedTime(adapter, path, currentDeviceState.elapsedTime);
                await createStateSpinningSpeed(
                    adapter,
                    `${path}.${currentDeviceState.spinningSpeed.key_localized}`,
                    currentDeviceState.spinningSpeed,
                    currentDeviceState.spinningSpeed.unit,
                );
                await createStateEcoFeedbackEnergy(adapter, path, currentDeviceState.ecoFeedback);
                await createStateEcoFeedbackWater(adapter, path, currentDeviceState.ecoFeedback);
                await createStateTargetTemperature(adapter, path, currentDeviceState.targetTemperature);
                break;
            case 2: // 2 = TUMBLE DRYER*
                // setup ecoFeedback channel for this device if needed
                await createChannelEcoFeedback(adapter, path);
                // states
                await createStateProgramID(
                    adapter,
                    `${path}.${currentDeviceState.ProgramID.key_localized}`,
                    currentDeviceState.ProgramID.value_localized,
                    currentDeviceState.ProgramID.value_raw,
                );
                await createStateProgramType(
                    adapter,
                    `${path}.${currentDeviceState.programType.key_localized}`,
                    currentDeviceState.programType.value_localized,
                    currentDeviceState.programType.value_raw,
                );
                await createStateProgramPhase(
                    adapter,
                    `${path}.${currentDeviceState.programPhase.key_localized}`,
                    currentDeviceState.programPhase.value_localized,
                    currentDeviceState.programPhase.value_raw,
                );
                await createStateRemainingTime(adapter, path, currentDeviceState.remainingTime);
                await createStateStartTime(adapter, path, currentDeviceState.startTime);
                await createStateSignalDoor(adapter, path, currentDeviceState.signalDoor);
                await createStateSignalInfo(adapter, path, currentDeviceState.signalInfo);
                await createStateFullRemoteControl(adapter, path, currentDeviceState.remoteEnable.fullRemoteControl);
                await createStateSmartGrid(adapter, path, currentDeviceState.remoteEnable.smartGrid);
                await createStateMobileStart(adapter, path, currentDeviceState.remoteEnable.mobileStart);
                await createStateEstimatedEndTime(adapter, path, currentDeviceState);
                await createStateElapsedTime(adapter, path, currentDeviceState.elapsedTime);
                await createStateDryingStep(
                    adapter,
                    `${path}.${currentDeviceState.dryingStep.key_localized}`,
                    currentDeviceState.dryingStep.value_localized,
                    currentDeviceState.dryingStep.value_raw,
                );
                await createStateEcoFeedbackEnergy(adapter, path, currentDeviceState.ecoFeedback);
                await createStateTargetTemperature(adapter, path, currentDeviceState.targetTemperature);
                break;
            case 24: // 24 = WASHER DRYER*
                // setup ecoFeedback channel for this device if needed
                await createChannelEcoFeedback(adapter, path);
                // states
                await createStateProgramID(
                    adapter,
                    `${path}.${currentDeviceState.ProgramID.key_localized}`,
                    currentDeviceState.ProgramID.value_localized,
                    currentDeviceState.ProgramID.value_raw,
                );
                await createStateProgramType(
                    adapter,
                    `${path}.${currentDeviceState.programType.key_localized}`,
                    currentDeviceState.programType.value_localized,
                    currentDeviceState.programType.value_raw,
                );
                await createStateProgramPhase(
                    adapter,
                    `${path}.${currentDeviceState.programPhase.key_localized}`,
                    currentDeviceState.programPhase.value_localized,
                    currentDeviceState.programPhase.value_raw,
                );
                await createStateRemainingTime(adapter, path, currentDeviceState.remainingTime);
                await createStateSignalDoor(adapter, path, currentDeviceState.signalDoor);
                await createStateStartTime(adapter, path, currentDeviceState.startTime);
                await createStateSignalInfo(adapter, path, currentDeviceState.signalInfo);
                await createStateFullRemoteControl(adapter, path, currentDeviceState.remoteEnable.fullRemoteControl);
                await createStateSmartGrid(adapter, path, currentDeviceState.remoteEnable.smartGrid);
                await createStateMobileStart(adapter, path, currentDeviceState.remoteEnable.mobileStart);
                await createStateEstimatedEndTime(adapter, path, currentDeviceState);
                await createStateElapsedTime(adapter, path, currentDeviceState.elapsedTime);
                await createStateSpinningSpeed(
                    adapter,
                    `${path}.${currentDeviceState.spinningSpeed.key_localized}`,
                    currentDeviceState.spinningSpeed,
                    currentDeviceState.spinningSpeed.unit,
                );
                await createStateDryingStep(
                    adapter,
                    `${path}.${currentDeviceState.dryingStep.key_localized}`,
                    currentDeviceState.dryingStep.value_localized,
                    currentDeviceState.dryingStep.value_raw,
                );
                await createStateEcoFeedbackEnergy(adapter, path, currentDeviceState.ecoFeedback);
                await createStateEcoFeedbackWater(adapter, path, currentDeviceState.ecoFeedback);
                await createStateTargetTemperature(adapter, path, currentDeviceState.targetTemperature);
                break;
            case 7: // 7 = DISHWASHER*
            case 8: // 8 = DISHWASHER SEMI-PROF
                // setup ecoFeedback channel for this device if needed
                await createChannelEcoFeedback(adapter, path);
                // states
                await createStateProgramID(
                    adapter,
                    `${path}.${currentDeviceState.ProgramID.key_localized}`,
                    currentDeviceState.ProgramID.value_localized,
                    currentDeviceState.ProgramID.value_raw,
                );
                await createStateProgramType(
                    adapter,
                    `${path}.${currentDeviceState.programType.key_localized}`,
                    currentDeviceState.programType.value_localized,
                    currentDeviceState.programType.value_raw,
                );
                await createStateProgramPhase(
                    adapter,
                    `${path}.${currentDeviceState.programPhase.key_localized}`,
                    currentDeviceState.programPhase.value_localized,
                    currentDeviceState.programPhase.value_raw,
                );
                await createStateRemainingTime(adapter, path, currentDeviceState.remainingTime);
                await createStateStartTime(adapter, path, currentDeviceState.startTime);
                await createStateSignalInfo(adapter, path, currentDeviceState.signalInfo);
                await createStateSignalDoor(adapter, path, currentDeviceState.signalDoor);
                await createStateFullRemoteControl(adapter, path, currentDeviceState.remoteEnable.fullRemoteControl);
                await createStateSmartGrid(adapter, path, currentDeviceState.remoteEnable.smartGrid);
                await createStateMobileStart(adapter, path, currentDeviceState.remoteEnable.mobileStart);
                await createStateEstimatedEndTime(adapter, path, currentDeviceState);
                await createStateElapsedTime(adapter, path, currentDeviceState.elapsedTime);
                await createStateEcoFeedbackEnergy(adapter, path, currentDeviceState.ecoFeedback);
                await createStateEcoFeedbackWater(adapter, path, currentDeviceState.ecoFeedback);
                break;
            case 12: // 12 = OVEN*
                await createStateProgramID(
                    adapter,
                    `${path}.${currentDeviceState.ProgramID.key_localized}`,
                    currentDeviceState.ProgramID.value_localized,
                    currentDeviceState.ProgramID.value_raw,
                );
                await createStateProgramType(
                    adapter,
                    `${path}.${currentDeviceState.programType.key_localized}`,
                    currentDeviceState.programType.value_localized,
                    currentDeviceState.programType.value_raw,
                );
                await createStateProgramPhase(
                    adapter,
                    `${path}.${currentDeviceState.programPhase.key_localized}`,
                    currentDeviceState.programPhase.value_localized,
                    currentDeviceState.programPhase.value_raw,
                );
                await createStateRemainingTime(adapter, path, currentDeviceState.remainingTime);
                await createStateStartTime(adapter, path, currentDeviceState.startTime);
                await createStateSignalInfo(adapter, path, currentDeviceState.signalInfo);
                await createStateSignalDoor(adapter, path, currentDeviceState.signalDoor);
                await createStateFullRemoteControl(adapter, path, currentDeviceState.remoteEnable.fullRemoteControl);
                await createStateSmartGrid(adapter, path, currentDeviceState.remoteEnable.smartGrid);
                await createStateMobileStart(adapter, path, currentDeviceState.remoteEnable.mobileStart);
                await createStateEstimatedEndTime(adapter, path, currentDeviceState);
                await createStateElapsedTime(adapter, path, currentDeviceState.elapsedTime);
                await createStateTemperature(adapter, path, currentDeviceState.temperature);
                await createStateTargetTemperature(adapter, path, currentDeviceState.targetTemperature);
                break;
            case 13: // 13 = OVEN Microwave*
            case 15: // 15 = STEAM OVEN*
            case 16: // 16 = MICROWAVE*
            case 31: // 31 = STEAM OVEN COMBINATION*
            case 45: // 45 = STEAM OVEN MICROWAVE COMBINATION*
            case 67: // 67 = DIALOG OVEN*
                await createStateProgramID(
                    adapter,
                    `${path}.${currentDeviceState.ProgramID.key_localized}`,
                    currentDeviceState.ProgramID.value_localized,
                    currentDeviceState.ProgramID.value_raw,
                );
                await createStateProgramType(
                    adapter,
                    `${path}.${currentDeviceState.programType.key_localized}`,
                    currentDeviceState.programType.value_localized,
                    currentDeviceState.programType.value_raw,
                );
                await createStateProgramPhase(
                    adapter,
                    `${path}.${currentDeviceState.programPhase.key_localized}`,
                    currentDeviceState.programPhase.value_localized,
                    currentDeviceState.programPhase.value_raw,
                );
                await createStateRemainingTime(adapter, path, currentDeviceState.remainingTime);
                await createStateStartTime(adapter, path, currentDeviceState.startTime);
                await createStateSignalInfo(adapter, path, currentDeviceState.signalInfo);
                await createStateSignalDoor(adapter, path, currentDeviceState.signalDoor);
                await createStateFullRemoteControl(adapter, path, currentDeviceState.remoteEnable.fullRemoteControl);
                await createStateSmartGrid(adapter, path, currentDeviceState.remoteEnable.smartGrid);
                await createStateMobileStart(adapter, path, currentDeviceState.remoteEnable.mobileStart);
                await createStateEstimatedEndTime(adapter, path, currentDeviceState);
                await createStateElapsedTime(adapter, path, currentDeviceState.elapsedTime);
                await createStateTemperature(adapter, path, currentDeviceState.temperature);
                await createStateTargetTemperature(adapter, path, currentDeviceState.targetTemperature);
                break;
            case 14: // 14 = HOB HIGHLIGHT*
            case 27: // 27 = HOB INDUCTION*
                await createStatePlateStep(adapter, path, currentDeviceState.plateStep);
                break;
            case 17: // 17 = COFFEE SYSTEM*
                await createStateProgramID(
                    adapter,
                    `${path}.${currentDeviceState.ProgramID.key_localized}`,
                    currentDeviceState.ProgramID.value_localized,
                    currentDeviceState.ProgramID.value_raw,
                );
                await createStateProgramPhase(
                    adapter,
                    `${path}.${currentDeviceState.programPhase.key_localized}`,
                    currentDeviceState.programPhase.value_localized,
                    currentDeviceState.programPhase.value_raw,
                );
                await createStateSignalInfo(adapter, path, currentDeviceState.signalInfo);
                await createStateFullRemoteControl(adapter, path, currentDeviceState.remoteEnable.fullRemoteControl);
                await createStateSmartGrid(adapter, path, currentDeviceState.remoteEnable.smartGrid);
                await createStateMobileStart(adapter, path, currentDeviceState.remoteEnable.mobileStart);
                break;
            case 18: // 18 = HOOD*
                // States
                await createStateSignalInfo(adapter, path, currentDeviceState.signalInfo);
                await createStateFullRemoteControl(adapter, path, currentDeviceState.remoteEnable.fullRemoteControl);
                await createStateSmartGrid(adapter, path, currentDeviceState.remoteEnable.smartGrid);
                await createStateMobileStart(adapter, path, currentDeviceState.remoteEnable.mobileStart);
                await createVentilationStepSwitch(adapter, path, currentDeviceState.ventilationStep.value_raw);
                // colors
                break;
            case 19: // 19 = FRIDGE*
                await createStateSignalInfo(adapter, path, currentDeviceState.signalInfo);
                await createStateSignalDoor(adapter, path, currentDeviceState.signalDoor);
                await createStateFullRemoteControl(adapter, path, currentDeviceState.remoteEnable.fullRemoteControl);
                await createStateSmartGrid(adapter, path, currentDeviceState.remoteEnable.smartGrid);
                await createStateMobileStart(adapter, path, currentDeviceState.remoteEnable.mobileStart);
                await createStateTemperature(adapter, path, currentDeviceState.temperature);
                await createStateTargetTemperature(adapter, path, currentDeviceState.targetTemperature);
                break;
            case 20: // 20 = FREEZER*
                await createStateSignalInfo(adapter, path, currentDeviceState.signalInfo);
                await createStateSignalDoor(adapter, path, currentDeviceState.signalDoor);
                await createStateFullRemoteControl(adapter, path, currentDeviceState.remoteEnable.fullRemoteControl);
                await createStateSmartGrid(adapter, path, currentDeviceState.remoteEnable.smartGrid);
                await createStateMobileStart(adapter, path, currentDeviceState.remoteEnable.mobileStart);
                await createStateTemperature(adapter, path, currentDeviceState.temperature);
                await createStateTargetTemperature(adapter, path, currentDeviceState.targetTemperature);
                break;
            case 21: // 21 = FRIDGE-/FREEZER COMBINATION*
                await createStateSignalInfo(adapter, path, currentDeviceState.signalInfo);
                await createStateSignalDoor(adapter, path, currentDeviceState.signalDoor);
                await createStateFullRemoteControl(adapter, path, currentDeviceState.remoteEnable.fullRemoteControl);
                await createStateSmartGrid(adapter, path, currentDeviceState.remoteEnable.smartGrid);
                await createStateMobileStart(adapter, path, currentDeviceState.remoteEnable.mobileStart);
                await createStateTemperature(adapter, path, currentDeviceState.temperature);
                await createStateTargetTemperature(adapter, path, currentDeviceState.targetTemperature);
                break;
            case 32: // 32 = WINE CABINET*
            case 33: // 33 = WINE CONDITIONING UNIT
            case 34: // 34 = WINE STORAGE CONDITIONING UNIT
                await createStateSignalInfo(adapter, path, currentDeviceState.signalInfo);
                await createStateSignalDoor(adapter, path, currentDeviceState.signalDoor);
                await createStateFullRemoteControl(adapter, path, currentDeviceState.remoteEnable.fullRemoteControl);
                await createStateSmartGrid(adapter, path, currentDeviceState.remoteEnable.smartGrid);
                await createStateMobileStart(adapter, path, currentDeviceState.remoteEnable.mobileStart);
                await createStateTemperature(adapter, path, currentDeviceState.temperature);
                await createStateTargetTemperature(adapter, path, currentDeviceState.targetTemperature);
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
                await createStateSignalInfo(adapter, path, currentDeviceState.signalInfo);
                await createStateFullRemoteControl(adapter, path, currentDeviceState.remoteEnable.fullRemoteControl);
                await createStateSmartGrid(adapter, path, currentDeviceState.remoteEnable.smartGrid);
                await createStateMobileStart(adapter, path, currentDeviceState.remoteEnable.mobileStart);
                await createStateTemperature(adapter, path, currentDeviceState.temperature);
                await createStateTargetTemperature(adapter, path, currentDeviceState.targetTemperature);
                break;
            case 23: // 23 = VACUUM CLEANER, AUTOMATIC ROBOTIC VACUUM CLEANER*
                await createStateBatteryLevel(adapter, path, currentDeviceState.batteryLevel);
                // await createGroupRooms(adapter,  path);
                break;
            case 25: // 25 = DISH WARMER*
                await createStateProgramID(
                    adapter,
                    `${path}.${currentDeviceState.ProgramID.key_localized}`,
                    currentDeviceState.ProgramID.value_localized,
                    currentDeviceState.ProgramID.value_raw,
                );
                await createStateProgramPhase(
                    adapter,
                    `${path}.${currentDeviceState.programPhase.key_localized}`,
                    currentDeviceState.programPhase.value_localized,
                    currentDeviceState.programPhase.value_raw,
                );
                await createStateRemainingTime(adapter, path, currentDeviceState.remainingTime);
                await createStateTargetTemperature(adapter, path, currentDeviceState.targetTemperature);
                await createStateSignalDoor(adapter, path, currentDeviceState.signalDoor);
                await createStateTemperature(adapter, path, currentDeviceState.temperature);
                await createStateSignalInfo(adapter, path, currentDeviceState.signalInfo);
                break;
            case 48: // 48 = VACUUM DRAWER
                break;
            case 74: // 74 = Hob with vapour extraction
                // States
                await createStatePlateStep(adapter, path, currentDeviceState.plateStep);
                await createStateSignalFailure(adapter, path, currentDeviceState.signalFailure);
                await createStateFullRemoteControl(adapter, path, currentDeviceState.remoteEnable.fullRemoteControl);
                await createStateSmartGrid(adapter, path, currentDeviceState.remoteEnable.smartGrid);
                await createStateMobileStart(adapter, path, currentDeviceState.remoteEnable.mobileStart);
                await createVentilationStepSwitch(adapter, path, currentDeviceState.ventilationStep.value_raw);
                // colors
                break;
        }
    } catch (err) {
        adapter.log.error(`[addMieleDeviceState]: ${err.message}, Stacktrace: ${err.stack}`);
    }
}

/**
 * addDeviceNicknameAction
 *
 * add the nickname action to the device tree
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param mieleDevice {devicesMsg} ident data of the device
 */
async function addDeviceNicknameAction(adapter, path, mieleDevice) {
    // addDeviceNicknameAction - suitable for each and every device
    await createRWState(
        adapter,
        `${path}.ACTIONS.Nickname`,
        'Nickname of your device. Can be edited in Miele APP or here!',
        mieleDevice.ident.deviceName === '' ? mieleDevice.ident.type.value_localized : mieleDevice.ident.deviceName,
        'string',
        'text',
        null,
    );
}

/**
 * createStateDeviceMainState
 *
 * create the state that shows the main state for this Device.
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param value {string} value to set to the data point
 * @param value_raw {number} value to set to the raw-data point
 */
async function createStateDeviceMainState(adapter, path, value, value_raw) {
    await createROState(adapter, `${path}_raw`, 'Main state of the Device (raw-value)', value_raw, 'number', 'value');
    await createString(adapter, path, 'Main state of the Device', value);
}

/**
 * createStateSignalFailure
 *
 * create the state that shows whether a failure message is active for this Device.
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param value {boolean} value to set to the data point
 */
async function createStateSignalFailure(adapter, path, value) {
    await createROState(
        adapter,
        `${path}.signalFailure`,
        'Indicates whether a failure message is active for this Device.',
        value,
        'boolean',
        'indicator',
    );
    if (value){
        const deviceID = path.split('.').pop() || '';
        await mieleTools.getMieleFailureDetails(adapter, await adapter.getObjectAsync(adapter.namespace), deviceID)
            .then(failureDetails => {
                adapter.log.debug(`Received FailureDetails: ${failureDetails}`);
            })
            .catch(err => {
                adapter.log.warn(`getMieleFailureDetails crashed with error: [${err}]`);
            })

    }
}

/**
 * createStateSignalInUse
 *
 * create the state that shows whether the device is connected to WLAN or Gateway.
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param value {boolean} value to set to the data point
 */
async function createStateSignalInUse(adapter, path, value) {
    await createROState(
        adapter,
        `${path}.signalInUse`,
        'Indicates whether the device is in use or switched off.',
        value,
        'boolean',
        'indicator',
    );
}

/**
 * createStateSignalInfo
 *
 * create the state that shows whether a notification is active for this Device
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param value {boolean} value to set to the data point
 */
async function createStateSignalInfo(adapter, path, value) {
    await createROState(
        adapter,
        `${path}.signalInfo`,
        'Indicates whether a notification is active for this Device.',
        value,
        'boolean',
        'indicator',
    );
}

/**
 * createStateConnected
 *
 * create the state that shows whether the device is connected to WLAN or Gateway.
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param value {boolean} value to set to the data point
 */
async function createStateConnected(adapter, path, value) {
    await createROState(
        adapter,
        `${path}.Connected`,
        'Indicates whether the device is connected to WLAN or Gateway.',
        value,
        'boolean',
        'indicator.reachable',
    );
}

/**
 * createStateSmartGrid
 *
 * create the state that shows whether the device is set to Smart Grid mode
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param value {boolean} value to set to the data point
 */
async function createStateSmartGrid(adapter, path, value) {
    await createROState(
        adapter,
        `${path}.smartGrid`,
        'Indicates whether the device is set to Smart Grid mode',
        value,
        'boolean',
        'indicator',
    );
}

/**
 * createStateMobileStart
 *
 * create the state that shows whether the device is set to Smart Grid mode
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param value {boolean} value to set to the data point
 */
async function createStateMobileStart(adapter, path, value) {
    await createROState(
        adapter,
        `${path}.mobileStart`,
        'Indicates whether the device supports the Mobile Start option.',
        value,
        'boolean',
        'indicator',
    );
}

/**
 * createStateFullRemoteControl
 *
 * create the state that shows whether the device can be controlled from remote.
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param value {boolean} value to set to the data point
 */
async function createStateFullRemoteControl(adapter, path, value) {
    await createROState(
        adapter,
        `${path}.fullRemoteControl`,
        'Indicates whether the device can be controlled from remote.',
        value,
        'boolean',
        'indicator',
    );
}

/**
 * createStateSignalDoor
 *
 * create the state that shows whether a door-open message is active for this Device
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param value {boolean} value to set to the data point
 */
async function createStateSignalDoor(adapter, path, value) {
    await createROState(
        adapter,
        `${path}.signalDoor`,
        'Indicates whether a door-open message is active for this Device.',
        value,
        'boolean',
        'indicator',
    );
}

/**
 * addPrograms
 *
 * adds the available programs for the given device to the object tree
 *
 * @param {object} adapter link to the adapter instance
 * @param {tokenSet} auth Object with authorization information for Miele API
 * @param {string} device The device to query the programs for
 */
async function addPrograms(adapter, auth, device) {
    await sendAPIRequest(
        adapter,
        auth,
        mieleConst.ENDPOINT_PROGRAMS.replace('DEVICEID', knownDevices[device].API_ID).replace(
            'LANG',
            adapter.config.locale,
        ),
        'GET',
        '',
    )
        .then(programs => {
            adapter.log.debug(`addPrograms: available Progs: ${JSON.stringify(programs)}`);
            if (Object.keys(programs).length > 0) {
                knownDevices[device].programs = [];
                knownDevices[device].programs = programs;
                adapter.log.debug(`addPrograms: knownDevices: ${JSON.stringify(knownDevices)}`);
                for (const prog in programs) {
                    createOrExtendObject(
                        adapter,
                        `${device}.ACTIONS.${programs[prog].programId}`,
                        {
                            type: 'state',
                            common: {
                                name: programs[prog].program,
                                read: true,
                                write: true,
                                role: 'button',
                                type: 'boolean',
                            },
                            native: { parameters: programs.parameters },
                        },
                        true,
                    );
                }
            } else {
                adapter.log.info(
                    `Sorry. No programs to add for device: ${knownDevices[device].name} (${device}). Reason: No programs have been returned by the API for this device.`,
                );
                knownDevices[device].programs = {};
            }
        })
        .catch(err => {
            adapter.log.info(
                `Sorry. No programs to add for device: ${knownDevices[device].name} (${device}). Reason: ${err}`,
            );
            knownDevices[device].programs = {};
        });
}

/**
 * createStateProgramID
 *
 * create the state that shows the main state for this Device.
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param value {string} value to set to the data point
 * @param value_raw {number} value to set to the raw-data point
 */
async function createStateProgramID(adapter, path, value, value_raw) {
    await createROState(adapter, `${path}_raw`, 'ID of the running Program (raw-value)', value_raw, 'number', 'value');
    await createROState(adapter, path, 'Name of the running Program', value, 'string', 'text');
}

/**
 * createStateProgramType
 *
 * create the state that shows the Program type of the running Program
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param value {string} value to set to the data point
 * @param value_raw {number} value to set to the raw-data point
 */
async function createStateProgramType(adapter, path, value, value_raw) {
    await createROState(
        adapter,
        `${path}_raw`,
        'Program type of the running Program (raw-value)',
        value_raw,
        'number',
        'value',
    );
    await createROState(adapter, path, 'Program type of the running Program', value, 'string', 'text');
}

/**
 * createStateProgramPhase
 *
 * create the state that shows the Phase of the running program
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param value {string} value to set to the data point
 * @param value_raw {number} value to set to the raw-data point
 */
async function createStateProgramPhase(adapter, path, value, value_raw) {
    await createROState(
        adapter,
        `${path}_raw`,
        'Phase of the running program (raw-value)',
        value_raw,
        'number',
        'value',
    );
    await createROState(adapter, path, 'Phase of the running program', value, 'string', 'text');
}

/**
 * createStateDryingStep
 *
 * create the state that shows the
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param value {string} value to set to the data point
 * @param value_raw {number} value to set to the raw-data point
 */
async function createStateDryingStep(adapter, path, value, value_raw) {
    await createROState(
        adapter,
        `${path}_raw`,
        'The dryingStep object represents the selected drying step of a tumble dryer or a washer-dryer combination. (raw-value)',
        value_raw,
        'number',
        'value',
    );
    await createROState(
        adapter,
        path,
        'The dryingStep object represents the selected drying step of a tumble dryer or a washer-dryer combination.',
        value,
        'string',
        'text',
    );
}

/**
 * createStateEstimatedEndTime
 *
 * create the state that shows the estimated ending time of the current running program
 *
 * @param {object} adapter  link to the adapter instance
 * @param {string} path path where the data point is going to be created
 * @param {stateMsg} currentDeviceState array that contains the remaining time in format [hours, minutes]
 */
async function createStateEstimatedEndTime(adapter, path, currentDeviceState) {
    if (
        currentDeviceState.status.value_raw < 2 ||
        currentDeviceState.remainingTime[0] + currentDeviceState.remainingTime[1] === 0
    ) {
        adapter.log.debug(`No EstimatedEndTime to show for device ${knownDevices[path].name} (${path})!`);
        await createROState(
            adapter,
            `${path}.estimatedEndTime`,
            'The EstimatedEndTime is the current time plus remaining time of the running program.',
            '',
            'string',
            'text',
        );
    } else {
        const now = new Date();
        const estimatedEndTime = new Date();
        estimatedEndTime.setMinutes(
            now.getMinutes() + (currentDeviceState.remainingTime[0] * 60 + currentDeviceState.remainingTime[1]),
        );
        const timeToShow = estimatedEndTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        await createROState(
            adapter,
            `${path}.estimatedEndTime`,
            'The EstimatedEndTime is the current time plus remaining time of the running program.',
            timeToShow,
            'string',
            'text',
        );
    }
}

/**
 * createStateRemainingTime
 *
 * create the state that shows the remaining time of the running program
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param remainingTime {object} array value to set to the data point
 */
async function createStateRemainingTime(adapter, path, remainingTime) {
    await createTime(
        adapter,
        `${path}.remainingTime`,
        'The RemainingTime equals the relative remaining time',
        remainingTime,
        'text',
    );
}

/**
 * createStateStartTime
 *
 * create the state that shows the start time of the running program
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param startTime {object} array value to set to the data point
 */
async function createStateStartTime(adapter, path, startTime) {
    await createTime(
        adapter,
        `${path}.ACTIONS.startTime`,
        'The StartTime equals the relative starting time',
        startTime,
        'value',
    );
}

/**
 * createStateElapsedTime
 *
 * create the state that shows the elapsed time of the running program
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param value {object} array value that represents a time value to set to the data point
 */
async function createStateElapsedTime(adapter, path, value) {
    await createTime(
        adapter,
        `${path}.elapsedTime`,
        'ElapsedTime since program start (only present for certain devices)',
        value,
        '',
    );
}

/**
 * createStateTemperature
 *
 * create the state that shows information about one or multiple temperatures of the device.
 * API returns 1 to 3 values depending on the device
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param valueObj {object} array valueObj to set to the data point
 */
async function createStateTemperature(adapter, path, valueObj) {
    for (let n = 0; n < valueObj.length; n++) {
        if (
            valueObj[n].value_raw === -32768 ||
            valueObj[n].value_raw === null ||
            valueObj[n].value_raw === 'null' ||
            valueObj[n].value_raw === 'undefined'
        ) {
            return;
        }
        const unit = valueObj[n].unit === 'Celsius' ? '°C' : '°F';
        createOrExtendObject(
            adapter,
            `${path}.temperatureZone-${n + 1}`,
            {
                type: 'state',
                common: {
                    name: `The current temperature of zone ${n + 1}.`,
                    read: true,
                    write: false,
                    type: 'number',
                    unit: unit,
                    role: 'value.temperature',
                },
                native: {},
            },
            valueObj[n].value_localized,
        );
    }
}

/**
 * createStateTargetTemperature
 *
 * create the state that shows information about one or multiple target temperatures of the process.
 * API returns 0 to 3 values depending on the device
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param valueObj {object} array valueObj to set to the data point
 */
async function createStateTargetTemperature(adapter, path, valueObj) {
    for (let n = 0; n < valueObj.length; n++) {
        if (
            valueObj[n].value_raw === -32768 ||
            valueObj[n].value_raw === null ||
            valueObj[n].value_raw === 'null' ||
            valueObj[n].value_raw === 'undefined'
        ) {
            return;
        }
        const unit = valueObj[n].unit === 'Celsius' ? '°C' : '°F';
        createOrExtendObject(
            adapter,
            `${path}.ACTIONS.targetTemperatureZone-${n + 1}`,
            {
                type: 'state',
                common: {
                    name: `The target temperature of zone ${n + 1}.`,
                    read: true,
                    write: true,
                    type: 'number',
                    unit: unit,
                    role: 'value.temperature',
                },
                native: {},
            },
            valueObj[n].value_localized,
        );
    }
}

/**
 * updateStateTargetTemperature
 *
 * create the state that shows information about one or multiple target temperatures of the process.
 * API returns 1 to 3 values depending on the device
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param valueObj {object} array valueObj to set to the data point
 */
async function updateStateTargetTemperature(adapter, path, valueObj) {
    for (let n = 0; n < valueObj.length; n++) {
        if (
            valueObj[n].value_raw === -32768 ||
            valueObj[n].value_raw === null ||
            valueObj[n].value_raw === 'null' ||
            valueObj[n].value_raw === 'undefined'
        ) {
            return;
        }
        adapter.getObject(`${path}.ACTIONS.targetTemperatureZone-${valueObj[n].zone}`, function (err, oldObj) {
            if (!err && oldObj) {
                if (
                    `The target temperature of zone ${valueObj[n].zone} (${valueObj[n].min} to ${valueObj[n].max}).` !==
                    oldObj.common.name
                ) {
                    adapter.extendObject(`${path}.ACTIONS.targetTemperatureZone-${valueObj[n].zone}`, {
                        common: {
                            name: `The target temperature of zone ${valueObj[n].zone} (${valueObj[n].min} to ${valueObj[n].max}).`,
                            min: valueObj[n].min,
                            max: valueObj[n].max,
                        },
                        native: {},
                    });
                }
            }
        });
    }
}

/**
 * createStatePlateStep
 *
 * create the state that shows the selected cooking zone levels for a hob
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param value {object} array value to set to the data point
 */
async function createStatePlateStep(adapter, path, value) {
    for (const n in value) {
        const MyPath = `${path}.PlateStepZone-${n}`;
        await createROState(
            adapter,
            MyPath,
            'The plateStep object represents the selected cooking zone levels for a hob (localized value).',
            value[n].value_localized,
            'string',
            'text',
        );
        await createROState(
            adapter,
            `${MyPath}_raw`,
            'The plateStep object represents the selected cooking zone levels for a hob (raw value).',
            Number.parseInt(value[n].value_raw),
            'number',
            'level',
        );
    }
}

/**
 * createStateBatteryLevel
 *
 * create the state that shows the charging level of a builtin battery as a percentage value between 0 - 100
 * NEW API 1.0.4
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param value {number} value to set to the data point
 */
async function createStateBatteryLevel(adapter, path, value) {
    await createNumber(
        adapter,
        `${path}.batteryLevel`,
        'The batteryLevel object returns the charging level of a builtin battery as a percentage value between 0 .. 100',
        value == null ? 0 : value,
        '%',
        'value',
    );
}

/**
 * createStateEcoFeedbackWater
 *
 * create the states that show
 * NEW API 1.0.4
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param ecoFeedback {object} value to set to the data point
 */
async function createStateEcoFeedbackWater(adapter, path, ecoFeedback) {
    //adapter.log.debug(`createStateEcoFeedbackWater: Path[${path}], setup: [${setup}], path: [${path}], value: [${JSON.stringify(ecoFeedback)}]`);
    await createNumber(
        adapter,
        `${path}.EcoFeedback.currentWaterConsumption`,
        'The amount of water used by the current running program up to the present moment.',
        ecoFeedback === null ? 0 : ecoFeedback.currentWaterConsumption.value.valueOf(),
        ecoFeedback === null ? 'l' : ecoFeedback.currentWaterConsumption.unit,
        'value',
    );
    await createNumber(
        adapter,
        `${path}.EcoFeedback.waterForecast`,
        'The relative water usage for the selected program from 0 to 100.',
        ecoFeedback === null ? 0 : ecoFeedback.waterForecast * 100,
        '%',
        'value',
    );
}

/**
 * createStateEcoFeedbackEnergy
 *
 * create the states that show
 * NEW API 1.0.4
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param ecoFeedback {object} value to set to the data point
 */
async function createStateEcoFeedbackEnergy(adapter, path, ecoFeedback) {
    await createNumber(
        adapter,
        `${path}.EcoFeedback.currentEnergyConsumption`,
        'The amount of energy used by the current running program up to the present moment.',
        ecoFeedback === null ? 0 : ecoFeedback.currentEnergyConsumption.value.valueOf(),
        ecoFeedback === null ? 'kWh' : ecoFeedback.currentEnergyConsumption.unit,
        'value.power.consumption',
    );
    await createNumber(
        adapter,
        `${path}.EcoFeedback.EnergyForecast`,
        'The relative energy usage for the selected program from 0 to 100.',
        ecoFeedback === null ? 0 : ecoFeedback.energyForecast * 100,
        '%',
        'value',
    );
}

/**
 * createStateSpinningSpeed
 *
 * create the states that show
 *
 * @param adapter               {object} link to the adapter instance
 * @param path                  {string} path where the data point is going to be created
 * @param value                 {object} values to set to the data point
 * @param value.value_localized {string} value to set to the data point
 * @param value.key_localized   {string} value to set to the data point
 * @param value.value_raw       {any} raw number value to set to the data point
 * @param value.unit            {string} raw number value to set to the data point
 * @param unit                  {string} unit the value is in
 */
async function createStateSpinningSpeed(adapter, path, value, unit) {
    await createROState(
        adapter,
        path,
        'Spinning speed of a washing machine (localized value).',
        value.value_localized,
        'string',
        'text',
    );
    await createNumber(
        adapter,
        `${path}_raw`,
        'Spinning speed of a washing machine (raw value).',
        Number.parseInt(value.value_raw),
        unit,
        'value',
    );
}

/**
 * createChannelActions
 *
 * create the channel for Actions
 *
 * @param {object} adapter link to the adapter instance
 * @param {actionsMsg} message the message object as received from miele
 */
module.exports.splitMieleActionsMessage = async function (adapter, message) {
    for (const [device, actions] of Object.entries(message)) {
        adapter.log.debug(`Device ${device}: Value ${JSON.stringify(actions)} | typeof value ${typeof actions}`);
        if (typeof knownDevices[device] === 'undefined') {
            adapter.log.debug(`Device [${device}] is currently unknown - skipping creating actions on it.`);
        } else {
            adapter.log.debug(`KnownDevice before updating actions on it: ${JSON.stringify(knownDevices[device])}`);
            await createDeviceActions(adapter, device, actions);
        }
    }
};

/**
 * processes actions message for each device
 *
 * @param {object} adapter Link to the adapter instance
 * @param {string} device Name (mostly serial) of the current device in the device tree
 * @param {object} actions actions object as received from miele, but split into single devices
 * @returns Promise<void>
 */
async function createDeviceActions(adapter, device, actions) {
    await createChannelActions(adapter, device);
    knownDevices[device].actions = actions;
    try {
        switch (knownDevices[device].deviceType) {
            case 1: // 1 = WASHING MACHINE*
            case 2: // 2 = TUMBLE DRYER*
            case 24: // 24 = WASHER DRYER*
                // Actions
                await addPowerSwitch(adapter, device, !actions.powerOn);
                await addStartButton(adapter, device, true);
                await addStopButton(adapter, device, true);
                await addLightSwitch(adapter, device, actions.light.includes(mieleConst.LIGHT_OFF));
                await updateStateTargetTemperature(adapter, device, actions.targetTemperature);
                break;
            case 7: // 7 = DISHWASHER*
            case 8: // 8 = DISHWASHER SEMI-PROF
                // Actions
                await addPowerSwitch(adapter, device, !actions.powerOn);
                await addStartButton(adapter, device, true);
                await addStopButton(adapter, device, true);
                await addPauseButton(adapter, device, true);
                await addLightSwitch(adapter, device, actions.light.includes(mieleConst.LIGHT_OFF));
                break;
            case 12: // 12 = OVEN*
                // Actions
                await addStopButton(adapter, device, true);
                await addLightSwitch(adapter, device, actions.light.includes(mieleConst.LIGHT_OFF));
                await updateStateTargetTemperature(adapter, device, actions.targetTemperature);
                break;
            case 13: // 13 = OVEN Microwave*
            case 15: // 15 = STEAM OVEN*
            case 16: // 16 = MICROWAVE*
            case 31: // 31 = STEAM OVEN COMBINATION*
            case 45: // 45 = STEAM OVEN MICROWAVE COMBINATION*
            case 67: // 67 = DIALOG OVEN*
                // Actions
                await addPowerSwitch(adapter, device, !actions.powerOn);
                await addStopButton(adapter, device, true);
                await addLightSwitch(adapter, device, actions.light.includes(mieleConst.LIGHT_OFF));
                await updateStateTargetTemperature(adapter, device, actions.targetTemperature);
                break;
            case 14: // 14 = HOB HIGHLIGHT*
            case 27: // 27 = HOB INDUCTION*
                break;
            case 17: // 17 = COFFEE SYSTEM*
                // Actions
                await addPowerSwitch(adapter, device, !actions.powerOn);
                await addLightSwitch(adapter, device, actions.light.includes(mieleConst.LIGHT_OFF));
                break;
            case 18: // 18 = HOOD*
                // Actions
                await addPowerSwitch(adapter, device, !actions.powerOn);
                await addStopButton(adapter, device, true);
                await addLightSwitch(adapter, device, actions.light.includes(mieleConst.LIGHT_OFF));
                await addColorsAction(adapter, device);
                // colors
                break;
            case 19: // 19 = FRIDGE*
                // Actions
                await addSuperCoolingSwitch(
                    adapter,
                    device,
                    actions.processAction.includes(mieleConst.STOP_SUPERCOOLING),
                );
                await updateStateTargetTemperature(adapter, device, actions.targetTemperature);
                break;
            case 20: // 20 = FREEZER*
                // Actions
                await addSuperFreezingSwitch(
                    adapter,
                    device,
                    actions.processAction.includes(mieleConst.STOP_SUPERFREEZING),
                );
                await updateStateTargetTemperature(adapter, device, actions.targetTemperature);
                break;
            case 21: // 21 = FRIDGE-/FREEZER COMBINATION*
                // Actions
                await addSuperCoolingSwitch(
                    adapter,
                    device,
                    actions.processAction.includes(mieleConst.STOP_SUPERCOOLING),
                );
                await addSuperFreezingSwitch(
                    adapter,
                    device,
                    actions.processAction.includes(mieleConst.STOP_SUPERFREEZING),
                );
                await updateStateTargetTemperature(adapter, device, actions.targetTemperature);
                break;
            case 32: // 32 = WINE CABINET*
            case 33: // 33 = WINE CONDITIONING UNIT
            case 34: // 34 = WINE STORAGE CONDITIONING UNIT
                // Actions
                await addLightSwitch(adapter, device, actions.light.includes(mieleConst.LIGHT_OFF));
                await updateStateTargetTemperature(adapter, device, actions.targetTemperature);
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
                // Actions
                await addSuperFreezingSwitch(
                    adapter,
                    device,
                    actions.processAction.includes(mieleConst.STOP_SUPERFREEZING),
                );
                await addLightSwitch(adapter, device, actions.light.includes(mieleConst.LIGHT_OFF));
                await addModeSwitch(adapter, device);
                await updateStateTargetTemperature(adapter, device, actions.targetTemperature);
                break;
            case 23: // 23 = VACUUM CLEANER, AUTOMATIC ROBOTIC VACUUM CLEANER*
                // Actions
                await addProgramIdAction(adapter, device);
                await addStartButton(adapter, device, true);
                await addStopButton(adapter, device, true);
                await addPauseButton(adapter, device, true);
                break;
            case 25: // 25 = DISH WARMER*
                // Actions
                await addProgramIdAction(adapter, device);
                await updateStateTargetTemperature(adapter, device, actions.targetTemperature);
                break;
            case 48: // 48 = VACUUM DRAWER
                break;
        }
    } catch (err) {
        adapter.log.warn(`createDeviceActions: ${err}`);
    }
    adapter.subscribeStates(`${device}.ACTIONS.*`);
}

/**
 * Function addProgramIdAction
 *
 * Adds programId action switch to the device tree
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the action button is going to be created
 */
async function addProgramIdAction(adapter, path) {
    createOrExtendObject(
        adapter,
        `${path}.ACTIONS.programId`,
        {
            type: 'state',
            common: {
                name: 'Program Id - to select a program. Values depend on your device. See Miele docs.',
                read: true,
                write: true,
                role: 'switch',
                type: 'number',
            },
            native: {},
        },
        0,
    );
}

/**
 * Function addModeSwitch
 *
 * Adds a Modes switch to the device tree and subscribes for changes to it
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the action button is going to be created
 */
async function addModeSwitch(adapter, path) {
    createOrExtendObject(
        adapter,
        `${path}.ACTIONS.Mode`,
        {
            type: 'state',
            common: {
                name: 'Modes switch of the device',
                read: true,
                write: true,
                role: 'switch',
                type: 'number',
                states: { Normal: 0, Sabbath: 1 },
            },
            native: {},
        },
        0,
    );
}

/**
 * Function addSuperCoolingSwitch
 *
 * Adds a SuperCooling switch to the device tree and subscribes for changes to it
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the action button is going to be created
 * @param isSupercooling {boolean} indicates whether the device is currently supercooling
 */
async function addSuperCoolingSwitch(adapter, path, isSupercooling) {
    createOrExtendObject(
        adapter,
        `${path}.ACTIONS.SuperCooling`,
        {
            type: 'state',
            common: {
                name: 'SuperCooling switch of the device',
                read: true,
                write: true,
                role: 'switch',
                type: 'boolean',
            },
            native: {},
        },
        isSupercooling,
    );
}

/**
 * Function addSuperFreezingSwitch
 *
 * Adds a SuperFreezing switch to the device tree and subscribes for changes to it
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the action button is going to be created
 * @param isSuperFreezing {boolean} indicates whether the device is currently super freezing
 */
async function addSuperFreezingSwitch(adapter, path, isSuperFreezing) {
    createOrExtendObject(
        adapter,
        `${path}.ACTIONS.SuperFreezing`,
        {
            type: 'state',
            common: {
                name: 'SuperFreezing switch of the device',
                read: true,
                write: true,
                role: 'switch',
                type: 'boolean',
            },
            native: {},
        },
        isSuperFreezing,
    );
}

/**
 * Function addColorsAction
 *
 * Adds colors action switch to the device tree
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the action button is going to be created
 */
async function addColorsAction(adapter, path) {
    createOrExtendObject(
        adapter,
        `${path}.ACTIONS.Color`,
        {
            type: 'state',
            common: {
                name: 'select the ambient light color of your device',
                read: true,
                write: true,
                role: 'switch',
                type: 'string',
                states: {
                    white: 'white',
                    blue: 'blue',
                    red: 'red',
                    yellow: 'yellow',
                    orange: 'orange',
                    green: 'green',
                    pink: 'pink',
                    purple: 'purple',
                    turquoise: 'turquoise',
                },
            },
            native: {},
        },
        'white',
    );
}

/**
 * createChannelActions
 *
 * create the channel for Actions
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 */
async function createChannelActions(adapter, path) {
    createOrExtendObject(
        adapter,
        `${path}.ACTIONS`,
        {
            type: 'channel',
            common: {
                name: 'Available actions for this device',
                read: true,
                write: false,
                icon: 'icons/cog.svg',
                type: 'object',
            },
            native: {},
        },
        null,
    );
    createOrExtendObject(
        adapter,
        `${path}.ACTIONS.LastActionResult`,
        {
            type: 'state',
            common: {
                name: 'Additional information on the execution of the last action',
                read: true,
                write: false,
                icon: 'icons/info.svg',
                type: 'string',
            },
            native: {},
        },
        '',
    );
}

/**
 *
 * @param {object} adapter link to the adapter instance
 * @param {string} path path where the state should be created
 * @param {number} currentState current value of this state
 * @returns
 */
async function createVentilationStepSwitch(adapter, path, currentState) {
    await createRWState(
        adapter,
        `${path}.ACTIONS.VentilationStep`,
        'Ventilation step switch of the device',
        currentState,
        'number',
        'level',
        { 0: 'Off', 1: 'Level 1', 2: 'Level 2', 3: 'Level 3', 4: 'Level 4' },
    ).catch(error => {
        adapter.log.warn(`createVentilationStepSwitch: ${error}`);
    });
}

/**
 *
 * @param {object} adapter link to the adapter instance
 * @param {string} path path where the state should be created
 * @param {boolean} currentState current value of this state
 */
async function addPowerSwitch(adapter, path, currentState) {
    await createRWState(
        adapter,
        `${path}.ACTIONS.Power`,
        'Main power switch of the device',
        currentState,
        'boolean',
        'switch.power',
        '',
    ).catch(error => {
        adapter.log.warn(`addPowerSwitch: ${error}`);
    });
}

/**
 * Adds a start-button at the given path
 *
 * @param {object} adapter link to the adapter instance
 * @param {string} path path where the state should be created
 * @param {boolean} data current value of this state
 */
async function addStartButton(adapter, path, data) {
    createOrExtendObject(
        adapter,
        `${path}.ACTIONS.Start`,
        {
            type: 'state',
            common: {
                name: 'Starts the device if possible. Depends on prerequisites.',
                read: true,
                write: true,
                role: 'button',
                type: 'boolean',
            },
            native: { buttonType: 'button.start' },
        },
        data,
    );
}

/**
 * Adds a stop-button at the given path
 *
 * @param {object} adapter link to the adapter instance
 * @param {string} path path where the state should be created
 * @param {boolean} data current value of this state
 */
async function addStopButton(adapter, path, data) {
    createOrExtendObject(
        adapter,
        `${path}.ACTIONS.Stop`,
        {
            type: 'state',
            common: {
                name: 'Stops the device if possible. Depends on prerequisites.',
                read: true,
                write: true,
                role: 'button',
                type: 'boolean',
            },
            native: { buttonType: 'button.stop' },
        },
        data,
    );
}

/**
 * Adds a pause-button at the given path
 *
 * @param {object} adapter link to the adapter instance
 * @param {string} path path where the state should be created
 * @param {boolean} data current value of this state
 */
async function addPauseButton(adapter, path, data) {
    createOrExtendObject(
        adapter,
        `${path}.ACTIONS.Pause`,
        {
            type: 'state',
            common: {
                name: 'Pauses the device if possible. Depends on prerequisites.',
                read: true,
                write: true,
                role: 'button',
                type: 'boolean',
            },
            native: { buttonType: 'button.pause' },
        },
        data,
    );
}

/**
 * Adds a light-switch at the given path
 *
 * @param {object} adapter link to the adapter instance
 * @param {string} path path where the state should be created
 * @param {boolean} currentState current value of this state
 */
async function addLightSwitch(adapter, path, currentState) {
    await createRWState(
        adapter,
        `${path}.ACTIONS.Light`,
        'Light switch of the device',
        currentState,
        'boolean',
        'switch',
        {},
    ).catch(error => {
        adapter.log.warn(`addLightSwitch: ${error}`);
    });
}

/**
 * createChannelIdent
 *
 * create the channel for Ident-information
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 */
async function createChannelIdent(adapter, path) {
    createOrExtendObject(
        adapter,
        path,
        {
            type: 'channel',
            common: {
                name: 'Available ident information for this device',
                read: true,
                write: false,
                icon: 'icons/info.svg',
                type: 'object',
            },
            native: {},
        },
        null,
    );
}

/**
 * createChannelEcoFeedback
 *
 * create the channel for EcoFeedback-information
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 */
async function createChannelEcoFeedback(adapter, path) {
    createOrExtendObject(
        adapter,
        `${path}.EcoFeedback`,
        {
            type: 'channel',
            common: {
                name: 'EcoFeedback information available for this device',
                read: true,
                write: false,
                icon: 'icons/eco.svg',
                type: 'object',
            },
            native: {},
        },
        null,
    );
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
 */
async function createString(adapter, path, description, value) {
    await createROState(adapter, path, description, value, 'string', 'text').catch(error => {
        adapter.log.warn(`createString: ${error}`);
    });
}

/**
 * Function createROState
 *
 * Adds a read only state of various type to the device tree
 *
 * @param {object} adapter link to the adapter instance
 * @param {string} path  path where the data point is going to be created
 * @param {string} description description of the data point
 * @param {string} type valid type of this state
 * @param {string} role valid role of this state
 * @param {any} value value to set to the data point
 */
async function createROState(adapter, path, description, value, type, role) {
    try {
        createOrExtendObject(
            adapter,
            path,
            {
                type: 'state',
                common: { name: description, read: true, write: false, role: role, type: type },
                native: {},
            },
            value,
        );
    } catch (err) {
        adapter.log.warn(`createROState: ${err}`);
    }
}

/**
 * Function createRWState
 *
 * Adds a read/write state of various type to the device tree
 *
 * @param {object} adapter link to the adapter instance
 * @param {string} path  path where the data point is going to be created
 * @param {string} description description of the data point
 * @param {string} type valid type of this state
 * @param {string} role valid role of this state
 * @param {object} states valid states object for this switch
 * @param {any} value value to set to the data point
 */
async function createRWState(adapter, path, description, value, type, role, states) {
    try {
        const commonObj = {};
        commonObj.name = description;
        commonObj.read = true;
        commonObj.write = true;
        commonObj.role = role;
        commonObj.type = type;
        if (states) {
            commonObj.states = states;
        }
        createOrExtendObject(
            adapter,
            path,
            {
                type: 'state',
                common: commonObj,
                native: {},
            },
            value,
        );
    } catch (err) {
        adapter.log.error(`createRWState: ${err}`);
    }
}

/**
 * Function createNumber
 *
 * Adds a number-type data point to the device tree
 * Unit "Celsius" will be converted to "°C" and "Fahrenheit" to "°F"
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param description {string} description of the data point
 * @param value {number} value to set to the data point
 * @param unit {string} unit to set to the data point
 * @param role {string} role to set to the data point (default: text)
 */
async function createNumber(adapter, path, description, value, unit, role) {
    role = role || 'value';
    switch (unit) {
        case 'Celsius':
            unit = '°C';
            break;
        case 'Fahrenheit':
            unit = '°F';
            break;
    }
    createOrExtendObject(
        adapter,
        path,
        {
            type: 'state',
            common: { name: description, read: true, write: false, role: role, type: 'number', unit: unit },
            native: {},
        },
        value,
    );
}

/**
 * Function createTime
 *
 * Adds a time data point to the device tree by a given array containing [hours, minutes]
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param description {string} description of the data point
 * @param value {object} array value to set to the data point
 * @param role {string} role to set to the data point (default: text)
 */
async function createTime(adapter, path, description, value, role) {
    createOrExtendObject(
        adapter,
        path,
        {
            type: 'state',
            common: {
                name: description,
                read: true,
                write: path.split('.').pop() === 'startTime',
                role: role,
                type: 'string',
            },
            native: {},
        },
        `${value[0]}:${value[1] < 10 ? '0' : ''}${value[1]}`,
    );
}

/**
 * Function Create or extend object
 *
 * Updates an existing object (id) or creates it if not existing.
 * In case id and name are equal, it will only set it's new state
 *
 * @param {object} adapter link to the adapters instance
 * @param {string} id path/id of datapoint to create
 * @param {object} objData details to the datapoint to be created (Device, channel, state, ...)
 * @param {any} value value of the datapoint
 */
function createOrExtendObject(adapter, id, objData, value) {
    if (typeof value === 'undefined' || value === -32768 || value === null) {
        adapter.log.debug(`createOrExtendObject: no valid value (${value}) given for [${id}] - skipping...`);
        return;
    }
    adapter.getObject(id, function (err, oldObj) {
        if (!err && oldObj) {
            if (objData.common.name === oldObj.common.name) {
                adapter.setState(id, value, true);
            } else {
                adapter.extendObject(id, objData, () => {
                    adapter.setState(id, value, true);
                });
            }
        } else {
            adapter.setObjectNotExists(id, objData, () => {
                adapter.setState(id, value, true);
            });
        }
    });
}
