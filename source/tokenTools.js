//@ts-check
'use strict';

/**
 * @typedef {import('./types.mieleCloudService').tokenSet} tokenSet
 * @typedef {import('./types.mieleCloudService').tokenMsg} tokenMsg
 */

// required files to load
const axios = require('axios');
const mieleConst = require('../source/mieleConst.js');
const qs = require('querystring');
const tokenTools = require('../source/tokenTools.js');
const flatted = require('flatted');

/**
 * Decrypts the given token
 *
 * @param {object} adapter
 * @param {string} token
 * @returns {Promise<string>}
 */
async function decryptToken(adapter, token){
    if (token.startsWith('$/aes-192-')){
        token = adapter.decrypt(token);
    }
    return token;
}

/**
 * Validate the given tokenSet whether it seems okay
 *
 * @param {object} adapter
 * @param {tokenSet} tokenSet
 * @returns {Promise<void>}
 */
module.exports.validateTokenSet = async (adapter, tokenSet) => {
    adapter.log.debug(`Validating TokenSet: ${JSON.stringify(tokenSet)}`);
    if (
        'access_token' in tokenSet &&
        'refresh_token' in tokenSet &&
        'token_type' in tokenSet &&
        'expires_in' in tokenSet &&
        'refresh_expires_in' in tokenSet &&
        'obtained' in tokenSet
    ) {
        // there is a tokenSet in the token store, and it seems valid so far.
        // at least it has all necessary fields; Let's test whether it is fully valid
        adapter.log.debug(`At least - token fields are existing...`);
        if (tokenSet.access_token.length > 0 &&
            tokenSet.refresh_token.length > 0 &&
            tokenSet.obtained > 0 &&
            tokenSet.refresh_expires_in > 0 &&
            tokenSet.expires_in > 0
        ) {
            adapter.log.debug(`Token fields are filled with data...`);
            if (await tokenTools.refreshHasExpired(adapter, tokenSet)){
                throw new Error('Refresh token has expired. Please use the workflow in adapters admin-ui to generate a new one.');
            }
        }
    } else {
        // there is no tokenSet - build one on your own from adapters config
        throw new Error('There is no token set. Please use the workflow in adapters admin-ui to generate a new one.');
    }
    adapter.log.debug(`Validate finished successfully.`);
}

/**
 * Reads a tokenSet from the adapters config
 *
 * @param {object} adapter
 * @returns {Promise<tokenSet>}
 */
module.exports.getTokenSetFromConfig = async (adapter) => {
    adapter.log.debug(`Building new tokenSet from adapters config.`);
    const configTokenSet = await tokenTools.getEmptyTokenSet();
    configTokenSet.access_token = adapter.config.access_token;
    configTokenSet.expires_in = adapter.config.access_token_expiry;
    configTokenSet.refresh_token = adapter.config.refresh_token;
    configTokenSet.refresh_expires_in = adapter.config.refresh_token_expiry;
    configTokenSet.obtained = adapter.config.obtained;
    if (await tokenTools.tokenSetHasExpired(adapter, configTokenSet)) {
        adapter.log.debug(`Building tokenSet finished successfully: ${JSON.stringify(configTokenSet)}`);
        return configTokenSet;
    } else {
        throw new Error('Unable to build token set from config.');
    }

}

/**
 * decrypts a whole tokenSet
 *
 * @param {object} adapter
 * @param {tokenSet} tokenSet
 * @returns {Promise<tokenSet>}
 */
module.exports.decryptTokenSet = async (adapter, tokenSet) => {
    tokenSet.access_token = await decryptToken(adapter, tokenSet.access_token);
    tokenSet.refresh_token = await decryptToken(adapter, tokenSet.refresh_token);
    return tokenSet;
}

/**
 * tests the whole given tokenSet whether it has expired; means it tests access AND refresh token
 *
 * @param {object} adapter
 * @param {tokenSet} tokenSet
 * @returns {Promise<boolean>}
 */
module.exports.tokenSetHasExpired = async function (adapter, tokenSet) {
    const now = Date.now();
    const accessDiff = new Date(tokenSet.obtained + tokenSet.expires_in * 1000).getTime() - now;
    if (accessDiff <= 0){
        adapter.log.warn(`Access token has expired on ${new Date(tokenSet.obtained + tokenSet.expires_in * 1000).toLocaleString()} and needs to be refreshed.`);
    } else {
        adapter.log.info(`Access token is still valid until ${new Date(tokenSet.obtained + tokenSet.expires_in * 1000).toLocaleString()}`);
    }
    const refreshDiff = new Date(tokenSet.obtained + tokenSet.refresh_expires_in * 1000).getTime() - now;
    if (refreshDiff <= 0){
        adapter.log.warn(`Refresh token has expired on ${new Date(tokenSet.obtained + tokenSet.refresh_expires_in * 1000).toLocaleString()} and needs to be refreshed. Please use the Workflow in Admin-UI to refresh.`);
    } else {
        adapter.log.info(`Refresh token is still valid until ${new Date(tokenSet.obtained + tokenSet.refresh_expires_in * 1000).toLocaleString()}`);
    }
    adapter.log.debug(`tokenSetHasExpired: result: ${(accessDiff <= 0) && (refreshDiff <= 0)}`);
    return (accessDiff <= 0) || (refreshDiff <= 0);
}

/**
 * Clears the token store of the current adapter instance
 *
 * @param {object} adapter link to the adapter instance
 * @returns {Promise<void>}
 */
module.exports.clearTokenStore = async function (adapter) {
    adapter.log.info(`Clearing token store ...`);
    await adapter.getObjectAsync(adapter.namespace)
        .then(async tokenSet=>{
            if (tokenSet) {
                tokenSet = tokenTools.getEmptyTokenSet();
                await adapter.extendObject(adapter.namespace, tokenSet)
                    .then(() => {
                        adapter.log.info(`Token store cleared.`);
                    })
                    .catch(err => {
                        adapter.log.error(`Unable to clear token store: ${err}`);
                    });
            } else {
                adapter.log.warn(`Unable to get token store - it's empty.`);
            }
        })
        .catch((err)=>{
            adapter.log.error(`Unable to get token store: ${err}`);
        })
}

/**
 * getAccessToken
 *
 * requests an OAuth2 Access token for the admin-ui workflow
 *
 * @param adapter {object} link to the adapter instance
 * @param clientId {string} Miele API client-ID of the user as given by Miele
 * @param clientSecret {string} Miele API client-secret of the user as given by Miele
 * @param Code {string} the code received from the auth request
 * @param redirectURI {string} the redirect URI used in the auth request
 * @returns {Promise<tokenMsg>} OAuth2 token
 */
module.exports.getAccessToken = async function (adapter, clientId, clientSecret, Code, redirectURI) {
    return new Promise((resolve, reject) => {
        try {
            const data = qs.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code: Code,
                grant_type: mieleConst.GRANT_TYPE,
                redirect_uri: redirectURI,
            });

            const options = {
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': mieleConst.UserAgent,
                },
            };

            axios
                // @ts-expect-error - axios.post() is not callable
                .post(mieleConst.ENDPOINT_AUTHTOKEN, data, options)
                .then(response => {
                    adapter.log.debug(`Got data from token request: ${JSON.stringify(response.data)}`);
                    resolve(response.data);
                })
                .catch(error => {
                    adapter.log.error(JSON.stringify(error.response ? error.response.data : error));
                    reject(error);
                });
        } catch (error) {
            adapter.log.error(JSON.stringify(error));
            reject(error);
        }
    });
};

/**
 * Test whether the access token has already expired
 *
 * @param {object} adapter link to the adapter instance
 * @param {tokenSet} auth the current auth token with all it's values
 * @returns {Promise<boolean>} Returns true if the token is going to expire within the next 5 Minutes - false if not.
 */
module.exports.accessHasExpired = async function (adapter, auth) {
    adapter.log.silly(`Time obtained: ${new Date(auth.obtained).toLocaleString()}`);
    adapter.log.debug(`Refresh Token expires on: ${new Date(auth.obtained + auth.refresh_expires_in * 1000).toLocaleString()}`);
    adapter.log.debug(`Access Token expires on: ${new Date(auth.obtained + auth.expires_in * 1000).toLocaleString()}`);
    const diffSeconds = new Date(auth.obtained + auth.expires_in * 1000).getTime() - new Date().getTime();
    return diffSeconds <= 0; //5 * 60 * 1000; // = 5 minutes
};

/**
* Test whether the refresh token has already expired
*
* @param {object} adapter link to the adapter instance
* @param {tokenSet} auth the current auth token with all it's values
* @returns {Promise<boolean>}Returns true if the token has expired
*/
module.exports.refreshHasExpired = async function (adapter, auth) {
    adapter.log.silly(`Time obtained: ${auth.obtained_HR}`);
    adapter.log.debug(
        `Refresh Token expires on: ${new Date(auth.obtained + auth.refresh_expires_in * 1000).toLocaleString()}`,
    );
    const diffSeconds = new Date(auth.obtained + auth.refresh_expires_in * 1000).getTime() - new Date().getTime();
    adapter.log.debug(`Refresh-Token has expired: ${diffSeconds <= 0}`);
    return diffSeconds <= 0; // = 0 seconds - has expired
};

/**
 * get an empty TokenSet
 *
 * returns an empty tokenSet object
 *
 * @returns {Promise<tokenMsg>}
 */
module.exports.getEmptyTokenSet = async function () {
    return {
        access_token: '',
        refresh_token: '',
        token_type: '',
        expires_in: 0,
        refresh_expires_in: 0,
        obtained: 0,
        ping: 0,
        id_token:``,
        obtained_HR:'',
    };
};


/**
 * Gets the token object from the adapters token store
 *
 *@param {object} adapter link to the adapters instance
 * @returns {Promise<tokenSet>}
 */
module.exports.getTokenSetObj = async function (adapter) {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
        adapter.getObjectAsync(adapter.namespace)
            .then(async (tokenSet) => {
                if (tokenSet) {
                    try {
                        await tokenTools.validateTokenSet(adapter, tokenSet);
                        tokenSet = await tokenTools.decryptTokenSet(adapter, tokenSet);
                        if (await tokenTools.tokenSetHasExpired(adapter, tokenSet)) {
                            await tokenTools.refreshTokenSet(adapter, tokenSet)
                                .then(tokenSet =>{
                                    adapter.log.debug(`All fine with this tokenSet: ${JSON.stringify(tokenSet)}`);
                                    // @ts-ignore
                                    resolve(tokenSet);
                                })
                                .catch(error => {
                                    adapter.log.error(`Unable to refreshTokenSet: ${JSON.stringify(error)}`);
                                    reject(error);
                                });
                        } else {
                            adapter.log.debug(`TokenSet is valid - so use is as it is.`);
                            resolve (tokenSet);
                        }
                    } catch (error) {
                        adapter.log.error(`Extracting tokenSet from token store failed. Building new from adapters configuration.`);
                        await tokenTools.getTokenSetFromConfig(adapter)
                            .then((configTokenSet) =>{
                                resolve(configTokenSet);
                            }).catch((err) => {
                                reject(`Building tokenSet from adapters config failed (1) with ${err}`);
                            })
                        }
                } else {
                    adapter.log.error(`Extracting tokenSet from token store failed. Building new from adapters configuration.`);
                    await tokenTools.getTokenSetFromConfig(adapter)
                        .then((configTokenSet) =>{
                            resolve(configTokenSet);
                        }).catch((err) => {
                            reject(`Building tokenSet from adapters config failed (2) with ${err}.`);
                        })
                }
            })
            .catch(async (err) => {
                //There is no tokenSet. Don't refresh but build a valid tokenSet from scratch if possible
                adapter.log.info(`There is no valid tokenSet. Building new from adapters configuration.`);
                const configTokenSet = await tokenTools.getTokenSetFromConfig(adapter);
                if (configTokenSet) {
                    resolve(configTokenSet);
                } else {
                    reject(`Building tokenSet from adapters config failed (3) with ${err}.`);
                }
            })
    })
}

/**
 * refreshes the current access token when it is about to expire
 *
 * @param {object} adapter link to the adapter instance
 * @param {tokenSet} tokenSet link to the auth object
 * @returns {Promise<tokenMsg>} returns a refreshed auth object in case of success; error object if it fails
 */
module.exports.refreshTokenSet = async function (adapter, tokenSet) {
    const config = adapter.config;
    adapter.log.info(
        `Your access token has expired. Trying to refresh it.`,
    );
    //adapter.log.debug(`Access token: ${auth.access_token}`);
    //adapter.log.debug(`Refresh token: ${auth.refresh_token}`);
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                Accept: 'application/json;charset=utf-8',
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': mieleConst.UserAgent,
            },
            method: 'POST',
            data: `grant_type=refresh_token&client_id=${config.Client_ID}&client_secret=${config.Client_secret}&refresh_token=${tokenSet.refresh_token}`,
            dataType: 'text/plain',
            url: mieleConst.ENDPOINT_AUTHTOKEN,
        };
        adapter.log.debug(`Doing axios request to refresh tokens: ${JSON.stringify(options)}`);
        //@ts-expect-error - axios.create() is not a function
        axios(options)
            .then(async result => {
                result = JSON.parse(flatted.stringify(result));
                adapter.log.silly(`Token refresh message from server: ${JSON.stringify(result)}`);
                const data = result[result[0].data];
                await tokenTools.persistTokenSetInTokenStore(adapter, data);
                /*
                const newAuth = await tokenTools.getEmptyTokenSet();
                newAuth.access_token = result[data.access_token];
                newAuth.refresh_token = result[data.refresh_token];
                newAuth.token_type = result[data.token_type];
                newAuth.expires_in = data.expires_in;
                newAuth.refresh_expires_in = data.refresh_expires_in;
                newAuth.obtained = data.obtained;
                newAuth.id_token = data.id_token;
                newAuth.ping = data.obtained;
                newAuth.obtained_HR = new Date(data.obtained).toLocaleString();
                // persist the new token
                adapter.extendObject(adapter.namespace, newAuth);
                 */
                adapter.log.debug(`NewAuth from server: ${JSON.stringify(data)}`);
                resolve(data);
            })
            .catch(error => {
                if ('status' in error) {
                    // The request was made, and the server responded with a status code
                    // that falls out of the range of 2xx
                    switch (error.status) {
                        case 400: // Bad request
                            reject(
                                `Bad Request - Your request was unacceptable, often due to missing or outdated refresh tokens.`,
                            );
                            break;
                        case 401: // unauthorized
                            reject(
                                `Unable to authenticate. Your refresh token seem to be outdated. Please refresh it using the adapters Admin-UI workflow .`,
                            );
                            break;
                        case 429: // endpoint currently not available
                            adapter.log.warn(
                                `Error: Endpoint: [${mieleConst.ENDPOINT_AUTHTOKEN}] is currently not available.`,
                            );
                            break;
                        default:
                            adapter.log.warn(
                                `[error.response.data]: ${typeof error.response.data === 'object' ? '' : error.response.data}`,
                            );
                            adapter.log.warn(
                                `[error.response.status]: ${typeof error.response.status === 'object' ? '' : error.response.status}`,
                            );
                            adapter.log.warn(
                                `[error.response.headers]: ${typeof error.response.headers === 'object' ? '' : error.response.headers}`,
                            );
                            break;
                    }
                } else {
                    // Something happened in setting up the request that triggered an Error
                    adapter.log.warn(
                        'An error occurred when trying to refresh the access token but dropped no valid error message.',
                    );
                    adapter.log.warn(error.message);
                    adapter.log.error(JSON.stringify(error));
                    reject(error);
                }
            });
    });
};

/**
 *  Persists the given TokenSet in the adapters tokenStore
 *
 * @param {object} adapter
 * @param {tokenMsg} tokenSet
 * @returns {Promise<void>}
 */
module.exports.persistTokenSetInTokenStore = async function (adapter, tokenSet) {
    adapter.log.info('Persisting tokens in adapters token store ...');
    adapter.log.silly(`Received tokenSet: ${JSON.stringify(tokenSet)}`);
    if (!tokenSet.access_token.startsWith('$/aes-192-')){
        tokenSet.access_token = adapter.encrypt(tokenSet.access_token);
    }
    if (!tokenSet.refresh_token.startsWith('$/aes-192-')){
        tokenSet.refresh_token = adapter.encrypt(tokenSet.refresh_token);
    }
    if ('id_token' in tokenSet) {
        if (!tokenSet.id_token.startsWith('$/aes-192-')){
            tokenSet.id_token = adapter.encrypt(tokenSet.id_token);
        }
    }
    tokenSet.obtained_HR = new Date(tokenSet.obtained).toLocaleString();
    await adapter.extendObject(adapter.namespace, tokenSet);
}
