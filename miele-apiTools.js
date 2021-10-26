// @ts-nocheck
// jshint -W097
// jslint node: true
'use strict';

/**
 * Miele Cloud API-Functions
 *
 * This file contains all miele cloud API based functions
 *
 */

// required files to load
const axios = require('axios');
const oauth = require('axios-oauth-client');
const {stringify} = require('flatted');
const mieleConst = require('./miele-constants.js');
const mieleAPITools = require('./miele-apiTools.js');
const mieleTools = require('./miele-Tools.js');
const EventSource = require('eventsource');

/**
 * Function APIGetAccessToken
 *
 * logs in into Miele Cloud API and requests an OAuth2 Access token
 *
 * @param adapter {object} link to the adapter instance
 *
 * @returns {string} OAuth2 token
 */
module.exports.APIGetAccessToken = async function (adapter) {
    adapter.log.debug('function APIGetAccessToken');
    const getOwnerCredentials = await oauth.client(await axios.create(), {
        url: mieleConst.BASE_URL + mieleConst.ENDPOINT_TOKEN,
        grant_type: 'password',
        client_id: adapter.config.Client_ID,
        client_secret: adapter.config.Client_secret,
        username: adapter.config.Miele_account,
        password: adapter.config.Miele_pwd,
        vg: adapter.config.oauth2_vg
    });

    adapter.log.debug('Awaiting OAuth2 Token.');
    adapter.log.debug('OAuth2 grant_type: [password]');
    adapter.log.debug('options OAuth2-VG: [' + adapter.config.oauth2_vg + ']');
    adapter.log.debug('config API Language: [' + adapter.config.locale + ']');
    try {
        const auth = await getOwnerCredentials();
        adapter.expiryDate = new Date();
        adapter.expiryDate.setSeconds(adapter.expiryDate.getSeconds() + auth.hasOwnProperty('expires_in') ? auth.expires_in : 0);
        adapter.log.info('Access-Token expires at:  [' + adapter.expiryDate.toString() + ']');
        adapter.setState('info.connection', true, true);
        return auth;
    } catch (error) {
        adapter.log.error('OAuth2 returned an error during first login!');
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            switch (error.response.status) {
                case 401 : // unauthorized
                    adapter.log.error('Error: Unable to authenticate user! Your credentials seem to be invalid. Please double check and fix them.');
                    adapter.log.error('Credentials used for login:');
                    adapter.log.error(`options Miele_account: [${adapter.config.Miele_account}]`);
                    adapter.log.error(`options Miele_Password: [${adapter.config.Miele_pwd}]`);
                    adapter.log.error(`options Client_ID: [${adapter.config.Client_ID}]`);
                    adapter.log.error(`options Client_Secret: [${adapter.config.Client_secret}]`);
                    adapter.log.error(`options country: [${adapter.config.oauth2_vg}]`);
                    adapter.log.warn('IMPORTANT!! Mask/Delete your credentials when posting your log online!');
                    adapter.terminate('Terminating adapter due to inability to authenticate.', 11);
                    break;
                case 429: // endpoint currently not available
                    adapter.log.error('Error: Endpoint: [' + mieleConst.BASE_URL + mieleConst.ENDPOINT_TOKEN + '] is currently not available.');
                    break;
                default:
                    adapter.log.error('[error.response.data]: ' + ((typeof error.response.data === 'object') ? stringify(error.response.data) : error.response.data));
                    adapter.log.error('[error.response.status]: ' + ((typeof error.response.status === 'object') ? stringify(error.response.status) : error.response.status));
                    adapter.log.error('[error.response.headers]: ' + ((typeof error.response.headers === 'object') ? stringify(error.response.headers) : error.response.headers));
                    break;
            }
        } else if (error.request) {
            // The request was made but no response was received
            // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
            // http.ClientRequest in node.js
            adapter.log.error('[error.request]: ' + ((typeof error.request === 'object') ? stringify(error.request) : error.request));
        } else {
            // Something happened in setting up the request that triggered an Error
            adapter.log.error('[Error]: ' + error.message);
        }
        adapter.setState('info.connection', false, true);
    }
}



/**
 * Function APIRefreshToken
 *
 * refreshes an expired OAuth 2 access token
 *
 * @param adapter {object} link to the adapter instance
 * @param refresh_token {object} the prior requested refresh token
 *
 * @returns OAuth2 token
 */
async function APIRefreshToken(adapter, refresh_token) {
    adapter.log.debug('function APIGetAccessToken');
    const getNewAccessToken = oauth.client(axios.create(), {
        url: mieleConst.BASE_URL + mieleConst.ENDPOINT_TOKEN,
        grant_type: 'refresh_token',
        client_id: adapter.config.Client_ID,
        client_secret: adapter.config.Client_secret,
        refresh_token: refresh_token,
        vg: adapter.config.oauth2_vg
    });

    adapter.log.debug('Awaiting new OAuth2 Token.');
    adapter.log.debug('OAuth2 grant_type: [refresh_token]');
    adapter.log.debug('options OAuth2-VG: [' + adapter.config.oauth2_vg + ']');
    adapter.log.debug('config API Language: [' + adapter.config.locale + ']');
    try {
        const auth = await getNewAccessToken();
        adapter.expiryDate = new Date();
        adapter.expiryDate.setSeconds(adapter.expiryDate.getSeconds() +  auth.hasOwnProperty('expires_in')?auth.expires_in:0 );
        adapter.log.info('New Access-Token expires at:  [' + adapter.expiryDate.toString() + ']');
        adapter.setState('info.connection', true, true);
        return auth;
    }  catch (error){
        adapter.log.error('OAuth2 returned an error!');
        adapter.log.error(error);
        adapter.setState('info.connection', false, true);
        // TODO Think about an error-counter and terminating the adapter on too many errors
        // adapter.terminate('Terminating adapter due to error on token request.', 11);
    }
}



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
    adapter.log.debug(`[APILogOff]: Invalidating: tokenType: [${token_type}]/(${auth[token_type]})`);
    await APISendRequest(adapter, auth, mieleConst.ENDPOINT_LOGOUT, "POST", "token: "+ auth[token_type] )
        .catch( (error) => {
            adapter.log.error('[APILogOff] ' + JSON.stringify(error) + ' Stack: '+error.stack)
        });
}



/**
 * Function getPermittedActions
 *
 *
 *
 * @param adapter {object} link to the adapter instance
 * @param auth {object} OAuth2 token object
 * @param deviceId {string} the Id of the device the query is performed for
 *
 * @returns data {object} JSON structure with permitted actions for the given device in the current state
 */
module.exports.getPermittedActions = async function (adapter, auth, deviceId){
    return await APISendRequest(adapter, auth, `v1/devices/${deviceId}/actions`, 'GET', '');
}

/**
 * Function getAvailablePrograms
 *
 *
 *
 * @param adapter {object} link to the adapter instance
 * @param auth {object} OAuth2 token object
 * @param deviceId {string} the Id of the device the query is performed for
 *
 * @returns data {object} JSON structure with permitted actions for the given device in the current state
 */
module.exports.getAvailablePrograms = async function (adapter, auth, deviceId){
    return await APISendRequest(adapter, auth, `v1/devices/${deviceId}/programs`, 'GET', '');
}

/**
 * Function APIStartAction
 *
 * trigger the given action on the given device
 *
 * @param adapter {object} link to the adapter instance
 * @param auth {object} OAuth2 token object
 * @param path {string} the device path from the device tree
 * @param action {string} action to be started
 * @param value {string} the value of the action to set
 * @param setup {boolean} indicator whether the devices need to setup or only states are to be updated
 * @param knownDevices {object} Array of known devices with a reference from their serial to the API_Id
 *
 */
module.exports.APIStartAction = async function(adapter, auth, path, action, value, setup, knownDevices) {
    let currentAction;
    let paths = path.split('.');    // transform into array
    paths.pop();                    // remove last element of path
    let device = paths[2];          // device is the fourth element of the path array
    let currentPath = paths.join('.');         // join all elements back together
    let endpoint = '/actions'
    adapter.log.debug("APIStartAction: received Action: ["+action+"] with value: ["+value+"] for device ["+device+"] / path:["+currentPath+"]");
    switch (action) {
        case 'colors': currentAction = {'colors':value};
            break;
        case 'Light':
            if (Number.parseInt(value) === 0){
                adapter.log.warn('You cannot switch light to state "none". That\'s senseless.');
                adapter.setState(currentPath + '.Action_Information', 'You cannot switch light to state "none". That\'s senseless.', true);
                return;
            } else if (Number.parseInt(value) === mieleConst.LIGHT_ON){
                currentAction = {'light':mieleConst.LIGHT_ON};
            } else if (Number.parseInt(value) === mieleConst.LIGHT_OFF){
                currentAction = {'light':mieleConst.LIGHT_OFF};
            }
            break;
        case 'Mode':
            currentAction = {'modes':value};
            break;
        case 'Nickname': currentAction = {'deviceName':value};
            break;
        case 'Pause': currentAction = {'processAction':mieleConst.PAUSE};
            break;
        case 'Power':
            if (value === true || value === 'true') {
                currentAction = {'powerOn':true};
            } else if (value === false || value === 'false'){
                currentAction = {'powerOff':true};
            }
            break;
        case 'programId': currentAction = {'programId':value};
            break;
        case 'Start': currentAction = {'processAction':mieleConst.START};
            break;
        case 'startTime':
            currentAction = {'startTime':value.split(':')};
            break;
        case 'Stop': currentAction = {'processAction':mieleConst.STOP};
            break;
        case 'Supercooling':
            if (value === 'On'){
                currentAction = {'processAction':mieleConst.START_SUPERCOOLING};
            } else {
                currentAction = {'processAction':mieleConst.STOP_SUPERCOOLING};
            }
            break;
        case 'Superfreezing':
            if (value === 'On'){
                currentAction = {'processAction':mieleConst.START_SUPERFREEZING};
            } else {
                currentAction = {'processAction':mieleConst.STOP_SUPERFREEZING};
            }
            break;
        case 'targetTemperatureFridge':
            currentAction = {'targetTemperature':[{zone:knownDevices[device].fridgeZone, value:value}]};
            break;
        case 'targetTemperatureFreezer':
            currentAction = {'targetTemperature':[{zone:knownDevices[device].freezerZone, value:value}]};
            break;
        case 'VentilationStep':
            currentAction = {'ventilationStep':value};
            break;
        default: {
            // none of the known actions - so it should be a program
            endpoint = '/programs'
            adapter.log.debug(`getting PROGRAM-Object: ID: ${path}.`);
            const currentProg = await adapter.getObjectAsync(path);
            adapter.log.debug(`PROGRAM-Object: ID: ${path} value: ${JSON.stringify(currentProg)}`);
            if (currentProg.hasOwnProperty('native')){
                adapter.log.debug(`PROGRAM-Object: ID: ${path} value: ${JSON.stringify(currentProg.native)}`);
                if (currentProg.native.hasOwnProperty('progId')){
                    adapter.log.debug(`PROGRAM-Object: ID: ${path} value: ${JSON.stringify(currentProg.native.progId)}`);
                    currentAction = {'programId': currentProg.native.progId};
                }
            } else {
                adapter.log.info(`Program detection: This ${path} does not seem to be a program. Report it as bug if it is one.`);
                return;
            }
            // todo For programs with extended information like time this needs to be extended
            break;
        }
    }
    try {
        adapter.log.debug("APIStartAction: Executing Action: [" +JSON.stringify(currentAction) +"]");
        if (typeof currentAction === 'undefined'){
            adapter.log.warn('No action defined to execute. NOT executing hence this will cause an error.');
            return;
        }
        const result = await APISendRequest(adapter, auth, 'v1/devices/' +  knownDevices[device].API_Id + endpoint, 'PUT', currentAction);
        await mieleTools.createString(adapter, setup,currentPath + '.Action_Information', 'Additional Information returned from API.', action + ': ' + result);
        adapter.log.debug(`Result returned from Action(${action})-execution: [${JSON.stringify(result)}]`);
        await mieleAPITools.refreshMieleData(adapter, auth, device);
    } catch(err) {
        await mieleTools.createString(adapter, setup, currentPath + '.Action_Information', 'Additional Information returned from API.', err.hasOwnProperty('message')?err.message:err);
        adapter.log.error('[APIStartAction] ' + err.hasOwnProperty('message')?err.message:err);
    }
}



/**
 * refreshMieleData
 *
 * polls the miele cloud API to refresh the device data
 *
 * @param adapter {object} link to the adapter instance
 * @param auth {object}  OAuth2 object containing required credentials
 * @param {string} device the id of the device to refresh - if empty all devices will be queried
 */
module.exports.refreshMieleData = async function(adapter, auth, device){
    adapter.log.debug('refreshMieleData: get data from API');
    const endpoint = `v1/devices/${device===''?'':device+'/'}?language=${adapter.config.locale}`;
    try {
        const result = await APISendRequest(adapter, auth, endpoint, 'GET', '');
        adapter.log.debug('refreshMieleData: handover all devices data to splitMieleDevices');
        adapter.log.debug('refreshMieleData: data [' + JSON.stringify(result) + ']');
        return result;
    } catch(error) {
        adapter.log.error('[refreshMieleData] [' + error +'] |-> JSON.stringify(error):' + JSON.stringify(error));
    }
}



/**
 * APISendRequest
 *
 * trigger the given action on the given device
 *
 * @param adapter {object} link to the adapter instance
 * @param auth {object} OAuth2 token object
 * @param Endpoint {string} the URI endpoint to call
 * @param Method {string} method to use for this request: POST or GET
 * @param payload {string} payload for this request
 *
 */
async function APISendRequest(adapter, auth, Endpoint, Method, payload) {
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

    adapter.log.debug('APISendRequest: Awaiting requested data.');
    try {
        adapter.log.debug('axios options: [' +JSON.stringify(options) + ']');
        const response = await axios(options);
        adapter.log.debug('API returned Status: [' + response.status + ']');
        adapter.log.debug('API returned Information: [' +  (response.data.hasOwnProperty('message')? JSON.stringify(response.data.message) : JSON.stringify(response.data)) + ']');
        if ( response.hasOwnProperty('data')) {
            if (response.data.hasOwnProperty('message')){
                return response.data.message;
            } else {
                switch (response.status) {
                    case 202:
                        return  "Accepted, processing has not been completed.";
                    case 204: // OK, No Content
                        return "OK, no content.";
                    default: return  response.data;
                }
            }
        }
    } catch(error) {
        adapter.log.debug('Given parameters:');
        adapter.log.debug('Auth: [' + JSON.stringify(auth) + ']');
        adapter.log.debug('Endpoint: [' + Endpoint + ']');
        adapter.log.debug('Method: [' + Method + ']');
        adapter.log.debug('Payload: [' + JSON.stringify(payload) + ']');
        adapter.log.debug('[APISendRequest] ' + JSON.stringify(error) + ' | [Stack]: ' + error.stack);
        if (error.response) {
            switch (error.response.status) {
                case 400: {
                    const device = Endpoint.split('/', 3).pop();
                    adapter.log.info(`The API returned http-error 400: ${error.response.data.message} for device: [${device}].`);
                }
                    return;
                case 401:
                    try {
                        adapter.log.info('OAuth2 Access token has expired. Trying to refresh it.');
                        auth = APIRefreshToken(adapter, auth.refresh_token);
                    } catch (err) {
                        adapter.log.error('[APIRefreshToken] ' + JSON.stringify(err));
                    }
                    return 'Error 401: Authorization failed.';
                case 404:
                    adapter.log.info('Device/fabNumber is unknown. Disabling all actions.');
                    return( {"processAction":[],"light":[],"ambientLight":[],"startTime":[],"ventilationStep":[],"programId":[],"targetTemperature":[],"deviceName":false,"powerOn":false,"powerOff":false,"colors":[],"modes":[]} );
                case 500:
                    adapter.log.info('HTTP 500: Internal Server Error @Miele-API servers. There is nothing you can do but waiting if if solves itself or get in contact with Miele.');
                    return 'Error 500: Internal Server Error.';
                case 504:
                    adapter.log.info('HTTP 504: Gateway Timeout! This error occurred outside of this adapter. Please google it for possible reasons and solutions.');
                    return 'Error 504: Gateway timeout';
            }
            // Request made and server responded
            adapter.log.error('Request made and server responded:');
            adapter.log.error('Response.status:' + error.response.status);
            adapter.log.error('Response.data.message: ' + JSON.stringify(error.response.data.message));
            adapter.log.error('Response.headers: ' + JSON.stringify(error.response.headers));
            adapter.log.error('Response.data: ' + JSON.stringify(error.response.data));
        } else if (error.request) {
            // The request was made but no response was received
            adapter.log.error('The request was made but no response was received:');
            adapter.log.error(JSON.stringify(error.request));
        } else {
            // Something happened in setting up the request that triggered an Error
            adapter.log.error('Something happened in setting up the request that triggered an Error:');
            adapter.log.error(`Error: [${ error.hasOwnProperty(message) ? error.message : JSON.stringify(error) }]`);
        }
    }
}

/**
 *  Eventing
 The eventing of the Miele 3rd Party API is based on the concept of Server-Sent-Events (SSE).
 The API supports two event types:
 All Appliances events - If any of the connected appliances changes it state, an event will be sent.
 The All Appliances Events subscription will return the content of a GET /devices request.
 *
 * APIregisterForEvents
 *
 * @param {object} adapter
 * @param {object} auth
 * @param {string} auth.access_token
 * @constructor
 */
module.exports.APIregisterForEvents = function (adapter, auth){
/*
* All Appliances Events
* curl -H "Accept:text/event-stream" -H "Accept-Language: {{de-DE||en-GB}}" -H "Authorization: Bearer {{access_token}}" https://api.mcs3.miele.com/v1/devices/all/events
* */
    // build options object for axios


    const eventSourceInitDict  = { headers:
        { Authorization: 'Bearer ' + auth.access_token,
          'Accept' : 'text/event-stream',
          'Accept-Language' : adapter.config.locale }
    };
    return new EventSource(mieleConst.BASE_URL + 'v1/devices/all/events', eventSourceInitDict );
}
