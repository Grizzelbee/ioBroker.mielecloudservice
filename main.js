'use strict';

/*
 * Created with @iobroker/create-adapter v2.1.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const mieleTools = require('./source/mieleTools.js');
const events = require('eventsource');

let auth;
let timeouts = {};

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
        // decrypt passwords
        this.config.Client_secret =  this.decrypt(this.config.Client_secret);
        this.config.Miele_pwd =  this.decrypt(this.config.Miele_pwd);
        try {
            await mieleTools.checkConfig(this, this.config)
                .then(async ()=> {
                    auth = await mieleTools.getAuth(this, this.config, 1)
                        .catch((err)=> {
                            // this.log.error(err);
                            this.terminate(err);
                        });
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
            }, 15*1000, this, this.config); // org: 12*3600*1000
            this.log.debug(`auth=${JSON.stringify(auth)}`);

            setTimeout(()=> {
                auth.expiryDate = new Date().getSeconds()+6*3600;
                this.log.debug(`Setting new expiry date: ${Date(auth.expiryDate).toLocaleString()}`);
            }, 10000);


            //events =
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
            events.close();
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