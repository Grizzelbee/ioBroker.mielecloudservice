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

/**
 * Function APIGetAccessToken
 *
 * logs in into Miele Cloud API and requests an OAuth2 Access token
 *
 * @param adapter {object} link to the adapter instance
 *
 * @returns OAuth2 token
 */
module.exports.APIGetAccessToken = async function (adapter) {
    adapter.log.debug('function APIGetAccessToken');
    const getOwnerCredentials = oauth.client(axios.create(), {
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
        adapter.setState('info.connection', true);
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
        adapter.setState('info.connection', false);
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
        adapter.setState('info.connection', true);
        return auth;
    }  catch (error){
        adapter.log.error('OAuth2 returned an error!');
        adapter.log.error(error);
        adapter.setState('info.connection', false);
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
 * Function actionIsAllowedInCurrentState
 *
 * test whether a given action with a given actionState is permitted in the current state of the device
 *
 * @param adapter {object} link to the adapter instance
 * @param auth {object} OAuth2 token object
 * @param deviceId {string} the Id of the device the query is performed for
 * @param action {string} requested action to be tested
 * @param actionState {string} state of the action to be tested
 *
 *
 * @returns promise {promise}
 */
async function actionIsAllowedInCurrentState(adapter, auth, deviceId, action, actionState){
    return new Promise( (resolve, reject) => {
        // Test action
        APISendRequest(adapter, auth, `v1/devices/${deviceId}/actions`, 'GET', action)
            .then( (result) => {
                adapter.log.debug(`All action-states: [${JSON.stringify(result)}].`);
                if ( ( (typeof result[action] === 'boolean') && (result[action]) ) ) {
                    adapter.log.debug(`Action [${action}] is permitted in this device state.`);
                    resolve(true);
                } else if ( ( (typeof result[action] === 'object') && (result[action].length > 0) ) ) {
                    if ( Array.isArray(result[action]) ){
                        if ( result[action].includes(actionState) ){
                            adapter.log.debug(`Action [${action}] is permitted in this device state.`);
                            resolve(true);
                        } else {
                            reject(`Action [${action}] is not permitted in the current device state.` );
                        }
                    } else {
                        // it's an object not an array
                        adapter.log.debug(`Action-Object [${action}] seems to be permitted in this device state. Let's give it a try.`);
                        resolve(true);
                    }
                } else {
                    reject(`Action [${action}] is not permitted in the current device state.` );
                }
            })
            .catch( (error) => {
                reject('An error occurred during a cloud API request: ' + JSON.stringify(error) );
            });
    })
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
 *
 */
module.exports.APIStartAction = async function(adapter, auth, path, action, value, setup) {
    let currentAction;
    let paths = path.split('.');    // transform into array
    paths.pop();                    // remove last element of path
    let device = paths[3];          // device is the fourth element of the path array
    let currentPath = paths.join('.');         // join all elements back together
    adapter.log.debug("APIStartAction: received Action: ["+action+"] with value: ["+value+"] for device ["+device+"] / path:["+currentPath+"]");
    switch (action) {
        case 'Nickname': currentAction = {'deviceName':value};
            break;
        case 'Power':

            if (value == 'On'){
                currentAction = {'powerOn':true};
            } else {
                currentAction = {'powerOff':true};
            }

            break;
        case 'Power_On': currentAction = {'powerOn':true};
            break;
        case 'Power_Off': currentAction = {'powerOff':true};
            break;
        case 'Start': currentAction = {'processAction':mieleConst.START};
            break;
        case 'Stop': currentAction = {'processAction':mieleConst.STOP};
            break;
        case 'Pause': currentAction = {'processAction':mieleConst.PAUSE};
            break;
        case 'Start_Superfreezing': currentAction = {'processAction':mieleConst.START_SUPERFREEZING};
            break;
        case 'Stop_Superfreezing': currentAction = {'processAction':mieleConst.STOP_SUPERFREEZING};
            break;
        case 'Start_Supercooling': currentAction = {'processAction':mieleConst.START_SUPERCOOLING};
            break;
        case 'Stop_Supercooling': currentAction = {'processAction':mieleConst.STOP_SUPERCOOLING};
            break;
        case 'Light_On': currentAction = {'light':mieleConst.LIGHT_ON};
            break;
        case 'Light_Off': currentAction = {'light':mieleConst.LIGHT_OFF};
            break;
    }
    try {
        if ( await actionIsAllowedInCurrentState(adapter, auth, device, Object.keys(currentAction)[0], currentAction[Object.keys(currentAction)[0]]) ){
            adapter.log.debug("APIStartAction: Executing Action: [" +JSON.stringify(currentAction) +"]");
            const result = await APISendRequest(adapter, auth, 'v1/devices/' + device + '/actions', 'PUT', currentAction);
            await mieleTools.createString(adapter, setup,currentPath + '.Action_information', 'Additional Information returned from API.', action + ': ' + result.message);
            await mieleTools.createBool(adapter, setup, currentPath + '.Action_successful', 'Indicator whether last executed Action has been successful.', true, '');
            adapter.log.debug(`Result returned from Action(${action})-execution: [${JSON.stringify(result.message)}]`);
            await mieleAPITools.refreshMieleData(adapter, auth);
        }
    } catch(err) {
        await mieleTools.createBool(adapter, setup, currentPath + '.Action_successful', 'Indicator whether last executed Action has been successful.', false, '');
        await mieleTools.createString(adapter, setup, currentPath + '.Action_information', 'Additional Information returned from API.', JSON.stringify(err));
        adapter.log.error('[APISendRequest] ' + JSON.stringify(err));
    }
}



/**
 * refreshMieleData
 *
 * polls the miele cloud API to refresh the device data
 *
 * @param adapter {object} link to the adapter instance
 * @param auth {object}  OAuth2 object containing required credentials
 */
module.exports.refreshMieleData = async function(adapter, auth){
    // todo think about transforming this function into a promise
    /*
    may look like this:
    return APISendRequest(adapter, auth, 'v1/devices/?language=' + adapter.config.locale, 'GET', '');
     */

    adapter.log.debug('refreshMieleData: get data from API');
    try {
        const result = await APISendRequest(adapter, auth, 'v1/devices/?language=' + adapter.config.locale, 'GET', '');
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
        url: mieleConst.BASE_URL + Endpoint,
        method: Method,
        json: true,
        dataType: "json",
        headers: {
            Authorization: 'Bearer ' + auth.access_token,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        data: payload
    };

    function verifyData(verifiedData){
        return new Promise((resolve) => {
            switch (verifiedData.status) {
                case 202:
                    verifiedData.data =  {"message": "Accepted, processing has not been completed."};
                    break;
                case 204: // OK, No Content
                    verifiedData.data =  {"message": "OK"};
                    break;
            }
            resolve(verifiedData);
        })
    }

    adapter.log.debug('APISendRequest: Awaiting requested data.');
    try {
        const response = await axios(options);
        const verifiedData = await verifyData(response);
        adapter.log.debug('API returned Status: [' + verifiedData.status + ']');
        return verifiedData.data;
    } catch(error) {
        adapter.log.debug('Given parameters:');
        adapter.log.debug('Auth: [' + JSON.stringify(auth) + ']');
        adapter.log.debug('Endpoint: [' + Endpoint + ']');
        adapter.log.debug('Method: [' + Method + ']');
        adapter.log.debug('Actions: [' + JSON.stringify(actions) + ']');
        adapter.log.error('[APISendRequest] ' + JSON.stringify(error) + ' | [Stack]: ' + error.stack);
        if (error.response) {
            // Request made and server responded
            adapter.log.error('Request made and server responded:');
            adapter.log.error('Response.status:' + error.response.status);
            adapter.log.error('Response.headers: ' + JSON.stringify(error.response.headers));
            adapter.log.error('Response.data: ' + JSON.stringify(error.response.data));
        } else if (error.request) {
            // The request was made but no response was received
            adapter.log.error('The request was made but no response was received:');
            adapter.log.error(JSON.stringify(error.request));
        } else {
            // Something happened in setting up the request that triggered an Error
            adapter.log.error('Something happened in setting up the request that triggered an Error:');
            adapter.log.error('Error', error.message);
        }
        switch (error.response.status) {
            case 401:
                try {
                    adapter.log.info('OAuth2 Access token has expired. Trying to refresh it.');
                    auth = APIRefreshToken(adapter, auth.refresh_token);
                } catch (err) {
                    adapter.log.error('[APIRefreshToken] ' + JSON.stringify(err));
                }
                break;
            case 504:
                adapter.log.error('HTTP 504: Gateway Timeout! This error occurred outside of this adapter. Please google it for possible reasons and solutions.');
                break;
        }
    }
}



