'use strict';

/*
 * Created with @iobroker/create-adapter v2.1.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const EventSource = require('eventsource');
const mieleTools = require('./source/mieleTools.js');
const mieleConst = require('./source/mieleConst');
const timeouts = {};
let events;
let auth;

// Load your modules here, e.g.:
// const fs = require("fs");

class Mielecloudservice extends utils.Adapter {

    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'mielecloudservice',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Reset the connection indicator during startup
        this.setState('info.connection', false, true);
        // remember the link to the adapter instance
        const adapter = this;
        // decrypt passwords
        this.config.Client_secret =  this.decrypt(this.config.Client_secret);
        this.config.Miele_pwd =  this.decrypt(this.config.Miele_pwd);
        // test config and get auth token
        try {
            await mieleTools.checkConfig(this, this.config)
                .then(async ()=> {
                    auth = await mieleTools.getAuth(this, this.config, 1)
                        .catch((err)=> {
                            // this.log.error(err);
                            this.terminate(err);
                        });
                    this.log.debug(JSON.stringify(auth));
                })
                .catch(()=> {
                    this.terminate('Terminating adapter due to invalid configuration.');
                });
            // continue here after config is checked and auth is requested
            // check every 12 hours whether the auth token is going to expire in the next 24 hours; If yes refresh token
            timeouts.authCheck = setInterval(async (adapter, config)=> {
                this.log.debug(`Testing whether auth token is going to expire within the next 24 hours.`);
                if (mieleTools.authHasExpired(auth)){
                    auth = await mieleTools.refreshAuthToken(adapter, config, auth)
                        .catch((err)=> {
                            if ( typeof err === 'string'){
                                adapter.terminate(err);
                            } else {
                                adapter.log.error(JSON.stringify(err));
                                adapter.terminate('Terminating adapter due to invalid auth token.');
                            }
                        });
                }
            }, 12*3600*1000, this, this.config); // org: 12*3600*1000; for testing: 30000
            /*
            // code for debugging the refresh of tokens; will be removed as soon as the refresh code is tested
            this.log.debug(`auth=${JSON.stringify(auth)}`);
            setTimeout(()=> {
                auth.expiryDate = new Date();
                auth.expiryDate.setSeconds(6*3600);
                this.log.debug(`Setting new expiry date: ${auth.expiryDate.toLocaleString()}`);
            }, 5000);
            */
            // register for events from Miele API
            // curl -H "Accept:text/event-stream" -H "Accept-Language: de-DE" -H "Authorization: Bearer ACCESS_TOKEN" https://api.mcs3.miele.com/v1/devices/all/events
            this.log.info(`Registering for all appliance events at Miele API.`);
            events = new EventSource(mieleConst.BASE_URL + mieleConst.ENDPOINT_EVENTS, { headers: { Authorization: 'Bearer ' + auth.access_token,'Accept' : 'text/event-stream','Accept-Language' : this.config.locale }} );

            events.addEventListener( 'devices', function(event) {
                adapter.log.debug(`Received DEVICES message by SSE: [${JSON.stringify(event)}]`);
                // splitMieleDevices(JSON.parse(event.data), false);
            });

            events.addEventListener( 'actions', function(actions) {
                adapter.log.debug(`Received ACTIONS message by SSE: [${JSON.stringify(actions)}]`);
            });

            events.addEventListener( 'ping', function() {
                // ping messages usually occur every five seconds.
                // todo implement a watchdog upon ping messages
                adapter.log.debug(`Received PING message by SSE.`);

            });

            events.addEventListener( 'error', function(event) {
                adapter.log.warn('Received error message by SSE: ' + JSON.stringify(event));
                if (event.readyState === EventSource.CLOSED) {
                    adapter.log.info('The connection has been closed. Trying to reconnect.');
                    adapter.setState('info.connection', false, true);
                    events = new EventSource(mieleConst.BASE_URL + mieleConst.ENDPOINT_EVENTS, { headers: { Authorization: 'Bearer ' + auth.access_token,'Accept' : 'text/event-stream','Accept-Language' : adapter.config.locale }} );
                }
            });

            events.onopen = function() {
                adapter.log.info('Server Sent Events-Connection has been (re)established @Miele-API.');
            };
        } catch (err) {
            this.log.error(err);
        }
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    async onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);
            this.unsubscribeObjects('*');
            this.unsubscribeStates('*');
            this.setState('info.connection', false, true);
            for (const [key] of Object.entries(timeouts) ) {
                this.log.debug(`Clearing interval ${key}.`);
                clearInterval(timeouts[key]);
            }
            //events.close();
            if (auth) {
                await mieleTools.APILogOff(this, auth, 'access_token');
            }
            callback();
        } catch (e) {
            callback();
        }
    }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new Mielecloudservice(options);
} else {
    // otherwise, start the instance directly
    new Mielecloudservice();
}