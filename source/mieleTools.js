'use strict';

// required files to load
const axios = require('axios');
const oauth = require('axios-oauth-client');
const mieleConst = require('../source/mieleConst.js');
const flatted = require('flatted');

const knownDevices = {icon:`icons/00_genericappliance.svg`}; // structure of _knownDevices{deviceId: {name:'', icon:'', deviceFolder:''}, ... }

/**
 * checkConfig
 *
 * tests the given adapter config whether it is valid
 *
 * @param {object} adapter link to the adapter instance
 * @param {object} config link to the adapters' configuration
 * @param {string} config.Client_ID Miele API client-ID of the user as given by Miele
 * @param {string} config.Client_secret Miele API client-secret of the user as given by Miele
 * @param {string} config.Miele_account Miele-account of the user like used in the Miele-APP usually his eMail
 * @param {string} config.Miele_pwd personal Miele-pwd of the user like used in the Miele-APP
 * @param {string} config.oauth2_vg Miele oauth2_vg of the user (country of miele account)
 * @param {string} config.locale    locale the API responds in
 * @returns {Promise<boolean>} true if config is valid. false if config is invalid
 */
module.exports.checkConfig = async function(adapter, config){
    return new Promise((resolve, reject) =>{
        let configIsValid = true;
        if ('' === config.Miele_account) {
            adapter.log.warn('Miele account is missing.');
            configIsValid = false;
        }
        if ('' === config.Miele_pwd) {
            adapter.log.warn('Miele password is missing.');
            configIsValid = false;
        }
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
        if ('' === config.oauth2_vg) {
            adapter.log.warn('OAuth2_vg is missing.');
            configIsValid = false;
        }
        if (configIsValid){
            resolve(configIsValid);
        }else{
            reject(configIsValid);
        }
    });
};


/**
 * Function APIGetAccessToken
 *
 * logs in into Miele Cloud API and requests an OAuth2 Access token
 *
 * @param {object} adapter link to the adapter instance
 * @param {object} config link to the adapters' configuration
 * @param {string} config.Client_ID Miele API client-ID of the user as given by Miele
 * @param {string} config.Client_secret Miele API client-secret of the user as given by Miele
 * @param {string} config.Miele_account Miele-account of the user like used in the Miele-APP usually his eMail
 * @param {string} config.Miele_pwd personal Miele-pwd of the user like used in the Miele-APP
 * @param {string} config.oauth2_vg Miele oauth2_vg of the user (country of miele account)
 * @param {string} config.locale    locale the API responds in
 * @param {number} iteration    count of API login attempts
 * @returns {Promise<any|string>} OAuth2 token
 */
module.exports.getAuth = async function(adapter, config , iteration){
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async(resolve, reject) => {
        adapter.log.info(`Login attempt #${iteration} @Miele-API`);
        // @ts-ignore
        const getOwnerCredentials = await oauth.client(axios.create(), {
            url: mieleConst.BASE_URL + mieleConst.ENDPOINT_TOKEN,
            grant_type: 'password',
            client_id: config.Client_ID,
            client_secret: config.Client_secret,
            username: config.Miele_account,
            password: config.Miele_pwd,
            vg: config.oauth2_vg
        });
        const auth = await getOwnerCredentials().catch((error) => {
            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                switch (error.response.status) {
                    case 401 : // unauthorized
                        adapter.log.error('Error: Unable to authenticate user! Your credentials seem to be invalid. Please double check and fix them.');
                        adapter.log.warn('Credentials used for login:');
                        adapter.log.warn(`options Miele_account: [${config.Miele_account}]`);
                        adapter.log.warn(`options Miele_Password: [${config.Miele_pwd}]`);
                        adapter.log.warn(`options Client_ID: [${config.Client_ID}]`);
                        adapter.log.warn(`options Client_Secret: [${config.Client_secret}]`);
                        adapter.log.warn(`options country: [${config.oauth2_vg}]`);
                        adapter.log.error('IMPORTANT!! Mask/Delete your credentials when posting your log online!');
                        reject(`Terminating adapter due to inability to authenticate.`);
                        break;
                    case 429: // endpoint currently not available
                        adapter.log.warn('Error: Endpoint: [' + mieleConst.BASE_URL + mieleConst.ENDPOINT_TOKEN + '] is currently not available.');
                        break;
                    default:
                        adapter.log.warn('[error.response.data]: ' + ((typeof error.response.data === 'object') ? '' : error.response.data));
                        adapter.log.warn('[error.response.status]: ' + ((typeof error.response.status === 'object') ? '' : error.response.status));
                        adapter.log.warn('[error.response.headers]: ' + ((typeof error.response.headers === 'object') ? '' : error.response.headers));
                        break;
                }
            } else if (error.request) {
                // The request was made but no response was received
                // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                // http.ClientRequest in node.js
                adapter.log.warn('[error.request]: ' + ((typeof error.request === 'object') ? 'The request was made but no response was received': error.request));
                adapter.log.warn(error);
            } else {
                // Something happened in setting up the request that triggered an Error
                adapter.log.warn(error.message);
            }
            if (error.response.status != 401){
                adapter.log.info(`Login attempt wasn't successful. Trying again to connect in ${mieleConst.RESTART_TIMEOUT} Seconds.`);
                setTimeout( ()=>{
                    exports.getAuth(adapter, config, iteration+1);
                }, 1000*mieleConst.RESTART_TIMEOUT);

            }
        });
        if (auth){
            auth.expiryDate = new Date();
            auth.expiryDate.setSeconds(auth.expires_in);
            adapter.log.debug(`Access token expires on: ${ auth.expiryDate.toLocaleString() }`);
            adapter.setState('info.connection', true, true);
            resolve (auth);
        }
    });
};


/**
 * sendAPIRequest
 *
 * build and send a http request to the miele server
 *
 * @param {object} adapter link to the adapter instance
 * @param {object} auth OAuth2 token object
 * @param {string} Endpoint the URI endpoint to call
 * @param {string} Method method to use for this request: POST or GET
 * @param {object} payload payload for this request
 *
 */
async function sendAPIRequest(adapter, auth, Endpoint, Method, payload){
    return new Promise((resolve, reject) => {
        // addressing sentry issues: MIELECLOUDSERVICE-2J, MIELECLOUDSERVICE-2K, MIELECLOUDSERVICE-7
        if (!auth || typeof auth === 'undefined' || Endpoint === '' || Method === '') {
            reject(`[sendAPIRequest] Aborting request due to: ${typeof auth === 'undefined'?'Missing auth token.':Endpoint === ''?'Missing endpoint.':'No method (GET/POST) given.'}`);
        }
        // build options object for axios
        const options = {
            headers: {
                Authorization: 'Bearer ' + auth.access_token,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            method: Method,
            data: payload,
            dataType: 'json',
            json: true,
            url: mieleConst.BASE_URL + Endpoint
        };
        // @ts-ignore
        axios(options)
            .then((response)=>{
                if ( Object.prototype.hasOwnProperty.call(response, 'data')) {
                    if (Object.prototype.hasOwnProperty.call(response.data, 'message')){
                        adapter.log.debug(`API returned Information: [${JSON.stringify(response.data.message)}]`);
                        resolve(response.data.message);
                    } else {
                        adapter.log.debug(`API returned Status: [${response.status}]`);
                        switch (response.status) {
                            case 202:
                                resolve({message:'Accepted, processing has not been completed.'});
                                break;
                            case 204: // OK, No Content
                                resolve({message:'OK, no content.'});
                                break;
                            default: resolve(response.data);
                        }
                    }
                }
            })
            .catch((error)=>{
                if (error.response) {
                    switch (error.response.status) {
                        case 400: {
                            const device = Endpoint.split('/', 3).pop();
                            adapter.log.info(`The API returned http-error 400: ${error.response.data.message} for device: [${device}].`);
                            reject(`The API returned http-error 400: ${error.response.data.message} for device: [${device}].`);
                        }
                            break;
                        case 401:
                            adapter.log.error('OAuth2 Access token has expired. This shouldn\'t ever happen.Please open an issue on github for that.');
                            reject('OAuth2 Access token has expired.');
                            break;
                        case 404:
                            adapter.log.info('Device/fabNumber is unknown. Disabling all actions.');
                            resolve( mieleConst.ALL_ACTIONS_DISABLED );
                            break;
                        case 500:
                            adapter.log.info('HTTP 500: Internal Server Error @Miele-API servers. There is nothing you can do but waiting if if solves itself or get in contact with Miele.');
                            reject('Error 500: Internal Server Error.');
                            break;
                        case 504:
                            adapter.log.info('HTTP 504: Gateway Timeout! This error occurred outside of this adapter. Please google it for possible reasons and solutions.');
                            reject('Error 504: Gateway timeout');
                            break;
                    }
                    // Request made and server responded
                    adapter.log.error(`Request made and server responded: ${JSON.stringify(error.response)}`);
                } else if (error.request) {
                    // The request was made but no response was received
                    adapter.log.error(`The request was made but no response was received: [${error}]`);
                    reject(error);
                } else {
                    // Something happened in setting up the request that triggered an Error
                    adapter.log.error(`Something happened in setting up the request that triggered an Error: [${error}]`);
                    reject(error);
                }
            });
    });
}


/**
 * Test whether the auth token is going to expire within the next 24 hours
 *
 * @param {object} auth the current auth token with all it's values
 * @param {string} auth.expiryDate the current expiry date of the token
 * @returns {boolean} Returns true if the token is going to expire within the next 24 hours - false if not.
 */
module.exports.authHasExpired = function (auth){
    const testValue = new Date();
    testValue.setSeconds( 24*3600 );
    return (Date.parse(auth.expiryDate)-Date.parse(testValue.toLocaleString())<= 0);
};


/**
 * refreshes the current access token when it is obout to expire
 *
 * @param {object} adapter link to the adapter instance
 * @param {object} config  link to the adapters' config
 * @param {object} auth    link to the auth object
 * @returns {Promise<object|object>} returns a refreshed auth object in case of success; error object if it fails
 */
module.exports.refreshAuthToken = async function(adapter, config, auth){
    adapter.log.info(`Your access token is going to expire within the next 24 hours. Trying to refresh it.`);
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                // Authorization: 'Bearer ' + auth.access_token,
                Accept: 'application/json;charset=utf-8',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            method: 'POST',
            data: `grant_type=refresh_token&client_id=${config.Client_ID}&client_secret=${config.Client_secret}&refresh_token=${auth.refresh_token}`,
            dataType: 'text/plain',
            url: mieleConst.BASE_URL + mieleConst.ENDPOINT_TOKEN
        };
        // @ts-ignore
        axios(options)
            .then((result)=>{
                result=JSON.parse(flatted.stringify(result));
                const data= result[result[0].data];
                const newAuth={};
                newAuth.access_token = result[data.access_token];
                newAuth.refresh_token = result[data.refresh_token];
                newAuth.token_type = result[data.token_type];
                newAuth.expires_in = data.expires_in;
                newAuth.expiryDate = new Date();
                newAuth.expiryDate.setSeconds(data.expires_in);
                adapter.log.debug(`NewAuth from server: ${JSON.stringify(newAuth)}`);
                adapter.log.info(`New Access-Token expires on: [${newAuth.expiryDate.toLocaleString()}]`);
                resolve(newAuth) ;
            })
            .catch((error) => {
                adapter.log.error(JSON.stringify(error));
                if (error.response) {
                    // The request was made and the server responded with a status code
                    // that falls out of the range of 2xx
                    switch (error.response.status) {
                        case 401 : // unauthorized
                            adapter.log.error('Error: Unable to authenticate user! Your credentials seem to be invalid. Please double check and fix them.');
                            reject(`Terminating adapter due to inability to authenticate.`);
                            break;
                        case 429: // endpoint currently not available
                            adapter.log.warn('Error: Endpoint: [' + mieleConst.BASE_URL + mieleConst.ENDPOINT_TOKEN + '] is currently not available.');
                            break;
                        default:
                            adapter.log.warn('[error.response.data]: ' + ((typeof error.response.data === 'object') ? '' : error.response.data));
                            adapter.log.warn('[error.response.status]: ' + ((typeof error.response.status === 'object') ? '' : error.response.status));
                            adapter.log.warn('[error.response.headers]: ' + ((typeof error.response.headers === 'object') ? '' : error.response.headers));
                            break;
                    }
                } else if (error.request) {
                    // The request was made but no response was received
                    // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                    // http.ClientRequest in node.js
                    adapter.log.warn('[error.request]: ' + ((typeof error.request === 'object') ? 'The request was made but no response was received': error.request));
                    adapter.log.warn(error);
                } else {
                    // Something happened in setting up the request that triggered an Error
                    adapter.log.warn(error.message);
                }
                adapter.log.info(`Refresh attempt wasn't successful. Trying again to refresh in ${mieleConst.RESTART_TIMEOUT} Seconds.`);
                setTimeout( ()=>{
                    exports.refreshAuthToken(adapter, config, auth);
                }, 1000*mieleConst.RESTART_TIMEOUT);
            });
    });
};


/**
 * Function APILogOff
 *
 * performs logoff action to the miele cloud API
 *
 * @param adapter {object} link to the adapter instance
 * @param auth {object} OAuth2 token object
 * @param token_type {string} the type of the token to invalidate
 *
 */
module.exports.APILogOff = async function(adapter, auth, token_type) {
    adapter.log.debug(`[APILogOff] Invalidating access tokens.`);
    sendAPIRequest(adapter, auth, mieleConst.ENDPOINT_LOGOUT, 'POST', {token: `${auth[token_type]}`} )
        .then((result)=>{
            return result;
        })
        .catch( (error) => {
            adapter.log.error('[APILogOff] ' + JSON.stringify(error) + ' Stack: '+error.stack);
            return error;
        });
};



/**
 * Function splitMieleDevices
 *
 * splits the json data received from cloud API into separate device
 *
 * @param {object} adapter Link to the adapter instance
 * @param {object} mieleDevices The whole JSON which needs to be split into devices
 * @param {object} mieleDevices.ident Indent Data of the device
 * @param {object} mieleDevices.ident.deviceIdentLabel The whole JSON which needs to be split into devices
 * @param {string} mieleDevices.ident.deviceIdentLabel.fabNumber SerialNumber of the device
 */
module.exports.splitMieleDevices = async function(adapter, mieleDevices){
    // Splits the data-package returned by the API into single devices and iterates over each single device
    for (const mieleDevice in mieleDevices) {
        adapter.log.debug('splitMieleDevices: ' + mieleDevice+ ': [' + mieleDevice + '] *** Value: [' + JSON.stringify(mieleDevices[mieleDevice]) + ']');
        if (mieleDevices[mieleDevice].ident.deviceIdentLabel.fabNumber === ''){
            adapter.log.debug('Device: [' + mieleDevice + '] has no serial number/fabNumber. Taking DeviceNumber instead.');
            mieleDevices[mieleDevice].ident.deviceIdentLabel.fabNumber = mieleDevice;
        }
        knownDevices[mieleDevices[mieleDevice].ident.deviceIdentLabel.fabNumber]={};
        knownDevices[mieleDevices[mieleDevice].ident.deviceIdentLabel.fabNumber].icon   =`icons/${mieleDevices[mieleDevice].ident.type.value_raw}.svg`;
        knownDevices[mieleDevices[mieleDevice].ident.deviceIdentLabel.fabNumber].API_ID = mieleDevice;
        knownDevices[mieleDevices[mieleDevice].ident.deviceIdentLabel.fabNumber].deviceType = mieleDevices[mieleDevice].ident.type.value_raw;
        if (mieleDevices[mieleDevice].ident.deviceName === '') {
            knownDevices[mieleDevices[mieleDevice].ident.deviceIdentLabel.fabNumber].name = mieleDevices[mieleDevice].ident.type.value_localized;
        } else {
            knownDevices[mieleDevices[mieleDevice].ident.deviceIdentLabel.fabNumber].name = mieleDevices[mieleDevice].ident.deviceName;
        }
        switch (mieleDevices[mieleDevice].ident.type.value_raw) {
            case 19: // 19 = FRIDGE*
            case 32: // 32 = WINE CABINET*
            case 33: // 33 = WINE CONDITIONING UNIT
            case 34: // 34 = WINE STORAGE CONDITIONING UNIT
                knownDevices[mieleDevices[mieleDevice].ident.deviceIdentLabel.fabNumber].fridgeZone = 1;
                break;
            case 20: // 20 = FREEZER*
                knownDevices[mieleDevices[mieleDevice].ident.deviceIdentLabel.fabNumber].freezerZone = 1;
                break;
            case 21: // 21 = FRIDGE-/FREEZER COMBINATION*
            case 68: // 68 = WINE CABINET FREEZER COMBINATION
                knownDevices[mieleDevices[mieleDevice].ident.deviceIdentLabel.fabNumber].fridgeZone = 1;
                knownDevices[mieleDevices[mieleDevice].ident.deviceIdentLabel.fabNumber].freezerZone = 2;
                break;
        }
        const obj = {
            type: 'device',
            common: {name: knownDevices[mieleDevices[mieleDevice].ident.deviceIdentLabel.fabNumber].name,
                read: true,
                write: false,
                icon: `icons/${mieleDevices[mieleDevice].ident.type.value_raw}.svg`,
                type: 'object'
            }
        };
        await createOrExtendObject(adapter, mieleDevices[mieleDevice].ident.deviceIdentLabel.fabNumber, obj, null);
        await createIdentTree(adapter, mieleDevices[mieleDevice].ident.deviceIdentLabel.fabNumber+'.IDENT', mieleDevices[mieleDevice].ident);
        await createStateTree(adapter, mieleDevices[mieleDevice].ident.deviceIdentLabel.fabNumber, mieleDevices[mieleDevice].state);

        //await addMieleDevice(mieleDevice);
        //await buildDeviceTree(adapter, mieleDevice, mieleDevices[mieleDevice]);
    }
};


/**
 * createIdentTree
 *
 * add selected ident data to the device tree
 *
 * @param {object} adapter link to the adapter instance
 * @param {string} path path where the data point is going to be created
 * @param {object} currentDeviceIdent ident data of the device
 */
async function createIdentTree(adapter, path, currentDeviceIdent){
    await createString(adapter, path + '.ComModFirmware',  'The release version of the communication module', currentDeviceIdent.xkmIdentLabel.releaseVersion);
    await createString(adapter, path + '.ComModTechType',  'The technical type of the communication module', currentDeviceIdent.xkmIdentLabel.techType);
    await createString(adapter, path + '.DeviceSerial',    'The serial number of the device', currentDeviceIdent.deviceIdentLabel.fabNumber);
    await createString(adapter, path + '.DeviceTechType',  'The technical type of the device', currentDeviceIdent.deviceIdentLabel.techType);
    await createString(adapter, path + '.DeviceType',      currentDeviceIdent.type.key_localized, currentDeviceIdent.type.value_localized);
    await createString(adapter, path + '.DeviceType_raw',  'Device type as number', currentDeviceIdent.type.value_raw);
    await createString(adapter, path + '.DeviceMatNumber', 'The material number of the device', currentDeviceIdent.deviceIdentLabel.matNumber);
}

/**
 * Function addMieleDeviceState
 *
 * adds the current miele device states to the device tree beneath its device type folder (channel) and device Id (device)
 *
 * @param {object} adapter link to the adapter instance
 * @param path {string} path where the device is to be created (aka deviceFolder)
 * @param currentDevice {object} the complete JSON for the current device
 * @param currentDeviceState {object} the JSON for a single device
 */
async function createStateTree(adapter, path, currentDevice, currentDeviceState){
    // create for ALL devices
    await createStateDeviceMainState(adapter,   `${path}.${currentDeviceState.status.key_localized}`, currentDeviceState.status.value_localized, currentDeviceState.status.value_raw);
    await createStateSignalFailure(adapter,  path, currentDeviceState.signalFailure);
    // set the values for self designed redundant state indicators
    await createStateConnected(adapter,  path, currentDeviceState.status.value_raw !== 255);
    await createStateSignalInUse(adapter,  path, currentDeviceState.status.value_raw !== 1);
    // nickname action is supported by all devices
    await createStateActionsInformation(adapter,  path, '');
    await addDeviceNicknameAction(adapter, path, currentDevice);

    // checkPermittedActions
    // const actions = await mieleAPITools.getPermittedActions(adapter, _auth,  _knownDevices[currentDevice.ident.deviceIdentLabel.fabNumber].API_Id );
    // programs
    // await addPrograms(adapter,  _auth, path, currentDevice.ident.deviceIdentLabel.fabNumber);

    try{
        // set/create device dependant states
        switch (currentDevice.ident.type.value_raw) {
            case 1 : // 1 = WASHING MACHINE*
                // setup ecoFeedback channel for this device if needed
                createChannelEcoFeedback(adapter, path) ;
                // states the device is known to support
                await createStateProgramID(adapter,  `${path}.${currentDeviceState.ProgramID.key_localized}`, currentDeviceState.ProgramID.value_localized, currentDeviceState.ProgramID.value_raw );
                await createStateProgramType(adapter,  `${path}.${currentDeviceState.programType.key_localized}`, currentDeviceState.programType.value_localized, currentDeviceState.programType.value_raw );
                await createStateProgramPhase(adapter,  `${path}.${currentDeviceState.programPhase.key_localized}`, currentDeviceState.programPhase.value_localized, currentDeviceState.programPhase.value_raw );
                await createStateRemainingTime(adapter,  path, currentDeviceState.remainingTime);
                await createStateStartTime(adapter,  path, currentDeviceState.startTime);
                await createStateSignalInfo(adapter,  path, currentDeviceState.signalInfo);
                await createStateFullRemoteControl(adapter,  path, currentDeviceState.remoteEnable.fullRemoteControl);
                await createStateSmartGrid(adapter,  path, currentDeviceState.remoteEnable.smartGrid);
                await createStateMobileStart(adapter,  path, currentDeviceState.remoteEnable.mobileStart);
                await createStateEstimatedEndTime(adapter,  path, currentDeviceState);
                await createStateElapsedTime(adapter,  path, currentDeviceState.elapsedTime);
                await createStateSpinningSpeed(adapter,  `${path}.${currentDeviceState.spinningSpeed.key_localized}`, currentDeviceState.spinningSpeed.value_localized, currentDeviceState.spinningSpeed.unit);
                await createStateEcoFeedbackEnergy(adapter,  path, currentDeviceState.ecoFeedback);
                await createStateEcoFeedbackWater(adapter,  path, currentDeviceState.ecoFeedback);
                await createStateTargetTemperature(adapter,  path, currentDeviceState.targetTemperature);
                // actions
                await addPowerSwitch(adapter, path, actions);
                await addStartButton(adapter,  path, Array(actions.processAction).includes(mieleConst.START));
                await addStopButton(adapter,  path, Array(actions.processAction).includes(mieleConst.STOP));
                await addLightSwitch(adapter, path, actions, currentDeviceState.light);
                break;
            case 2: // 2 = TUMBLE DRYER*
                // setup ecoFeedback channel for this device if needed
                createChannelEcoFeedback(adapter, path) ;
                // states
                await createStateProgramID(adapter,  `${path}.${currentDeviceState.ProgramID.key_localized}`, currentDeviceState.ProgramID.value_localized, currentDeviceState.ProgramID.value_raw );
                await createStateProgramType(adapter,  `${path}.${currentDeviceState.programType.key_localized}`, currentDeviceState.programType.value_localized, currentDeviceState.programType.value_raw );
                await createStateProgramPhase(adapter,  `${path}.${currentDeviceState.programPhase.key_localized}`, currentDeviceState.programPhase.value_localized, currentDeviceState.programPhase.value_raw );
                await createStateRemainingTime(adapter,  path, currentDeviceState.remainingTime);
                await createStateStartTime(adapter,  path, currentDeviceState.startTime);
                await createStateSignalInfo(adapter,  path, currentDeviceState.signalInfo);
                await createStateFullRemoteControl(adapter,  path, currentDeviceState.remoteEnable.fullRemoteControl);
                await createStateSmartGrid(adapter,  path, currentDeviceState.remoteEnable.smartGrid);
                await createStateMobileStart(adapter,  path, currentDeviceState.remoteEnable.mobileStart);
                await createStateEstimatedEndTime(adapter,  path, currentDeviceState);
                await createStateElapsedTime(adapter,  path, currentDeviceState.elapsedTime);
                await createStateDryingStep(adapter,  `${path}.${currentDeviceState.dryingStep.key_localized}`, currentDeviceState.dryingStep.value_localized, currentDeviceState.dryingStep.value_raw );
                await createStateEcoFeedbackEnergy(adapter,  path, currentDeviceState.ecoFeedback);
                await createStateTargetTemperature(adapter,  path, currentDeviceState.targetTemperature);
                // Actions
                await addPowerSwitch(adapter, path, actions);
                await addStartButton(adapter,  path, Array(actions.processAction).includes(mieleConst.START));
                await addStopButton(adapter,  path, Array(actions.processAction).includes(mieleConst.STOP));
                await addLightSwitch(adapter, path, actions, currentDeviceState.light);
                break;
            case 24: // 24 = WASHER DRYER*
                // setup ecoFeedback channel for this device if needed
                createChannelEcoFeedback(adapter, path);
                // states
                await createStateProgramID(adapter,  `${path}.${currentDeviceState.ProgramID.key_localized}`, currentDeviceState.ProgramID.value_localized, currentDeviceState.ProgramID.value_raw );
                await createStateProgramType(adapter,  `${path}.${currentDeviceState.programType.key_localized}`, currentDeviceState.programType.value_localized, currentDeviceState.programType.value_raw );
                await createStateProgramPhase(adapter,  `${path}.${currentDeviceState.programPhase.key_localized}`, currentDeviceState.programPhase.value_localized, currentDeviceState.programPhase.value_raw );
                await createStateRemainingTime(adapter,  path, currentDeviceState.remainingTime);
                await createStateStartTime(adapter,  path, currentDeviceState.startTime);
                await createStateSignalInfo(adapter,  path, currentDeviceState.signalInfo);
                await createStateFullRemoteControl(adapter,  path, currentDeviceState.remoteEnable.fullRemoteControl);
                await createStateSmartGrid(adapter,  path, currentDeviceState.remoteEnable.smartGrid);
                await createStateMobileStart(adapter,  path, currentDeviceState.remoteEnable.mobileStart);
                await createStateEstimatedEndTime(adapter,  path, currentDeviceState);
                await createStateElapsedTime(adapter,  path, currentDeviceState.elapsedTime);
                await createStateSpinningSpeed(adapter,  `${path}.${currentDeviceState.spinningSpeed.key_localized}`, currentDeviceState.spinningSpeed.value_localized, currentDeviceState.spinningSpeed.unit);
                await createStateDryingStep(adapter,  `${path}.${currentDeviceState.dryingStep.key_localized}`, currentDeviceState.dryingStep.value_localized, currentDeviceState.dryingStep.value_raw );
                await createStateEcoFeedbackEnergy(adapter,  path, currentDeviceState.ecoFeedback);
                await createStateEcoFeedbackWater(adapter,  path, currentDeviceState.ecoFeedback);
                await createStateTargetTemperature(adapter,  path, currentDeviceState.targetTemperature);
                // Actions
                await addPowerSwitch(adapter, path, actions);
                await addStartButton(adapter,  path, Array(actions.processAction).includes(mieleConst.START));
                await addStopButton(adapter,  path, Array(actions.processAction).includes(mieleConst.STOP));
                await addLightSwitch(adapter, path, actions, currentDeviceState.light);
                break;
            case 7: // 7 = DISHWASHER*
            case 8: // 8 = DISHWASHER SEMI-PROF
                // setup ecoFeedback channel for this device if needed
                createChannelEcoFeedback(adapter, path);
                // states
                await createStateProgramID(adapter,  `${path}.${currentDeviceState.ProgramID.key_localized}`, currentDeviceState.ProgramID.value_localized, currentDeviceState.ProgramID.value_raw );
                await createStateProgramType(adapter,  `${path}.${currentDeviceState.programType.key_localized}`, currentDeviceState.programType.value_localized, currentDeviceState.programType.value_raw );
                await createStateProgramPhase(adapter,  `${path}.${currentDeviceState.programPhase.key_localized}`, currentDeviceState.programPhase.value_localized, currentDeviceState.programPhase.value_raw );
                await createStateRemainingTime(adapter,  path, currentDeviceState.remainingTime);
                await createStateStartTime(adapter,  path, currentDeviceState.startTime);
                await createStateSignalInfo(adapter,  path, currentDeviceState.signalInfo);
                await createStateSignalDoor(adapter,  path, currentDeviceState.signalDoor);
                await createStateFullRemoteControl(adapter,  path, currentDeviceState.remoteEnable.fullRemoteControl);
                await createStateSmartGrid(adapter,  path, currentDeviceState.remoteEnable.smartGrid);
                await createStateMobileStart(adapter,  path, currentDeviceState.remoteEnable.mobileStart);
                await createStateEstimatedEndTime(adapter,  path, currentDeviceState);
                await createStateElapsedTime(adapter,  path, currentDeviceState.elapsedTime);
                await createStateEcoFeedbackEnergy(adapter,  path, currentDeviceState.ecoFeedback);
                await createStateEcoFeedbackWater(adapter,  path, currentDeviceState.ecoFeedback);
                // Actions
                await addPowerSwitch(adapter, path, actions);
                await addStartButton(adapter,  path, Array(actions.processAction).includes(mieleConst.START));
                await addStopButton(adapter,  path, Array(actions.processAction).includes(mieleConst.STOP));
                await addPauseButton(adapter,  path, Array(actions.processAction).includes(mieleConst.PAUSE));
                await addLightSwitch(adapter, path, actions, currentDeviceState.light);
                break;
            case 12: // 12 = OVEN*
                await createStateProgramID(adapter,  `${path}.${currentDeviceState.ProgramID.key_localized}`, currentDeviceState.ProgramID.value_localized, currentDeviceState.ProgramID.value_raw );
                await createStateProgramType(adapter,  `${path}.${currentDeviceState.programType.key_localized}`, currentDeviceState.programType.value_localized, currentDeviceState.programType.value_raw );
                await createStateProgramPhase(adapter,  `${path}.${currentDeviceState.programPhase.key_localized}`, currentDeviceState.programPhase.value_localized, currentDeviceState.programPhase.value_raw );
                await createStateRemainingTime(adapter,  path, currentDeviceState.remainingTime);
                await createStateStartTime(adapter,  path, currentDeviceState.startTime);
                await createStateSignalInfo(adapter,  path, currentDeviceState.signalInfo);
                await createStateSignalDoor(adapter,  path, currentDeviceState.signalDoor);
                await createStateFullRemoteControl(adapter,  path, currentDeviceState.remoteEnable.fullRemoteControl);
                await createStateSmartGrid(adapter,  path, currentDeviceState.remoteEnable.smartGrid);
                await createStateMobileStart(adapter,  path, currentDeviceState.remoteEnable.mobileStart);
                await createStateEstimatedEndTime(adapter,  path, currentDeviceState);
                await createStateElapsedTime(adapter,  path, currentDeviceState.elapsedTime);
                await createStateTemperature(adapter,  path, currentDeviceState.temperature);
                await createStateTargetTemperature(adapter,  path, currentDeviceState.targetTemperature);
                // Actions
                await addStopButton(adapter,  path, Array(actions.processAction).includes(mieleConst.STOP));
                await addLightSwitch(adapter, path, actions, currentDeviceState.light);
                break;
            case 13: // 13 = OVEN Microwave*
            case 15: // 15 = STEAM OVEN*
            case 16: // 16 = MICROWAVE*
            case 31: // 31 = STEAM OVEN COMBINATION*
            case 45: // 45 = STEAM OVEN MICROWAVE COMBINATION*
            case 67: // 67 = DIALOG OVEN*
                await createStateProgramID(adapter,  `${path}.${currentDeviceState.ProgramID.key_localized}`, currentDeviceState.ProgramID.value_localized, currentDeviceState.ProgramID.value_raw );
                await createStateProgramType(adapter,  `${path}.${currentDeviceState.programType.key_localized}`, currentDeviceState.programType.value_localized, currentDeviceState.programType.value_raw );
                await createStateProgramPhase(adapter,  `${path}.${currentDeviceState.programPhase.key_localized}`, currentDeviceState.programPhase.value_localized, currentDeviceState.programPhase.value_raw );
                await createStateRemainingTime(adapter,  path, currentDeviceState.remainingTime);
                await createStateStartTime(adapter,  path, currentDeviceState.startTime);
                await createStateSignalInfo(adapter,  path, currentDeviceState.signalInfo);
                await createStateSignalDoor(adapter,  path, currentDeviceState.signalDoor);
                await createStateFullRemoteControl(adapter,  path, currentDeviceState.remoteEnable.fullRemoteControl);
                await createStateSmartGrid(adapter,  path, currentDeviceState.remoteEnable.smartGrid);
                await createStateMobileStart(adapter,  path, currentDeviceState.remoteEnable.mobileStart);
                await createStateEstimatedEndTime(adapter,  path, currentDeviceState);
                await createStateElapsedTime(adapter,  path, currentDeviceState.elapsedTime);
                await createStateTemperature(adapter,  path, currentDeviceState.temperature);
                await createStateTargetTemperature(adapter,  path, currentDeviceState.targetTemperature);
                // Actions
                await addPowerSwitch(adapter, path, actions);
                await addLightSwitch(adapter, path, actions, currentDeviceState.light);
                await addStopButton(adapter,  path, Array(actions.processAction).includes(mieleConst.STOP));
                break;
            case 14: // 14 = HOB HIGHLIGHT*
            case 27: // 27 = HOB INDUCTION*
                await createStatePlateStep(adapter,  path, currentDeviceState.plateStep);
                break;
            case 17: // 17 = COFFEE SYSTEM*
                await createStateProgramID(adapter,  `${path}.${currentDeviceState.ProgramID.key_localized}`, currentDeviceState.ProgramID.value_localized, currentDeviceState.ProgramID.value_raw );
                await createStateProgramPhase(adapter,  `${path}.${currentDeviceState.programPhase.key_localized}`, currentDeviceState.programPhase.value_localized, currentDeviceState.programPhase.value_raw );
                await createStateSignalInfo(adapter,  path, currentDeviceState.signalInfo);
                await createStateFullRemoteControl(adapter,  path, currentDeviceState.remoteEnable.fullRemoteControl);
                await createStateSmartGrid(adapter,  path, currentDeviceState.remoteEnable.smartGrid);
                await createStateMobileStart(adapter,  path, currentDeviceState.remoteEnable.mobileStart);
                // Actions
                await addPowerSwitch(adapter, path, actions);
                await addLightSwitch(adapter, path, actions, currentDeviceState.light);
                break;
            case 18: // 18 = HOOD*
                // States
                await createStateSignalInfo(adapter,  path, currentDeviceState.signalInfo);
                await createStateFullRemoteControl(adapter,  path, currentDeviceState.remoteEnable.fullRemoteControl);
                await createStateSmartGrid(adapter,  path, currentDeviceState.remoteEnable.smartGrid);
                await createStateMobileStart(adapter,  path, currentDeviceState.remoteEnable.mobileStart);
                await createStateVentilationStep(adapter,  path, currentDeviceState.ventilationStep.value_raw);
                // Actions
                await addPowerSwitch(adapter, path, actions);
                await addLightSwitch(adapter, path, actions, currentDeviceState.light);
                await addStopButton(adapter,  path, Array(actions.processAction).includes(mieleConst.STOP));
                await addVentilationStepSwitch(adapter,  path);
                await addColorsAction(adapter,  path);
                // colors
                break;
            case 19: // 19 = FRIDGE*
                await createStateSignalInfo(adapter,  path, currentDeviceState.signalInfo);
                await createStateSignalDoor(adapter,  path, currentDeviceState.signalDoor);
                await createStateFullRemoteControl(adapter,  path, currentDeviceState.remoteEnable.fullRemoteControl);
                await createStateSmartGrid(adapter,  path, currentDeviceState.remoteEnable.smartGrid);
                await createStateMobileStart(adapter,  path, currentDeviceState.remoteEnable.mobileStart);
                await createStateTemperature(adapter,  path, currentDeviceState.temperature);
                await createStateTargetTemperatureFridge(adapter,  path, currentDeviceState.targetTemperature[0].value_localized, actions.targetTemperature[0].min, actions.targetTemperature[0].max, currentDeviceState.targetTemperature[0].unit);
                // Actions
                await addSuperCoolingSwitch(adapter,  path, actions);
                break;
            case 20: // 20 = FREEZER*
                await createStateSignalInfo(adapter,  path, currentDeviceState.signalInfo);
                await createStateSignalDoor(adapter,  path, currentDeviceState.signalDoor);
                await createStateFullRemoteControl(adapter,  path, currentDeviceState.remoteEnable.fullRemoteControl);
                await createStateSmartGrid(adapter,  path, currentDeviceState.remoteEnable.smartGrid);
                await createStateMobileStart(adapter,  path, currentDeviceState.remoteEnable.mobileStart);
                await createStateTemperature(adapter,  path, currentDeviceState.temperature);
                await createStateTargetTemperatureFreezer(adapter,  path, currentDeviceState.targetTemperature[0].value_localized, actions.targetTemperature[0].min, actions.targetTemperature[0].max, currentDeviceState.targetTemperature[0].unit);
                // Actions
                await addSuperFreezingSwitch(adapter,  path, actions);
                break;
            case 21: // 21 = FRIDGE-/FREEZER COMBINATION*
                await createStateSignalInfo(adapter,  path, currentDeviceState.signalInfo);
                await createStateSignalDoor(adapter,  path, currentDeviceState.signalDoor);
                await createStateFullRemoteControl(adapter,  path, currentDeviceState.remoteEnable.fullRemoteControl);
                await createStateSmartGrid(adapter,  path, currentDeviceState.remoteEnable.smartGrid);
                await createStateMobileStart(adapter,  path, currentDeviceState.remoteEnable.mobileStart);
                await createStateTemperature(adapter,  path, currentDeviceState.temperature);
                await createStateTargetTemperatureFridge(adapter,  path, currentDeviceState.targetTemperature[0].value_localized, actions.targetTemperature[0].min, actions.targetTemperature[0].max, currentDeviceState.targetTemperature[0].unit);
                await createStateTargetTemperatureFreezer(adapter,  path, currentDeviceState.targetTemperature[1].value_localized, actions.targetTemperature[1].min, actions.targetTemperature[1].max, currentDeviceState.targetTemperature[1].unit);
                // Actions
                await addSuperCoolingSwitch(adapter,  path, actions);
                await addSuperFreezingSwitch(adapter,  path, actions);
                break;
            case 32: // 32 = WINE CABINET*
            case 33: // 33 = WINE CONDITIONING UNIT
            case 34: // 34 = WINE STORAGE CONDITIONING UNIT
                await createStateSignalInfo(adapter,  path, currentDeviceState.signalInfo);
                await createStateSignalDoor(adapter,  path, currentDeviceState.signalDoor);
                await createStateFullRemoteControl(adapter,  path, currentDeviceState.remoteEnable.fullRemoteControl);
                await createStateSmartGrid(adapter,  path, currentDeviceState.remoteEnable.smartGrid);
                await createStateMobileStart(adapter,  path, currentDeviceState.remoteEnable.mobileStart);
                await createStateTemperature(adapter,  path, currentDeviceState.temperature);
                await createStateTargetTemperatureFridge(adapter,  path, currentDeviceState.targetTemperature[0].value_localized, actions.targetTemperature[0].min, actions.targetTemperature[0].max, currentDeviceState.targetTemperature[0].unit);
                // Actions
                await addLightSwitch(adapter, path, actions, currentDeviceState.light);
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
                await createStateSignalInfo(adapter,  path, currentDeviceState.signalInfo);
                await createStateFullRemoteControl(adapter,  path, currentDeviceState.remoteEnable.fullRemoteControl);
                await createStateSmartGrid(adapter,  path, currentDeviceState.remoteEnable.smartGrid);
                await createStateMobileStart(adapter,  path, currentDeviceState.remoteEnable.mobileStart);
                await createStateTemperature(adapter,  path, currentDeviceState.temperature);
                await createStateTargetTemperatureFridge(adapter,  path, currentDeviceState.targetTemperature[0].value_localized, actions.targetTemperature[0].min, actions.targetTemperature[0].max, currentDeviceState.targetTemperature[0].unit);
                await createStateTargetTemperatureFreezer(adapter,  path, currentDeviceState.targetTemperature[1].value_localized, actions.targetTemperature[1].min, actions.targetTemperature[1].max, currentDeviceState.targetTemperature[1].unit);
                // Actions
                await addSuperFreezingSwitch(adapter,  path, actions);
                await addLightSwitch(adapter, path, actions, currentDeviceState.light);
                await addModeSwitch(adapter,  path, actions);
                break;
            case 23: // 23 = VACUUM CLEANER, AUTOMATIC ROBOTIC VACUUM CLEANER*
                await createStateBatteryLevel(adapter,  path, currentDeviceState.batteryLevel);
                // Actions
                await addProgramIdAction(adapter,  path, currentDeviceState.programId);
                await addStartButton(adapter,  path, Array(actions.processAction).includes(mieleConst.START));
                await addStopButton(adapter,  path, Array(actions.processAction).includes(mieleConst.STOP));
                await addPauseButton(adapter,  path, Array(actions.processAction).includes(mieleConst.PAUSE));
                break;
            case 25: // 25 = DISH WARMER*
                await createStateSignalInfo(adapter,  path, currentDeviceState.signalInfo);
                // Actions
                await addProgramIdAction(adapter,  path, currentDeviceState.programId);
                break;
            case 48: // 48 = VACUUM DRAWER
                break;
        }
    } catch(err){
        adapter.log.error('[addMieleDeviceState]: ' + err.message + ', Stacktrace: ' + err.stack);
    }
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
async function addDeviceNicknameAction(adapter, path, mieleDevice) {
    // addDeviceNicknameAction - suitable for each and every device
    await createRWState(adapter,path + '.Nickname', 'Nickname of your device. Can be edited in Miele APP or here!',  (mieleDevice.ident.deviceName === '' ? mieleDevice.ident.type.value_localized : mieleDevice.ident.deviceName),'string', 'text');
    adapter.subscribeStates(path + '.Nickname');
}

/**
 * createStateActionsInformation
 *
 * create the state that shows additional information to the result of executed actions
 *
 * @param adapter {object} link to the adapter instance
 * @param path {string} path where the data point is going to be created
 * @param value {string} value to set to the data point
 */
async function createStateActionsInformation(adapter, path, value){
    await createString( adapter,path + '.ACTIONS.Action_Information','Additional information to the result of executed actions.', value);
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
async function createStateDeviceMainState(adapter, path, value, value_raw){
    await createROState( adapter, path + '_raw', 'Main state of the Device (raw-value)', value_raw, 'number', 'value');
    await createString( adapter, path, 'Main state of the Device', value);
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
async function createStateSignalFailure(adapter, path, value){
    await createROState( adapter,path + '.signalFailure','Indicates whether a failure message is active for this Device.', value, 'boolean', 'indicator');
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
async function createStateSignalInUse(adapter, path, value){
    await createROState( adapter,path + '.signalInUse','Indicates whether the device is in use or switched off.',value, 'boolean', 'indicator.InUse');
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
async function createStateSignalInfo(adapter, path, value){
    await createROState( adapter,path + '.signalInfo','Indicates whether a notification is active for this Device.',value,'boolean', 'indicator');
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
async function createStateConnected(adapter, path, value){
    await createROState( adapter,path + '.Connected','Indicates whether the device is connected to WLAN or Gateway.',value,'boolean','indicator.reachable');
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
async function createString(adapter, path, description, value){
    await createROState(adapter, path, description, value, 'string', 'text');
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
async function createROState(adapter, path, description, value, type, role){
    if ( typeof value === 'undefined' ) return;
    createOrExtendObject(adapter, path, {
        type: 'state',
        common: {'name': description,
            'read':  true,
            'write': false,
            'role': role,
            'type': type
        }
    }, value);
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
 * @param {any} value value to set to the data point
 */
async function createRWState(adapter, path, description, value, type, role){
    if ( typeof value === 'undefined' ) return;
    createOrExtendObject(adapter, path, {
        type: 'state',
        common: {'name': description,
            'read':  true,
            'write': true,
            'role': role,
            'type': type
        }
    }, value);
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
    adapter.getObject(id, function (err, oldObj) {
        if (!err && oldObj) {
            if ( objData.name === oldObj.common.name ){
                adapter.setState(id, value, true);
            } else{
                adapter.extendObject(id, objData, () => {adapter.setState(id, value, true);});
            }
        } else {
            adapter.setObjectNotExists(id, objData, () => {adapter.setState(id, value, true);});
        }
    });
}