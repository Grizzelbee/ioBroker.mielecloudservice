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
let adapter;
let events;
let auth;
const fakeRequests=false;// this switch is used to fake requests against the Miele API and load the JSON-objects from disk

// Load your modules here, e.g.:
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

    getEventSource(){
        return new EventSource(mieleConst.BASE_URL + mieleConst.ENDPOINT_EVENTS, {
            headers: {
                Authorization: 'Bearer ' + auth.access_token,
                'Accept': 'text/event-stream',
                'Accept-Language': adapter.config.locale
            }
        });
    }

    initSSE(){
        events = this.getEventSource();

        events.onopen = function () {
            adapter.log.info('Server Sent Events-Connection has been (re)established @Miele-API.');
        };

        events.addEventListener(mieleConst.DEVICES,  (event) => {
            adapter.log.debug(`Received DEVICES message by SSE: [${JSON.stringify(event)}]`);
            mieleTools.splitMieleDevices(adapter, auth, JSON.parse(event.data))
                .catch((err) => {
                    adapter.log.warn(`splitMieleDevices crashed with error: [${err}]`);
                });
        });

        events.addEventListener(mieleConst.ACTIONS,  (event) => {
            adapter.log.debug(`Received ACTIONS message by SSE: [${JSON.stringify(event)}]`);
            mieleTools.splitMieleActionsMessage(adapter, JSON.parse(event.data))
                .catch((err) => {
                    adapter.log.warn(`splitMieleActionsMessage crashed with error: [${err}]`);
                });
        });

        events.addEventListener(mieleConst.PING,  (event) => {
            // ping messages usually occur every five seconds.
            adapter.log.debug(`Received PING message by SSE: ${JSON.stringify(event)}`);
            auth.ping = new Date();
        });

        events.addEventListener(mieleConst.ERROR,  (event) => {
            adapter.setState('info.connection', false, true);
            adapter.log.warn('Received error message by SSE: ' + JSON.stringify(event));
            adapter.log.info('An error occurred. Closing the connection.');
            timeouts.reconnectDelay = setTimeout(function () {
                adapter.log.info('Trying to reconnect.');
                adapter.initSSE();
            }, mieleConst.RECONNECT_TIMEOUT);
        });

        // code for watchdog -> check every 5 minutes
        timeouts.watchdog = setInterval(() => {
            const testValue = new Date();
            if (Date.parse(testValue.toLocaleString()) - Date.parse(auth.ping.toLocaleString()) >= 60000) {
                adapter.log.debug(`Watchdog detected ping failure. Last ping occurred over a minute ago. Trying to reconnect.`);
            }
        }, mieleConst.WATCHDOG_TIMEOUT);
    }

    doDataPolling(adapter, auth){
        timeouts.datapolling = setInterval(async function () {
            // getDeviceInfos
            const devices = await mieleTools.refreshMieleDevices(adapter, auth)
                .catch((error) => {
                    adapter.log.info('Devices-Error: '+JSON.stringify(error));
                });
            auth.ping = new Date();
            // processDeviceInfos
            mieleTools.splitMieleDevices(adapter, auth, devices)
                .catch((err) => {
                    adapter.log.warn(`splitMieleDevices crashed with error: [${err}]`);
                });
            timeouts.actionsDelay = setTimeout( async function() {
                const knownDevices = mieleTools.getKnownDevices();
                const keys = Object.keys(knownDevices);
                adapter.log.debug(keys.length===0?`There are no known devices; No actions to query`:`There are ${keys.length} known devices; querying actions for them.`);
                for (let n=0; n < keys.length; n++) {
                    // getActions
                    adapter.log.debug(`Querying device ${knownDevices[keys[n]].name}`);
                    const actions = await mieleTools.refreshMieleActions(adapter, auth, knownDevices[keys[n]].API_ID)
                        .catch((error) => {
                            adapter.log.info('Actions-Error: '+JSON.stringify(error));
                        });
                    adapter.log.info('Actions: '+JSON.stringify(actions));
                    // processDeviceActions
                    mieleTools.splitMieleActionsMessage(adapter, actions)
                        .catch((err) => {
                            adapter.log.warn(`splitMieleActionsMessage crashed with error: [${err}]`);
                        });
                }
            }, 1000);
        }, adapter.config.pollInterval * adapter.config.pollUnit * 1000);
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Reset the connection indicator during startup
        this.setState('info.connection', false, true);
        // remember the link to the adapter instance
        adapter = this;
        // decrypt passwords
        this.config.Client_secret =  this.decrypt(this.config.Client_secret);
        this.config.Miele_pwd =  this.decrypt(this.config.Miele_pwd);
        //
        if (fakeRequests){
            const fs=require('fs');
            fs.readFile('test/testdata.devices.json', 'utf8', function(err, data) {
                if (err) throw err;
                adapter.log.info( 'Device test data: ' + data.toString() );
                mieleTools.splitMieleDevices( adapter, {}, JSON.parse(data.toString()) );
            });
            timeouts.fakeRequest = setTimeout(()=>{
                fs.readFile('test/testdata.actions.json', 'utf8', function(err, data) {
                    if (err) throw err;
                    adapter.log.info( 'Actions test data: ' + data.toString() );
                    mieleTools.splitMieleActionsMessage( adapter, JSON.parse(data.toString()) );
                    timeouts.terminateDelay = setTimeout(()=>{
                        adapter.terminate('Processing of test data completed. Nothing more to do.', 11);
                    }, 5000);
                });
            }, 5000);
        } else {
            // test config and get auth token
            try {
                await mieleTools.checkConfig(this, this.config)
                    .then(async () => {
                        auth = await mieleTools.getAuth(this, this.config, 1)
                            .catch((err) => {
                                // this.log.error(err);
                                this.terminate(err, 11);
                            });
                        this.log.debug(JSON.stringify(auth));
                    })
                    .catch(() => {
                        this.terminate('Terminating adapter due to invalid configuration.', 11);
                    });
                if (auth) {
                    // continue here after config is checked and auth is requested
                    // check every 12 hours whether the auth token is going to expire in the next 24 hours; If yes refresh token
                    timeouts.authCheck = setInterval(async (adapter, config) => {
                        this.log.debug(`Testing whether auth token is going to expire within the next 24 hours.`);
                        if (mieleTools.authHasExpired(auth)) {
                            auth = await mieleTools.refreshAuthToken(adapter, config, auth)
                                .catch((err) => {
                                    if (typeof err === 'string') {
                                        adapter.terminate(err);
                                    } else {
                                        adapter.log.error(JSON.stringify(err));
                                        adapter.terminate('Terminating adapter due to invalid auth token.');
                                    }
                                });
                        }
                    }, mieleConst.AUTH_CHECK_TIMEOUT, this, this.config);
                    // register for events from Miele API
                    if (adapter.config.sse){
                        this.log.info(`Registering for all appliance events at Miele API.`);
                        adapter.initSSE();
                    } else {
                        this.log.info(`Requesting data from Miele API using time based polling every ${adapter.config.pollInterval * adapter.config.pollUnit} Seconds.`);
                        adapter.doDataPolling(adapter, auth);
                    }
                }
            } catch (err) {
                this.log.error(err);
            }
        }
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    async onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            this.unsubscribeObjects('*');
            this.unsubscribeStates('*');
            this.setState('info.connection', false, true);
            for (const [key] of Object.entries(timeouts) ) {
                this.log.debug(`Clearing ${key} interval.`);
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
    async onStateChange(id, state) {
        if (state) {
            // The state was changed
            // this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
            if (state.ack){
                if (id.split('.').pop() === 'Power' && state.val ){
                    // add programs to device when it's powered on, since querying programs powers devices on or throws errors
                    await mieleTools.addProgramsToDevice(adapter, auth, id.split('.', 3).pop());
                }
            } else {
                // manual change / request
                this.log.debug(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
                const adapter= this;
                const payload = {};
                const action  = id.split('.').pop();
                const device  = id.split('.', 3).pop();
                switch(action){
                    case 'Nickname': payload.deviceName = state.val;
                        break;
                    case 'Start': payload.processAction = mieleConst.START;
                        break;
                    case 'Stop': payload.processAction = mieleConst.STOP;
                        break;
                    case 'Pause': payload.processAction = mieleConst.PAUSE;
                        break;
                    case 'SuperFreezing': payload.processAction = (state.val?mieleConst.START_SUPERFREEZING:mieleConst.STOP_SUPERFREEZING);
                        break;
                    case 'SuperCooling': payload.processAction = (state.val?mieleConst.START_SUPERCOOLING:mieleConst.STOP_SUPERCOOLING);
                        break;
                    case 'startTime': payload.startTime = (typeof state.val==='string'?state.val.split(':'):[0,0]);
                        break;
                    case 'ventilationStep': payload.ventilationStep = state.val;
                        break;
                    case 'targetTemperatureZone-1':
                    case 'targetTemperatureZone-2':
                    case 'targetTemperatureZone-3': payload.targetTemperature = [{zone:action.split('-').pop(), value: state.val}];
                        break;
                    case 'Color': payload.colors = state.val;
                        break;
                    case 'Mode': payload.modes = state.val;
                        break;
                    case 'Light': payload.light = (state.val? 2 : 1);
                        break;
                    case 'Power': (state.val? payload.powerOn=true : payload.powerOff=true);
                        break;
                    case 'LastActionResult':
                        break;
                    default : payload.programId = (typeof action == 'string' ? Number.parseInt(action) : 0);
                        break;
                }
                await mieleTools.executeAction(this, auth, action, device, payload)
                    .then(() => {
                        adapter.setState(`${device}.ACTIONS.LastActionResult`, 'Okay!', true);
                    })
                    .catch((error)=>{
                        adapter.setState(`${device}.ACTIONS.LastActionResult`, error, true);
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
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new Mielecloudservice(options);
} else {
    // otherwise, start the instance directly
    new Mielecloudservice();
}