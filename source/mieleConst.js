/* jshint -W097 */
/* jshint -W030 */
/* jshint strict:true */
/* jslint node: true */
'use strict';

const AdapterVersion = require('../io-package.json').common.version;

/**
 * Miele constants
 *
 *  This file contains all constant values for this adapter to have all of them in one place
 *
 */

module.exports.UserAgent = 'ioBroker.MieleCloudService V' + AdapterVersion;
module.exports.BASE_URL = 'https://api.mcs3.miele.com/';
module.exports.ENDPOINT_TOKEN    = 'thirdparty/token/';
module.exports.ENDPOINT_LOGOUT   = 'thirdparty/logout/';
module.exports.ENDPOINT_EVENTS   = 'v1/devices/all/events/';
module.exports.ENDPOINT_PROGRAMS = 'v1/devices/DEVICEID/programs/?language=LANG';
module.exports.ENDPOINT_ACTIONS  = 'v1/devices/DEVICEID/actions';
module.exports.START = 1;
module.exports.STOP  = 2;
module.exports.PAUSE = 3;
module.exports.START_SUPERFREEZING = 4;
module.exports.STOP_SUPERFREEZING  = 5;
module.exports.START_SUPERCOOLING  = 6;
module.exports.STOP_SUPERCOOLING   = 7;
module.exports.LIGHT_ON  = 1;
module.exports.LIGHT_OFF = 2;
module.exports.MODE_NORMAL  = 0;
module.exports.MODE_SABBATH = 1;
module.exports.RESTART_TIMEOUT = 30;      // 30 Seconds
module.exports.WATCHDOG_TIMEOUT = 300000; // 5 Minutes in ms
module.exports.RECONNECT_TIMEOUT = 60000; // 60 Seconds in ms
module.exports.AUTH_CHECK_TIMEOUT = 12*3600*1000; // 12 hours in ms
module.exports.AUTH_CHECK_TIMEOUT_TEST = 30000;   // 30 seconds in ms
module.exports.ALL_ACTIONS_DISABLED={'processAction':[],'light':[],'ambientLight':[],'startTime':[],'ventilationStep':[],'programId':[],'targetTemperature':[],'deviceName':false,'powerOn':false,'powerOff':false,'colors':[],'modes':[]};
module.exports.ACTIONS='actions';
module.exports.DEVICES='devices';
module.exports.PING='ping';
module.exports.ERROR='error';
module.exports.MAX_ERROR_THRESHOLD=20;