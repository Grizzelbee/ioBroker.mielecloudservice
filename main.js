'use strict';

/*
 * Created with @iobroker/create-adapter v2.1.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const { EventSource } = require('eventsource');
const mieleTools = require('./source/mieleTools.js');
const mieleConst = require('./source/mieleConst');
const timeouts = {};
const fakeRequests = false; // this switch is used to fake requests against the Miele API and load the JSON-objects from disk
let events;
let connectionErrorHandlingInProgress = false;

// Load your modules here, e.g.:
class Mielecloudservice extends utils.Adapter {
    /**
     * @param [options] {object} link to the adapter instance
     */
    constructor(options) {
        super({
            ...options,
            name: 'mielecloudservice',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
        this._tokenSet = {};
    }

    async updateTokenSetForAdapter(tokenSet) {
        this.log.info('Updating tokens in adapter configuration ...');
        tokenSet.access_token = this.encrypt(tokenSet.access_token);
        tokenSet.refresh_token = this.encrypt(tokenSet.refresh_token);
        tokenSet.obtained = new Date().getTime();
        this.extendObject(this.namespace, tokenSet);
    }

    /**
     *
     * @param {ioBroker.Message} msg A message received from config frontend
     * @returns {Promise<any>}
     */
    async onMessage(msg) {
        this.log.debug(`Received message: ${JSON.stringify(msg)}`);
        if (typeof msg === 'object' && msg.message) {
            if (msg.command === 'send') {
                // e.g. send email or pushover or whatever
                this.log.info('send command');
                // Send response in callback if required
                if (msg.callback) {
                    this.sendTo(msg.from, msg.command, 'Message received', msg.callback);
                }
            }
            switch (msg.command) {
                case 'OAuthStepA': {
                    const args = msg.message;
                    this.log.debug(`Received OAuth start message: ${JSON.stringify(args)}`);
                    if (!args || !args.clientId || !args.clientSecret || !args.redirectUriBase) {
                        this.sendTo(
                            msg.from,
                            msg.command,
                            {
                                result: null,
                                error: 'Invalid arguments',
                            },
                            msg.callback,
                        );
                        return;
                    }
                    if (!args.redirectUriBase.endsWith('/')) {
                        args.redirectUriBase += '/';
                    }
                    args.redirectUriBase = `${args.redirectUriBase}oauth2_callbacks/${this.namespace}/`;
                    this.log.debug(`Get OAuth start link data: ${JSON.stringify(args)}`);
                    const state = await mieleTools.generateRandomString(16);
                    const authUrl = `${mieleConst.ENDPOINT_AUTH}?client_id=${encodeURIComponent(
                        args.clientId,
                    )}&redirect_uri=${encodeURIComponent(args.redirectUriBase)}&response_type=${
                        mieleConst.RESPONSE_TYPE
                    }&scope=${encodeURIComponent(
                        `${mieleConst.SCOPE_OPENID} ${mieleConst.SCOPE_READ} ${mieleConst.SCOPE_WRITE} ${mieleConst.SCOPE_MEDIA}`,
                    )}&state=${state}`;
                    // save these data for further use
                    this._expectedAuthenticationState = state;
                    this._clientId = args.clientId;
                    this._clientSecret = args.clientSecret;
                    this._redirectUriBase = args.redirectUriBase;
                    msg.callback &&
                        this.sendTo(
                            msg.from,
                            msg.command,
                            {
                                openUrl: authUrl,
                                window: 'Request Miele Auth Code',
                                saveConfig: false,
                                reload: false,
                            },
                            msg.callback,
                        );

                    break;
                }
                case 'oauth2Callback':
                    {
                        const args = msg.message;
                        this.log.debug(`oauth2Callback: ${JSON.stringify(args)}`);
                        if (!args.state || !args.code) {
                            this.log.warn(`Error on OAuth callback: ${JSON.stringify(args)}`);
                            if (args.error) {
                                msg.callback &&
                                    this.sendTo(
                                        msg.from,
                                        msg.command,
                                        { error: `Miele Cloud error: ${args.error}. Please try again.` },
                                        msg.callback,
                                    );
                            } else {
                                msg.callback &&
                                    this.sendTo(
                                        msg.from,
                                        msg.command,
                                        {
                                            error: `Miele Cloud invalid response: ${JSON.stringify(args)}. Please try again.`,
                                        },
                                        msg.callback,
                                    );
                            }
                            return;
                        }
                        // Flow has received an access-code from Miele Cloud - now get the tokens
                        if (this._expectedAuthenticationState !== args.state) {
                            this.log.warn(
                                `Error on OAuth callback: Invalid state received: ${args.state} (expected: ${this._expectedAuthenticationState})`,
                            );
                            msg.callback &&
                                this.sendTo(
                                    msg.from,
                                    msg.command,
                                    { error: `Miele Cloud returned an invalid state. Please try again.` },
                                    msg.callback,
                                );
                            return;
                        }
                        mieleTools
                            .getAccessToken(this, this._clientId, this._clientSecret, args.code, this._redirectUriBase)
                            .then(newAuth => {
                                newAuth.obtained = new Date().getTime();
                                this.log.debug(`Token Message: ${newAuth}`);
                                msg.callback &&
                                    this.sendTo(
                                        msg.from,
                                        msg.command,
                                        { result: `Received an access_token. --> Success!` },
                                        msg.callback,
                                    );
                                this.updateTokenSetForAdapter(newAuth).catch(err => {
                                    this.log.error(`Error updating tokens in adapter config: ${err}`);
                                });
                                this.log.info(`Token expires in: ${newAuth.expires_in} seconds`);
                                this.log.info(`Token type: ${newAuth.token_type}`);
                                this.log.info(`Token scope: ${newAuth.scope}`);
                                // now continue as if adapter just started
                                this.onReady();
                            })
                            .catch(err => {
                                this.log.error(`Token request error: ${err}`);
                                msg.callback &&
                                    this.sendTo(
                                        msg.from,
                                        msg.command,
                                        { error: `Miele Cloud did not return an access_token. Please try again.` },
                                        msg.callback,
                                    );
                            });
                    }
                    break;
            }
            return false;
        }
    }

    /**
     * Requests and opens a new EventSource (SSE - Server-Sent-Events) Connection
     *
     * @param tokenSet
     * @returns the new EventSource connection
     */
    getEventSource(tokenSet) {
        const result = new EventSource(mieleConst.BASE_URL + mieleConst.ENDPOINT_EVENTS, {
            fetch: (input, init) =>
                fetch(input, {
                    ...init,
                    headers: {
                        Authorization: `${tokenSet.token_type} ${tokenSet.access_token}`,
                        Accept: 'text/event-stream',
                        'Accept-Language': this.config.locale,
                        'User-Agent': mieleConst.UserAgent,
                    }, //-> an option to test: , https:{rejectUnauthorized: false}
                }),
        });
        // @ts-expect-error Property 'sseErrors' does not exist on type 'EventSource'.
        result.sseErrors = 0;
        return result;
    }

    /**
     * does the SSE connection error handling in case an error is reported by the server
     *
     * @param adapter {object} link to the current adapter instance
     * @param events  {object} link to the current EventSource connection
     */
    doSSEErrorHandling(adapter, events) {
        if (connectionErrorHandlingInProgress) {
            adapter.log.info(`SSE connection error handling already in progress.`);
        } else {
            connectionErrorHandlingInProgress = true;
            try {
                switch (events.readyState) {
                    case 0:
                        {
                            // CONNECTING
                            adapter.log.info(
                                `SSE is trying to reconnect but it seems this won't work. So trying myself by closing and reinitializing.`,
                            );
                            events.close();
                            while (events.readyState === 0) {
                                const randomDelay =
                                    Math.pow(events.sseErrors, 2) * 1000 + Math.floor(Math.random() * 1000);
                                timeouts.getEvents = setTimeout(() => {
                                    adapter.initSSE();
                                    adapter.log.info(`Still trying to connect...`);
                                }, randomDelay);
                            }
                        }
                        break;
                    case 1: // OPEN
                        adapter.log.info(`SSE connection is still open or open again. Doing nothing.`);
                        break;
                    case 2: // CLOSED
                        adapter.log.info(`SSE connection has been closed. Trying to reinitialize.`);
                        adapter.initSSE();
                        break;
                    default:
                        adapter.log.warn(
                            `SSE readyState should be [0,1,2] but has an illegal state(${events.readyState}).`,
                        );
                        break;
                }
            } finally {
                connectionErrorHandlingInProgress = false;
            }
        }
    }

    /**
     * Initialize new EventSource and handle all occurring events
     *
     * @param tokenSet
     */
    initSSE(tokenSet) {
        // Initialize new EventSource
        events = this.getEventSource(tokenSet);

        /**
         * Handle message type 'open'.
         * It occurs when an SSE connection has been established
         */
        events.onopen = () => {
            this.log.info(
                `Server Sent Events-Connection has been ${events.sseErrors === 0 ? 'established' : 'reestablished'} @Miele-API.`,
            );
            this.setState('info.connection', true, true);
            events.sseErrors = 0;
        };

        /**
         * Handle message type 'device'.
         * It occurs when a device changes one of its states and on initialization
         */
        events.addEventListener(mieleConst.DEVICES, event => {
            this.log.debug(`Received DEVICES message by SSE: [${JSON.stringify(event.data)}]`);
            mieleTools.splitMieleDevices(this, tokenSet, JSON.parse(event.data)).catch(err => {
                this.log.warn(`splitMieleDevices crashed with error: [${err}]`);
            });
        });

        /**
         * Handle message type 'action'.
         * It occurs when a device changes its available actions and on initialization
         */
        events.addEventListener(mieleConst.ACTIONS, event => {
            this.log.debug(`Received ACTIONS message by SSE: [${JSON.stringify(event.data)}]`);
            mieleTools.splitMieleActionsMessage(this, JSON.parse(event.data)).catch(err => {
                this.log.warn(`splitMieleActionsMessage crashed with error: [${err}]`);
            });
        });

        /**
         * Handle message type 'ping'.
         * It occurs periodically (usually every five seconds).
         * It's used to feed the watchdog
         */
        events.addEventListener(mieleConst.PING, event => {
            this.log.debug(`Received PING message by SSE: ${JSON.stringify(event.data)}`);
            tokenSet.ping = new Date().getTime();
        });

        events.addEventListener(mieleConst.ENDPOINT_FILLINGLEVELS, event => {
            this.log.debug(`Received fillingLevels message by SSE: [${JSON.stringify(event.data)}]`);
        });

        events.addEventListener(mieleConst.ENDPOINT_FAILUREDETAILS, event => {
            this.log.debug(`Received failure details message by SSE: [${JSON.stringify(event.data)}]`);
        });
        events.addEventListener(mieleConst.ENDPOINT_ROOMS, event => {
            this.log.debug(`Received rooms message by SSE: [${JSON.stringify(event.data)}]`);
        });
        /**
         * Handle message type 'error'.
         * It occurs when the Miele-API detects an error
         */
        events.addEventListener(mieleConst.ERROR, event => {
            events.sseErrors++;
            this.setState('info.connection', false, true);
            this.log.debug(`Received error message by SSE: ${JSON.stringify(event)}`);
            const randomDelay = Math.pow(events.sseErrors, 2) * 1000 + Math.floor(Math.random() * 1000);
            if (Object.prototype.hasOwnProperty.call(timeouts, 'reconnectDelay')) {
                clearTimeout(timeouts.reconnectDelay);
            }
            this.log.warn(
                `An ${typeof event.message != 'undefined' ? `error (#${events.sseErrors}) occurred (${event.message})` : 'undefined error occurred'}. Handling it in ${randomDelay / 1000} seconds to give it a chance to solve itself.`,
            );
            timeouts.reconnectDelay = setTimeout(
                (adapter, events) => {
                    // @ts-expect-error Property 'reconnectInterval' does not exist on type 'Event'.
                    event.reconnectInterval = randomDelay;
                    this.doSSEErrorHandling(adapter, events);
                },
                randomDelay,
                this,
                events,
            );
        });
    }

    /**
     * Does time based data polling in case the SSE doesn't work properly
     * can be chosen in the adapters config
     *
     * @param adapter {object} link to the current adapter instance
     * @param auth    {object} link to the current authentication object
     */
    doDataPolling(adapter, auth) {
        timeouts.datapolling = setInterval(
            async function () {
                // getDeviceInfos
                const devices = await mieleTools.getMieleDevices(adapter, auth).catch(error => {
                    adapter.log.info(`Devices-Error: ${JSON.stringify(error)}`);
                });
                adapter.log.debug(`Devices as received from Miele: ${JSON.stringify(devices)}`);
                auth.ping = new Date();
                // processDeviceInfos
                mieleTools.splitMieleDevices(adapter, auth, devices).catch(err => {
                    adapter.log.warn(`splitMieleDevices crashed with error: [${err}]`);
                });
                // getFillingLevels
                const fillingLevels = await mieleTools.getMieleFillingLevels(adapter, auth).catch(error => {
                    adapter.log.info(`FillingLevels-Error: ${JSON.stringify(error)}`);
                });
                adapter.log.debug(`FillingLevels as received from Miele: ${JSON.stringify(fillingLevels)}`);
                timeouts.actionsDelay = setTimeout(async function () {
                    const knownDevices = mieleTools.getKnownDevices();
                    const keys = Object.keys(knownDevices);
                    adapter.log.debug(
                        keys.length === 0
                            ? `There are no known devices; No actions to query`
                            : `There are ${keys.length} known devices; querying actions for them.`,
                    );
                    for (let n = 0; n < keys.length; n++) {
                        // getActions
                        adapter.log.debug(`Querying device ${knownDevices[keys[n]].name}`);
                        const actions = await mieleTools
                            .getMieleActions(adapter, auth, knownDevices[keys[n]].API_ID)
                            .catch(error => {
                                adapter.log.info(`Actions-Error: ${JSON.stringify(error)}`);
                            });
                        adapter.log.debug(`Actions: ${JSON.stringify(actions)}`);
                        // processDeviceActions
                        mieleTools.splitMieleActionsMessage(adapter, actions).catch(err => {
                            adapter.log.warn(`splitMieleActionsMessage crashed with error: [${err}]`);
                        });

                        const fillingLevels = await mieleTools
                            .getMieleFillingLevels(adapter, auth, knownDevices[keys[n]].API_ID)
                            .catch(error => {
                                adapter.log.info(`FillingLevels-Error: ${JSON.stringify(error)}`);
                            });
                        adapter.log.debug(`Actions: ${JSON.stringify(fillingLevels)}`);

                        const failureDetails = await mieleTools
                            .getMieleFailureDetails(adapter, auth, knownDevices[keys[n]].API_ID)
                            .catch(error => {
                                adapter.log.info(`FailureDetails-Error: ${JSON.stringify(error)}`);
                            });
                        adapter.log.debug(`Actions: ${JSON.stringify(failureDetails)}`);

                        const rooms = await mieleTools
                            .getMieleRooms(adapter, auth, knownDevices[keys[n]].API_ID)
                            .catch(error => {
                                adapter.log.info(`Rooms-Error: ${JSON.stringify(error)}`);
                            });
                        adapter.log.debug(`Actions: ${JSON.stringify(rooms)}`);
                    }
                }, 1000);
            },
            adapter.config.pollInterval * adapter.config.pollUnit * 1000,
        );
    }

    /**
     * Gets the token object from the adapter configuration
     *
     * @typedef {object} tokenSet the token set to be used
     * @property {string} access_token  the access token
     * @property {string} refresh_token  the refresh token
     * @property {number} expires_in  the access token expiry time in seconds
     * @property {number} refresh_expires_in  the refresh token expiry time in seconds
     * @property {string} token_type  the token type (usually "Bearer")
     * @property {number} obtained  the timestamp when the tokens were obtained
     * @returns {Promise<object>}
     */
    async getTokenObj() {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
            let tokenSet = (await this.getObjectAsync(this.namespace)) || (await mieleTools.getEmptyTokenset());
            if (tokenSet) {
                if (
                    'access_token' in tokenSet &&
                    'refresh_token' in tokenSet &&
                    'token_type' in tokenSet &&
                    'expires_in' in tokenSet &&
                    'refresh_expires_in' in tokenSet &&
                    'obtained' in tokenSet
                ) {
                    // there is a tokenSet in the token store and it seems to be valid
                    if (
                        this.config.obtained > tokenSet.obtained ||
                        tokenSet.access_token === '' ||
                        tokenSet.refresh_token === ''
                    ) {
                        // the tokenSet in the config is newer than the one in the namespace or the tokens are empty
                        this.log.debug(
                            `Using tokenSet from adapter config since it's newer than the one in the tokenstore or the tokens are invalid.`,
                        );
                    } else if (await !mieleTools.authHasExpired(this, tokenSet)) {
                        this.log.debug(`Received valid tokenSet from token store.`);
                        if (tokenSet.access_token.startsWith('$/aes-192-')) {
                            tokenSet.access_token = this.decrypt(tokenSet.access_token);
                        }
                        if (tokenSet.refresh_token.startsWith('$/aes-192-')) {
                            tokenSet.refresh_token = this.decrypt(tokenSet.refresh_token);
                        }
                        this._tokenSet = tokenSet;
                        resolve(tokenSet);
                    } else {
                        this.log.debug(`Received valid tokenSet from token store that needs to be refreshed.`);
                        await mieleTools
                            .refreshAuthToken(this, this.config, tokenSet)
                            .then(newTokenSet => {
                                // token refresh successful
                                this.log.debug(`Successfully refreshed tokenSet (1): ${JSON.stringify(newTokenSet)}`);
                                if (newTokenSet.access_token.startsWith('$/aes-192-')) {
                                    newTokenSet.access_token = this.decrypt(newTokenSet.access_token);
                                }
                                if (newTokenSet.refresh_token.startsWith('$/aes-192-')) {
                                    newTokenSet.refresh_token = this.decrypt(newTokenSet.refresh_token);
                                }
                                this._tokenSet = newTokenSet;
                                resolve(newTokenSet);
                            })
                            .catch(err => {
                                this.log.error(`Please reauthenticate using the workflow in the admin config UI.`);
                                reject(err);
                            });
                    }
                }
            } else {
                // there is no or an invalid tokenSet in the token store
                this.log.debug(`No or empty tokenSet received from token store. Using config values.`);
                tokenSet.access_token = this.config.access_token;
                tokenSet.refresh_token = this.config.refresh_token;
                tokenSet.expires_in = this.config.access_token_expiry;
                tokenSet.refresh_expires_in = this.config.refresh_token_expiry;
                tokenSet.token_type = this.config.tokenType;
                tokenSet.obtained = this.config.obtained;
                if (mieleTools.authHasExpired(this, tokenSet)) {
                    if (mieleTools.refreshHasExpired(this, tokenSet)) {
                        reject('TokenSet from config has expired. Please reauthenticate in the adapters config UI.');
                    } else {
                        this.log.debug(`TokenSet from config needs to be refreshed.`);
                        tokenSet = await mieleTools.refreshAuthToken(this, this.config, tokenSet).catch(async err => {
                            this.log.error(`Error refreshing token: ${err}`);
                            reject(err);
                        });
                        // token refresh successful
                        this.log.debug(`Successfully refreshed tokenSet (2): ${JSON.stringify(tokenSet)}`);
                        if (tokenSet.access_token.startsWith('$/aes-192-')) {
                            tokenSet.access_token = this.decrypt(tokenSet.access_token);
                        }
                        if (tokenSet.refresh_token.startsWith('$/aes-192-')) {
                            tokenSet.refresh_token = this.decrypt(tokenSet.refresh_token);
                        }
                        this._tokenSet = tokenSet;
                        resolve(tokenSet);
                    }
                }
            }
        });
    }

    async clearTokenStore() {
        this.log.info(`Clearing token store ...`);
        this._tokenSet = {
            access_token: '',
            refresh_token: '',
            expires_in: 0,
            refresh_expires_in: 0,
            token_type: '',
            obtained: 0,
        };
        await this.extendObject(this.namespace, this._tokenSet);
        this.log.info(`Token store cleared.`);
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Reset the connection indicator during startup
        await this.setState('info.connection', false, true);
        // remember the link to the adapter instance
        if (fakeRequests) {
            const fs = require('fs');
            fs.readFile('test/testdata.devices.json', 'utf8', (err, data) => {
                if (err) {
                    throw err;
                }
                this.log.info(`Device test data: ${data.toString()}`);
                mieleTools.splitMieleDevices(this, {}, JSON.parse(data.toString()));
            });
            timeouts.fakeRequest = setTimeout(() => {
                fs.readFile('test/testdata.actions.json', 'utf8', (err, data) => {
                    if (err) {
                        throw err;
                    }
                    this.log.info(`Actions test data: ${data.toString()}`);
                    mieleTools.splitMieleActionsMessage(this, JSON.parse(data.toString()));
                    timeouts.terminateDelay = setTimeout(() => {
                        this.terminate('Processing of test data completed. Nothing more to do.', 11);
                    }, 5000);
                });
            }, 5000);
        } else {
            // test config and get auth token
            try {
                await mieleTools.checkConfig(this, this.config).catch(() => {
                    this.terminate('Terminating adapter due to invalid configuration.', 11);
                });
                await this.getTokenObj()
                    .then(async tokenSet => {
                        if (!mieleTools.authHasExpired(this, tokenSet)) {
                            // check every 5 Minutes whether the auth token is going to expire in the next 5 minutes; If yes refresh token
                            timeouts.authCheck = setInterval(
                                async () => {
                                    this.log.debug(
                                        `Testing whether auth token is going to expire within the next 5 minutes.`,
                                    );
                                    if (mieleTools.authHasExpired(this, tokenSet)) {
                                        await mieleTools.refreshAuthToken(this, this.config, tokenSet)
                                            .then(async tokenSet => {
                                                this.log.info(`Successfully refreshed access token.`);
                                                this.updateTokenSetForAdapter(tokenSet).catch(err => {
                                                    this.log.error(`Error updating tokens in adapter config: ${err}`);
                                                });
                                                return tokenSet;
                                            })
                                            .catch(err => {
                                                this.log.error(`Error refreshing token: ${err}`);
                                                this.log.info(
                                                    `Clearing token store and restarting authentication process.`,
                                                );
                                                this.clearTokenStore();
                                                this.onReady();
                                            });
                                    }
                                },
                                mieleConst.AUTH_CHECK_TIMEOUT,
                                this,
                                this.config,
                            );
                            // register for events from Miele API
                            if (this.config.sse) {
                                this.log.info(`Registering for all appliance events at Miele API.`);
                                this.initSSE(tokenSet);
                                /**
                                 * code for watchdog
                                 * -> check every 5 minutes whether pings are missing
                                 */
                                this.log.info(`Initializing SSE watchdog.`);
                                timeouts.watchdog = setInterval(() => {
                                    if (
                                        new Date().getTime() - new Date(tokenSet.ping).getTime() >=
                                        mieleConst.WATCHDOG_TIMEOUT
                                    ) {
                                        this.log.info(
                                            `Watchdog detected ping failure. Last ping occurred over five minutes ago (${Date(tokenSet.ping).toLocaleString()}). Trying to handle by reinitiating the SSE connection.`,
                                        );
                                        this.setState('info.connection', false, true);
                                        events.close();
                                        this.initSSE(tokenSet);
                                    }
                                }, mieleConst.WATCHDOG_TIMEOUT);
                            } else {
                                this.log.info(
                                    `Requesting data from Miele API using time based polling every ${this.config.pollInterval * this.config.pollUnit} Seconds.`,
                                );
                                this.doDataPolling(this, tokenSet);
                            }
                        } else {
                            this.log.debug(`Current tokenSet: ${JSON.stringify(tokenSet)}`);
                            if (tokenSet.access_token === '') {
                                this.log.error(
                                    'Adapter has no access token. Please generate one using the workflow in the admin config UI.',
                                );
                            } else {
                                this.log.warn('Adapter has an expired access token. Trying to refresh it.');
                                mieleTools
                                    .refreshAuthToken(this, this.config, tokenSet)
                                    .then(newAuthToken => {
                                        this.log.info('Adapter access token has been refreshed successfully.');
                                        this.updateTokenSetForAdapter(newAuthToken);
                                    })
                                    .catch(err => {
                                        if (typeof err === 'string') {
                                            this.terminate(err);
                                        } else {
                                            this.log.error(JSON.stringify(err));
                                            this.clearTokenStore();
                                            this.onReady();
                                        }
                                    });
                                this.onReady();
                            }
                        }
                    })
                    .catch(err => {
                        this.log.error(`Error getting token object: ${err}`);
                });
            } catch (err) {
                this.log.error(err);
            }
        }
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     *
     * @param callback  {function} callback function to be called after clean up
     */
    async onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            this.unsubscribeObjects('*');
            this.unsubscribeStates('*');
            await this.setState('info.connection', false, true);
            for (const [key] of Object.entries(timeouts)) {
                this.log.debug(`Clearing ${key} interval.`);
                clearInterval(timeouts[key]);
            }
            if (events) {
                events.close();
            }
            callback();
        } catch (e) {
            this.log.error(`Error during unload: ${e.message} - ${e.stack}`);
            callback();
        }
    }

    /**
     * Is called if a subscribed state changes
     *
     * @param id    {string} the state's id
     * @param state {object} the state's object
     */
    async onStateChange(id, state) {
        if (state) {
            // The state was changed
            // this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
            if (state.ack) {
                if (id.split('.').pop() === 'Power' && state.val) {
                    // add programs to device when it's powered on, since querying programs powers devices on or throws errors
                    await mieleTools.addProgramsToDevice(this, this._tokenSet, id.split('.', 3).pop());
                }
            } else {
                // manual change / request
                this.log.debug(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
                const payload = {};
                let endpoint;
                const action = id.split('.').pop();
                const device = id.split('.', 3).pop();
                endpoint = mieleConst.ENDPOINT_ACTIONS.replace('LANG', this.config.locale);
                switch (action) {
                    case 'Nickname':
                        payload.deviceName = state.val;
                        break;
                    case 'Start':
                        payload.processAction = mieleConst.START;
                        break;
                    case 'Stop':
                        payload.processAction = mieleConst.STOP;
                        break;
                    case 'Pause':
                        payload.processAction = mieleConst.PAUSE;
                        break;
                    case 'SuperFreezing':
                        payload.processAction = state.val
                            ? mieleConst.START_SUPERFREEZING
                            : mieleConst.STOP_SUPERFREEZING;
                        break;
                    case 'SuperCooling':
                        payload.processAction = state.val
                            ? mieleConst.START_SUPERCOOLING
                            : mieleConst.STOP_SUPERCOOLING;
                        break;
                    case 'startTime':
                        payload.startTime = typeof state.val === 'string' ? state.val.split(':') : [0, 0];
                        break;
                    case 'VentilationStep':
                        payload.ventilationStep = state.val;
                        break;
                    case 'targetTemperatureZone-1':
                    case 'targetTemperatureZone-2':
                    case 'targetTemperatureZone-3':
                        payload.targetTemperature = [{ zone: action.split('-').pop(), value: state.val }];
                        break;
                    case 'Color':
                        payload.colors = state.val;
                        break;
                    case 'Mode':
                        payload.modes = state.val;
                        break;
                    case 'Light':
                        payload.light = state.val ? 1 : 2;
                        break;
                    case 'Power':
                        state.val ? (payload.powerOn = true) : (payload.powerOff = true);
                        break;
                    case 'LastActionResult':
                        break;
                    default:
                        payload.programId = typeof action == 'string' ? Number.parseInt(action) : 0;
                        endpoint = mieleConst.ENDPOINT_PROGRAMS.replace('LANG', this.config.locale);
                        break;
                }
                await mieleTools
                    .executeAction(this, this._tokenSet, endpoint, device, payload)
                    .then(() => {
                        this.setState(`${device}.ACTIONS.LastActionResult`, 'Okay!', true);
                    })
                    .catch(error => {
                        this.setState(`${device}.ACTIONS.LastActionResult`, error, true);
                    });
            }
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param [options] {object} link to the adapter instance
     */
    module.exports = options => new Mielecloudservice(options);
} else {
    // otherwise, start the instance directly
    new Mielecloudservice();
}
