'use strict';

// required files to load
const axios = require('axios');
const oauth = require('axios-oauth-client');
const mieleConst = require('../source/mieleConst.js');
// const events = require('eventsource');



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
            // adapter.setState('info.connection', false, true);
            adapter.log.info(`Login attempt wasn't successful. Trying again to connect in ${mieleConst.RESTART_TIMEOUT} Seconds.`);
            setTimeout( ()=>{
                exports.getAuth(adapter, config, iteration+1);
            }, 1000*mieleConst.RESTART_TIMEOUT);

        });
        if (auth){
            auth.expiryDate = new Date();
            auth.expiryDate.setSeconds(auth.expiryDate.getSeconds() + auth.expires_in);
            adapter.log.debug(`Access token expires on: ${ auth.expiryDate.toLocaleString() }`);
            adapter.setState('info.connection', true, true);
            resolve (auth);
        }
    });
};


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

    // addressing sentry issues: MIELECLOUDSERVICE-2J, MIELECLOUDSERVICE-2K, MIELECLOUDSERVICE-7
    if (!auth || typeof auth === 'undefined') {
        adapter.log.error(`There is no auth token for some unknown reason. Aborting request.`);
        return;
    }

    adapter.log.debug('APISendRequest: Awaiting requested data.');
    try {
        adapter.log.debug('axios options: [' +JSON.stringify(options) + ']');
        // @ts-ignore
        const response = await axios(options);
        adapter.log.debug('API returned Status: [' + response.status + ']');
        adapter.log.debug('API returned Information: [' +  ( Object(response.data).hasOwn('message')? JSON.stringify(response.data.message) : JSON.stringify(response.data)) + ']');
        if ( Object(response).hasOwn('data')) {
            if (Object(response.data).hasOwn('message')){
                return response.data.message;
            } else {
                switch (response.status) {
                    case 202:
                        return  'Accepted, processing has not been completed.';
                    case 204: // OK, No Content
                        return 'OK, no content.';
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
                        // auth = APIRefreshToken(adapter, auth.refresh_token);
                    } catch (err) {
                        adapter.log.error('[APIRefreshToken] ' + JSON.stringify(err));
                    }
                    return 'Error 401: Authorization failed. Seems like the token expired.';
                case 404:
                    adapter.log.info('Device/fabNumber is unknown. Disabling all actions.');
                    return( mieleConst.ALL_ACTIONS_DISABLED );
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
            adapter.log.error(error);
        } else {
            // Something happened in setting up the request that triggered an Error
            adapter.log.error('Something happened in setting up the request that triggered an Error:');
            adapter.log.error(`Error: [${error}]`);
        }
    }
}


/**
 * sendAPIRequest
 *
 * build and send a http request to the miele server
 *
 * @param {object} adapter link to the adapter instance
 * @param {object} auth OAuth2 token object
 * @param {string} Endpoint the URI endpoint to call
 * @param {string} Method method to use for this request: POST or GET
 * @param {string} payload payload for this request
 *
 */
async function sendAPIRequest(adapter, auth, Endpoint, Method, payload){
    return new Promise((resolve, reject) => {
        // addressing sentry issues: MIELECLOUDSERVICE-2J, MIELECLOUDSERVICE-2K, MIELECLOUDSERVICE-7
        if (!auth || typeof auth === 'undefined') {
            reject(`There is no auth token for some unknown reason. Aborting request.`);
        }
        if (Endpoint === '') {
            reject(`There is no endpoint given for this request. Aborting request.`);
        }
        if (Method === '') {
            reject(`There is no method (GET/POST) given for this request. Aborting request.`);
        }
    });
}


/**
 * Test whether the auth token is going to expire within the next 24 hours
 *
 * @param {object} auth the current auth token with all it's values
 * @param {number} auth.expiryDate the current expiry date of the token
 * @returns {boolean} Returns true if the token is going to expire within the next 24 hours - false if not.
 */
module.exports.authHasExpired = function (auth){
    const testValue = new Date();
    testValue.setSeconds( testValue.getSeconds()+24*3600 );
    return (new Date(auth.expiryDate).getSeconds()-testValue.getSeconds() <= 0);
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
                Authorization: 'Bearer ' + auth.access_token,
                Accept: 'application/json',
                'Content-Type': 'application/json; charset=utf-8'
            },
            method: 'POST',
            data: {
                grant_type : 'refresh_token',
                client_id : config.Client_ID,
                client_secret : config.Client_secret,
                refresh_token : auth.refresh_token
            },
            dataType: 'JSON',
            json: true,
            url: mieleConst.BASE_URL + mieleConst.ENDPOINT_TOKEN
        };
        // @ts-ignore
//        oauth.client(axios.create(), payload)
        axios(options)
            .then((result)=>{
                result.expiryDate = new Date();
                result.expiryDate.setSeconds(result.expiryDate.getSeconds() + result.expires_in );
                // @ts-ignore
                adapter.log.info(`New Access-Token expires on: [${Date(adapter.expiryDate).toLocaleString()}]`);
                resolve(result) ;
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
                            adapter.log.warn('Error: Endpoint: [' + mieleConst.BASE_URL + mieleConst.ENDPOINT_REFRESHTOKEN + '] is currently not available.');
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
                adapter.log.info(`Refresh attempt wasn't successful. Trying again to connect in ${mieleConst.RESTART_TIMEOUT} Seconds.`);
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
    await APISendRequest(adapter, auth, mieleConst.ENDPOINT_LOGOUT, 'POST', 'token: '+ auth[token_type] )
        .catch( (error) => {
            adapter.log.error('[APILogOff] ' + JSON.stringify(error) + ' Stack: '+error.stack);
        });
};


/**
 * Function Create or extend object
 *
 * Updates an existing object (id) or creates it if not existing.
 * In case id and name are equal, it will only set it's new state
 *
 * @param id {string} path/id of datapoint to create
 * @param objData {object} details to the datapoint to be created (Device, channel, state, ...)
 * @param value {any} value of the datapoint
 */
function createOrExtendObject(id, objData, value) {
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