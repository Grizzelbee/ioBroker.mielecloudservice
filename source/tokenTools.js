//@ts-check
'use strict';

/**
 * @typedef {import('./types.mieleCloudService').tokenSet} tokenSet
 * @typedef {import('./types.mieleCloudService').tokenMsg} tokenMsg
 */

// required files to load
const axios = require('axios').default;
const mieleConst = require('../source/mieleConst.js');
const tokenTools = require('../source/tokenTools.js');
const qs = require('querystring');
// Holds the in-flight refresh promise (if any). Using a shared promise instead of a
// boolean flag ensures that concurrent callers all await the SAME refresh result
// instead of racing each other with the same (soon to be invalidated) refresh_token.
let refreshPromise = null;
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
 * Validate the given tokenSet whether it seems okay
 *
 * @param {object} adapter
 * @param {tokenSet} tokenSet
 * @returns {Promise<void>}
 */
module.exports.validateTokenSet = async (adapter, tokenSet) => {
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
        if (tokenSet.access_token.length > 0 &&
            tokenSet.refresh_token.length > 0 &&
            tokenSet.obtained > 0 &&
            tokenSet.refresh_expires_in > 0 &&
            tokenSet.expires_in > 0
        ) {
            if (await tokenTools.refreshHasExpired(adapter, tokenSet)){
                throw new Error('Refresh token has expired. Please use the workflow in adapters admin-ui to generate a new one.');
            }
        }
    } else {
        // there is no tokenSet - build one on your own from adapters config
        throw new Error('There is no token set. Please use the workflow in adapters admin-ui to generate a new one.');
    }
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
    // NOTE: this condition was previously inverted - it returned an EXPIRED tokenSet
    // as "successful" and threw an error for a still VALID one. Fixed here.
    if (!(await tokenTools.tokenSetHasExpired(adapter, configTokenSet))) {
        adapter.log.debug(`Building tokenSet from adapter config finished successfully: ${JSON.stringify(configTokenSet)}`);
        return configTokenSet;
    } else {
        throw new Error('Unable to build token set from config - it has already expired.');
    }

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
                .post(mieleConst.ENDPOINT_TOKEN_NEW, data, options)
                .then(response => {
                    adapter.log.debug(`Got data from token request: ${JSON.stringify(response.data)}`);
                    response.data.obtained=new Date().getTime();
                    response.data.obtained_HR=new Date().toLocaleString();
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
    // Safety margin so a token that is about to expire within the next 5 minutes
    // is already treated as expired - avoids requests starting with a token that
    // expires mid-flight (latency / clock drift).
    const SAFETY_MARGIN_MS = 5 * 60 * 1000; // 5 minutes
    adapter.log.silly(`Time obtained: ${new Date(auth.obtained).toLocaleString()}`);
    adapter.log.debug(`Refresh Token expires on: ${new Date(auth.obtained + auth.refresh_expires_in * 1000).toLocaleString()}`);
    adapter.log.debug(`Access Token expires on: ${new Date(auth.obtained + auth.expires_in * 1000).toLocaleString()}`);
    const diffMs = new Date(auth.obtained + auth.expires_in * 1000).getTime() - new Date().getTime();
    return diffMs <= SAFETY_MARGIN_MS;
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
 * tests the whole given tokenSet whether it has expired; means it tests access AND refresh token
 *
 * @param {object} adapter
 * @param {tokenSet} tokenSet
 * @returns {Promise<boolean>}
 */
module.exports.tokenSetHasExpired = async function (adapter, tokenSet) {
    return await tokenTools.accessHasExpired(adapter, tokenSet) || await tokenTools.refreshHasExpired(adapter, tokenSet);
}

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
 * @param {object} adapter link to the adapters instance
 * @returns {Promise<tokenSet>}
 */
module.exports.getTokenSetObj = async function (adapter) {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
        await adapter.getObjectAsync(adapter.namespace)
            .then(async (tokenSet) => {
                if (tokenSet) {
                    try {
                        await tokenTools.validateTokenSet(adapter, tokenSet);
                        tokenSet = await tokenTools.decryptTokenSet(adapter, tokenSet);
                        if (await tokenTools.tokenSetHasExpired(adapter, tokenSet)) {
                            // Always await a result here - regardless of whether a refresh
                            // is already in progress. refreshTokenSetSynchronized() makes sure
                            // that concurrent callers share the SAME refresh request instead of
                            // firing multiple parallel refreshes with the same refresh_token
                            // (which would cause one of them to be rejected by the server due
                            // to refresh-token rotation) - and it guarantees this promise is
                            // always resolved or rejected, never left hanging.
                            await tokenTools.refreshTokenSetSynchronized(adapter, tokenSet)
                                .then(refreshedTokenSet => {
                                    adapter.log.debug(`All fine with this refreshed tokenSet: ${JSON.stringify(refreshedTokenSet)}`);
                                    resolve(refreshedTokenSet);
                                })
                                .catch(error => {
                                    adapter.log.error(`Unable to refreshTokenSet: ${JSON.stringify(error)}`);
                                    reject(error);
                                });
                        } else {
                            adapter.log.debug(`TokenSet is valid - so use it as it is.`);
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

/**
 * refreshes the current access token when it is about to expire
 *
 * @param {object} adapter link to the adapter instance
 * @param {tokenSet} tokenSet link to the auth object
 * @returns {Promise<tokenMsg>} returns a refreshed auth object in case of success; error object if it fails
 */
module.exports.refreshTokenSet = async function (adapter, tokenSet) {
    const CONFIG = adapter.config;
    adapter.log.info(`Your access token has expired. Trying to refresh it.`);

    const postData = qs.stringify({
        grant_type: 'refresh_token',
        refresh_token: tokenSet.refresh_token,
    });

    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': mieleConst.UserAgent,
        Authorization: `Basic ${Buffer.from(`${CONFIG.Client_ID}:${CONFIG.Client_secret}`, 'utf8').toString('base64')}`,
    };

    adapter.log.debug(`Doing axios request to refresh tokens: ${postData}`);
    try {
        const result = await axios.post(mieleConst.ENDPOINT_TOKEN_NEW, postData, { headers });
        adapter.log.debug(`Raw-Token refresh message from server: ${JSON.stringify(result.data)}`);

        const newToken = result.data;
        if (!newToken || typeof newToken !== 'object' || !newToken.access_token) {
            throw new Error('Invalid token response from server - missing access_token.');
        }

        // Some OAuth2 servers don't return a new refresh_token on every refresh call
        // (rotation is not guaranteed on every response). Previously this silently
        // overwrote a perfectly valid refresh_token with `undefined`, which then either
        // crashed persistTokenSetInTokenStore() or bricked the next refresh attempt
        // permanently since the OLD refresh_token had already been invalidated
        // server-side by this very call. Falling back to the previous refresh_token
        // (and refresh_expires_in) avoids losing it.
        if (!newToken.refresh_token) {
            adapter.log.debug('Refresh response contained no new refresh_token - keeping the previous one.');
            newToken.refresh_token = tokenSet.refresh_token;
        }
        if (!newToken.refresh_expires_in) {
            newToken.refresh_expires_in = tokenSet.refresh_expires_in;
        }

        // set obtained timestamps and persist
        newToken.obtained = Date.now();
        newToken.obtained_HR = new Date(newToken.obtained).toLocaleString();
        await tokenTools.persistTokenSetInTokenStore(adapter, newToken);
        adapter.log.debug(`NewAuth from server: ${JSON.stringify(newToken)}`);
        return newToken;
    } catch (error) {
        adapter.log.error(`Error refreshing access token: ${JSON.stringify(error.response ? error.response.data : error.message)}`);
        const status = error.response && error.response.status;
        if (status) {
            switch (status) {
                case 400:
                    throw new Error('Bad Request - refresh token invalid or malformed.');
                case 401:
                    throw new Error('Unauthorized - refresh token expired or client authentication failed.');
                case 429:
                    adapter.log.warn(`Endpoint: [${mieleConst.ENDPOINT_TOKEN_NEW}] is currently rate limited.`);
                    break;
                default:
                    adapter.log.warn(`Unexpected status ${status} when refreshing token.`);
            }
        }
        throw error;
    } finally {
        adapter.log.debug(`Finished RefreshTokenSet function.`);
    }
};

/**
 * Ensures only ONE token refresh is ever in flight at a time. Concurrent callers
 * (e.g. multiple onStateChange events firing close together, or SSE-init racing
 * with a state change, right around the moment the access token expires) all
 * receive the SAME promise and therefore the SAME result, instead of each firing
 * an independent refresh request with the same refresh_token - which previously
 * caused one of them to be rejected by the server (refresh-token rotation /
 * invalid_grant) after a seemingly random amount of runtime.
 *
 * @param {object} adapter link to the adapter instance
 * @param {tokenSet} tokenSet the current (expired) tokenSet
 * @returns {Promise<tokenMsg>}
 */
module.exports.refreshTokenSetSynchronized = async function (adapter, tokenSet) {
    if (refreshPromise) {
        adapter.log.debug('Refresh already in progress - waiting for it instead of starting a new one.');
        return refreshPromise;
    }
    refreshPromise = tokenTools.refreshTokenSet(adapter, tokenSet)
        .finally(() => {
            refreshPromise = null;
        });
    return refreshPromise;
};
