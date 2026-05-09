//@ts-check
'use strict';

/**
 * @typedef {import('./types.mieleCloudService').tokenSet} tokenSet
 * @typedef {import('./types.mieleCloudService').tokenMsg} tokenMsg
 * @typedef {import('./types.mieleCloudService').actionMessage} actionMessage
 */


/*
 * Created with @iobroker/create-adapter v2.1.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const { EventSource } = require('eventsource');
const mieleTools = require('./mieleTools.js');
const mieleConst = require('./mieleConst.js');
const tokenTools = require('./tokenTools.js');
const {getTokenSetObj} = require("./tokenTools");
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

        this._sseErrors = 0;
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
                        tokenTools
                            .getAccessToken(this, this._clientId, this._clientSecret, args.code, this._redirectUriBase)
                            .then(newAuth => {
                                this.log.debug(`Token Message: ${JSON.stringify(newAuth)}`);
                                msg.callback &&
                                    this.sendTo(
                                        msg.from,
                                        msg.command,
                                        { result: `Received an access_token. --> Success!` },
                                        msg.callback,
                                    );
                                tokenTools.persistTokenSetInTokenStore(this, newAuth).catch(err => {
                                    this.log.error(`Error updating tokens in adapters token store: ${err}`);
                                });
                                this.log.info(`Access-Token expires on: ${new Date(newAuth.obtained + newAuth.expires_in * 1000).toLocaleString()}`);
                                this.log.info(`Refresh-Token expires on: ${new Date(newAuth.obtained + newAuth.refresh_expires_in * 1000).toLocaleString()}`);
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
     * @param {tokenSet} tokenSet
     * @returns {EventSource} the new EventSource connection
     */
    getEventSource(tokenSet) {
        return new EventSource(mieleConst.BASE_URL + mieleConst.ENDPOINT_EVENTS, {
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
    }

    /**
     * does the SSE connection error handling in case an error is reported by the server
     *
     * @param adapter {object} link to the current adapter instance
     * @param events  {object} link to the current EventSource connection
     */
    async doSSEErrorHandling(adapter, events) {
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
                                adapter._sseErrors++;
                                const randomDelay =
                                    Math.pow(adapter._sseErrors, 2) * 1000 + Math.floor(Math.random() * 1000);
                                timeouts.getEvents = setTimeout(async () => {
                                    await adapter.initSSE(tokenTools.getTokenSetObj(adapter));
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
                        await adapter.initSSE(tokenTools.getTokenSetObj(adapter));
                        adapter.log.info(`SSE connection reinitialized.`);
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
     * Parse the JSON payload of an SSE 'action' event. Returns null if the
     * payload is not valid JSON so the listener can skip the message instead
     * of crashing the adapter when the Miele backend sends a truncated or
     * malformed frame.
     *
     * @param {string} data raw event.data string from the SSE stream
     * @returns {actionMessage | null} parsed action message, or null on parse error
     */
    getActionMessage(data) {
        try {
            return JSON.parse(data);
        } catch (err) {
            const sample = typeof data === 'string' ? data.slice(0, 200) : String(data);
            this.log.warn(`Could not parse SSE ACTIONS payload: [${err}] — payload: [${sample}]`);
            return null;
        }
    }

    /**
     * Parse the JSON payload of an SSE 'device' event. Returns null if the
     * payload is not valid JSON so the listener can skip the message instead
     * of crashing the adapter when the Miele backend sends a truncated or
     * malformed frame.
     *
     * @param {string} data raw event.data string from the SSE stream
     * @returns {object | null} parsed device payload, or null on parse error
     */
    getDeviceMessage(data) {
        try {
            return JSON.parse(data);
        } catch (err) {
            const sample = typeof data === 'string' ? data.slice(0, 200) : String(data);
            this.log.warn(`Could not parse SSE DEVICES payload: [${err}] — payload: [${sample}]`);
            return null;
        }
    }

    /**
     * Initialize new EventSource and handle all occurring events
     *
     * @param {tokenSet} tokenSet
     */
    initSSE(tokenSet) {
        // Initialize new EventSource
        events = this.getEventSource(tokenSet);

        /**
         * Handle message type 'open'.
         * It occurs when an SSE connection has been established
         */
        events.onopen = async () => {
            this.log.info(
                `SSE-Connection has been ${this._sseErrors === 0 ? 'established' : 'reestablished after error'} @Miele-API.`,
            );
            await this.setState('info.connection', true, true);
            this._sseErrors = 0;
        };
        /**
         * Handle message type 'device'.
         * It occurs when a device changes one of its states and on initialization
         */
        this.log.info(`Registering for 'Devices' events at Miele API.`);
        events.addEventListener(mieleConst.DEVICES, async event => {
            this.log.debug(`Received DEVICES message by SSE: [${JSON.stringify(event.data)}]`);
            const message = this.getDeviceMessage(event.data);
            if (message === null) {
                return;
            }
            await mieleTools.splitMieleDevices(this, message, tokenSet)
            .catch(err => {
                this.log.warn(`splitMieleDevices crashed with error: [${err}]`);
            })
            .finally(() => {
                this.log.debug(`Finished processing of devices.`)
            })
        });

        /**
         * Handle message type 'action'.
         * It occurs when a device changes its available actions and on initialization
         */
        this.log.info(`Registering for 'Action' events at Miele API.`);
        events.addEventListener(mieleConst.ACTIONS, event => {
            this.log.debug(`Received ACTIONS message by SSE: [${JSON.stringify(event.data)}]`);
            const message = this.getActionMessage(event.data);
            if (message === null) {
                return;
            }
            mieleTools.splitMieleActionsMessage(this, message).catch(err => {
                this.log.warn(`splitMieleActionsMessage crashed with error: [${err}]`);
            });
        });

        /**
         * Handle message type 'ping'.
         * It occurs periodically (usually every twenty seconds).
         * It's used to feed the watchdog
         */
        this.log.info(`Registering for 'Ping' events at Miele API.`);
        events.addEventListener(mieleConst.PING, event => {
            this.log.debug(`Received PING message by SSE: ${JSON.stringify(event.data)}`);
            tokenSet.ping = new Date().getTime();
        });

        /**
         * Handle message type 'error'.
         * It occurs when the Miele-API detects an error
         */
        events.addEventListener(mieleConst.ERROR, event => {
            this._sseErrors++;
            this.setState('info.connection', false, true)
                .catch(err => {
                    this.log.error(`Setting the connection-info crashed with error: ${err}`);
                });
            this.log.debug(`Received error message by SSE: ${JSON.stringify(event)}`);
            let randomDelay = Math.pow(this._sseErrors, 2) * 1000 + Math.floor(Math.random() * 1000);
            if (Object.prototype.hasOwnProperty.call(timeouts, 'reconnectDelay')) {
                clearTimeout(timeouts.reconnectDelay);
            }
            this.log.warn(
                `An ${typeof event.message != 'undefined' ? `error (#${this._sseErrors}) occurred (${event.message})` : 'undefined error occurred'}. Handling it in ${randomDelay / 1000} seconds to give it a chance to solve itself.`,
            );
            timeouts.reconnectDelay = setTimeout(
                (adapter, events) => {
                    this._sseErrors++;
                    randomDelay = Math.pow(adapter._sseErrors, 2) * 1000 + Math.floor(Math.random() * 1000);
                    // @ts-expect-error Property 'reconnectInterval' does not exist on type 'Event'.
                    event.reconnectInterval = randomDelay;
                    this.doSSEErrorHandling(adapter, events).catch(err => {
                        adapter.log.error(`Error during doSSEErrorHandling: ${err}`);
                    });
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
                mieleTools.splitMieleDevices(adapter, devices, auth).catch(err => {
                    adapter.log.warn(`splitMieleDevices crashed with error: [${err}]`);
                });
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
     * performs a test run without connecting to the online API, but reads given test data from HDD
     *
     * @returns {Promise<void>}
     */
    async performFakeRequest(){
        const fs = require('fs');
        fs.readFile('test/testdata.devices.json', 'utf8', (err, data) => {
            if (err) {
                throw err;
            }
            this.log.info(`Device test data: ${data.toString()}`);
            mieleTools.splitMieleDevices(this, JSON.parse(data.toString(), tokenTools.getTokenSetObj() ));
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
    }

    /**
     *
     * @param {object} adapter
     * @param {tokenSet} tokenSet
     * @returns {Promise<void>}
     */
    async SseWatchDog(adapter, tokenSet){
        /**
         * code for watchdog
         * -> check every 5 minutes whether pings are missing
         */
        adapter.log.info(`Initializing SSE watchdog.`);
        timeouts.watchdog = setInterval(() => {
            if (
                new Date().getTime() - new Date(tokenSet.ping).getTime() >=
                mieleConst.WATCHDOG_TIMEOUT
            ) {
                adapter.log.info(
                    `Watchdog detected ping failure. Last ping occurred over five minutes ago (${new Date(tokenSet.ping).toLocaleString()}). Trying to handle by reinitiating the SSE connection.`,
                );
                adapter.setState('info.connection', false, true);
                events.close();
                adapter.initSSE(tokenSet);
            }
        }, mieleConst.WATCHDOG_TIMEOUT);

}
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Reset the connection indicator during startup
        await this.setState('info.connection', false, true);
        // test whether adapter config is valid
        await mieleTools.checkConfig(this, this.config).catch(() => {
            this.terminate('Terminating adapter due to invalid configuration.', 11);
        });
        if (fakeRequests) {
            await this.performFakeRequest();
        } else {
            await tokenTools.getTokenSetObj(this)
                .then(tokenSet => {
                    if (this.config.sse){
                        this.initSSE(tokenSet);
                        this.SseWatchDog(this, tokenSet);
                    } else {
                        this.log.info(
                        `Requesting data from Miele API using time based polling every ${this.config.pollInterval * this.config.pollUnit} Seconds.`,
                        );
                        this.doDataPolling(this, tokenSet);
                    }
                })
                .catch(err => {
                    this.log.error(`${err}`);
                    this.log.error(`Unable to get a tokenSet, please perform the Authentication-with-Miele workflow in the Admin-UI.`);
                })
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
            const tokenSet = await tokenTools.getTokenSetObj(this);
            if (state.ack) {
                if (id.split('.').pop() === 'Power' && state.val) {
                    // add programs to device when it's powered on, since querying programs powers devices on or throws errors
                    await mieleTools.addProgramsToDevice(this, tokenSet, id.split('.', 3).pop());
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
                    .executeAction(this, tokenSet, endpoint, device, payload)
                    .then(() => {
                        this.setState(`${device}.ACTIONS.LastActionResult`, 'Okay!', true);
                    })
                    .catch(async error => {
                        await this.setState(`${device}.ACTIONS.LastActionResult`, error, true);
                        if (error.startsWith('401')){
                            await tokenTools.refreshTokenSet(this, tokenSet)
                            .then(async tokenSet => {
                                await tokenTools.persistTokenSetInTokenStore(this, tokenSet);
                                await this.onStateChange(id, state);
                            })
                            .catch(err => {
                                this.log.error(`Error during refreshTokenSet: ${err} - Aborting action.`);
                            });
                        }
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
