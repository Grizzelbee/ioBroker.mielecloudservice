![Logo](admin/mielecloudservice.svg)
# ioBroker.mielecloudservice
![Number of Installations](http://iobroker.live/badges/mielecloudservice-installed.svg)
![Number of Installations](http://iobroker.live/badges/mielecloudservice-stable.svg)
[![NPM version](https://img.shields.io/npm/v/iobroker.mielecloudservice.svg)](https://www.npmjs.com/package/iobroker.mielecloudservice)
[![Known Vulnerabilities](https://snyk.io/test/github/Grizzelbee/ioBroker.mielecloudservice/badge.svg?targetFile=package.json)](https://snyk.io/test/github/Grizzelbee/ioBroker.mielecloudservice?targetFile=package.json)
[![Test and Release](https://github.com/Grizzelbee/ioBroker.mielecloudservice/actions/workflows/test-and-release.yml/badge.svg)](https://github.com/Grizzelbee/ioBroker.mielecloudservice/actions/workflows/test-and-release.yml)
[![License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat)](https://github.com/grizzelbee/iobroker.mielecloudservice/blob/master/README.md)
[![Downloads](https://img.shields.io/npm/dm/iobroker.mielecloudservice.svg)](https://www.npmjs.com/package/iobroker.mielecloudservice)
[![NPM](https://nodei.co/npm/iobroker.mielecloudservice.png?downloads=true)](https://nodei.co/npm/iobroker.mielecloudservice/)

## mielecloudservice adapter for ioBroker

Get your Miele appliances (XGW3000 & WiFiConn@ct) connected

>If you like this adapter and consider supporting me:<br/>
>[![Donate with PayPal](admin/paypal-donate-button.png)](https://www.paypal.com/donate/?hosted_button_id=SPUDTXGNG2MYG)

## Description
This adapter is for retrieving information about all your Miele@Home devices from the official Miele 3rd-party API.
Regardless if they are connected directly via Wi-Fi or XGW3000 Gateway. It implements the **Miele 3rd Party API V1.0.5**

## Prerequisites
* Miele@Home User (Smartphone App)
* Miele@Home Password (Smartphone App)
* Miele Client_id (from https://www.miele.com/developer/)
* Miele Client_secret (from https://www.miele.com/developer/ )

## Installation
To install, do the following:

1. Install via Admin using the
1. Install via Admin using the
* stable Repo - to get the current stable version
* latest Repo - to get the latest test version (maybe not stable)
* via: https://github.com/Grizzelbee/ioBroker.mielecloudservice.git - to get the latest development version
2. create an App-Account for Miele@Home in the Miele Smartphone App
3. Create a developer account at https://www.miele.com/f/com/en/register_api.aspx
4. Add your Miele-Devices to the App (if not added automatically)
6. Fill in the client_secret and client_id received from Miele-developer Team and account-id and password from the App.

## Features
This adapter currently implements nearly all features of the Miele API V1.0.5 and some parts of API V1.0.6.
The capabilities of the API may (and do so currently) vary from the capabilities of the iOS and Android apps.
E.g. there are no information available on the TwinDos - even the apps have them.
This includes:
* All known and documented appliance types are supported (API V1.0.6).
* Basic information for all appliance types.
* Extended information for all appliance types.
* EcoFeedback (water and/or power consumption) for appliances reporting this.
  `Note: Not all devices report this information - event not if they do so in the iOS or Android apps. Search for the ecoFeedback folder in the device tree.`
* Supported actions you can execute on this device - capabilities of the device are mostly reported by the API itself.

## Known Issues
* The programs are basically supported since v6.0.0 of the adapter. Except programs that need additional parameters like for ovens.

## Configuration
### Basic config
To get this adapter running you'll need at least:
* Miele@Home User (from the Smartphone App)
* Miele@Home Password (from the Smartphone App)
* Miele Client_id (from https://www.miele.com/developer/)
* Miele Client_secret (from https://www.miele.com/developer/ )

### Requesting data from Miele servers
Since V6.2.0 you have the opportunity to chose between 
* Server-Sent Events      (Server-Sent Events Checkbox is checked - default and *highly recommended*) 
* Time based Data-Polling (Server-Sent Events Checkbox is unchecked)
* Delayed Processing

#### Server-sent events (highly recommended)
Server-Sent Events are a very neat method to get data from the miele servers since the servers will send you data 
whenever there are changes. No useless polling every xx seconds ignoring whether there were changes or not. Unfortunately
there are issues using this connection type - it fails pretty often and only restarting the adapter solves this.

#### Time based Data Polling
To improve stability of the adapter I reintroduced data polling as a config option you may use when SSE fails four you.
Nevertheless, SSE is the default, and I highly recommend trying and using it since it saves many resources on your and on 
Mieles side. Beside of that I focus on SSE since Version 5.x.x.
Time based Data-Polling relies on the two config options:
* poll interval
* poll interval unit (seconds/minutes)

#### Delayed Processing
In case you own some Miele appliances and use them at the same time it may happen that the API gets sending many messages 
in a short time period. Depending on your ioBroker hardware this may overload your server and result in unresponsive 
visualization or an unresponsive broker at all. To avoid this, this config option reduces the number of messages being
processed to one message every xxx milliseconds. 
Related config options:
* delayed processing
* message delay

## Controlling your devices
### Actions
All currently supported and documented Actions for all devices are implemented (API V1.0.5).
> Please remember that Actions will only work if you put your device into the appropriate state (e.g. Mobile Control, powerOn, ...).
Please refer to [Miele-Documentation](#documentation) for more Information on actions.

### Programs (Introduced in API V1.0.5)
With API V1.0.5 Miele introduced a new endpoint called "/programs".
The support for this endpoint starts with adapter version 4.5.0. A new datapoint [device.Actions.Program] will be created listing all supported programs as returned by Miele.
**Selecting one of the values will execute the program immediately!**
Currently, only simple programs are supported. E.g. Ovens need some additional information - this will be implemented in a future version.

When publishing the adapter Miele documented a few device categories to support this endpoint and only (at least for me)
a subset of these really work. For my coffee system, washing machine and tumble dryer it only works for the coffee system.
But Miele is working on it and extends the support on a regular basis.
Please refer to the general Miele API documentation (below) for more information.


## Documentation
If you like to get a deeper understanding or need a raw-value translation please refer to [this documentation.](machine_states.md)

## Changelog
### **WORK IN PROGRESS**

### 6.5.6 (2024-05-10) (Dying for an Angel)

- (grizzelbee) New: [402](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/402) Added signalDoor to Washing machines, Tumble dryer and Washer dryer
- (grizzelbee) Upd: Dependencies got updated

### 6.5.5 (2024-01-03) (Dying for an Angel)

- (grizzelbee) Upd: Added year 2024 to licence
- (grizzelbee) Upd: Dependencies got updated


### 6.5.4 (2023-05-03) (Dying for an Angel)
* (grizzelbee) New: Added file `.ncurc.json` to prevent axios-oauth-client from being automatically updated by `npx npm-check-updates` 

### 6.5.3 (2023-04-26) (Dying for an Angel)
* (grizzelbee) Fix: two minor bug fixes - including a fix that prevents objects from being updated constantly.

### 6.5.2 (2023-04-21) (Dying for an Angel)
* (grizzelbee) Fix: [367](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/367) Fixed "oauth is not a function" error during startup by downgrading axios-oauth-client to v1.5.0

### 6.5.1 (2023-04-21) (Dying for an Angel)
* (grizzelbee) Fix: Some minor fixes for ioBroker adapter checker

### 6.5.0 (2023-04-18) (Dying for an Angel)
* (grizzelbee) New: added device type 74 = Hob with vapour extraction (part of Miele API v1.0.6)
* (grizzelbee) Upd: Updated ReadMe file
* (grizzelbee) Chg: Dependencies got Updated
* (grizzelbee) Chg: Important: Requires at least Node.js 14
* (grizzelbee) Chg: Changed SpinningSpeed from number to string 
* (grizzelbee) New: Added RAW-Value to SpinningSpeed 
* (grizzelbee) Chg: Changed PlateStep-xxx from number to string (related to issue [356](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/356))
* (grizzelbee) New: Added RAW-Value to Platesteps (related to issue [356](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/356))
* (grizzelbee) Fix: [343](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/343) GENERIC_BUSINESS_ERROR occurred when switching ventilationStep
* (grizzelbee) Fix: [356](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/356) In some cases the value 0 (zero) is ignored (e.g. at PlateStep)
* (grizzelbee) Fix: [359](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/359) Fixed "oauth is not a function" error during startup by downgrading axios-oauth-client to v1.5.0

### 6.4.0 (2022-09-07) (Dying for an Angel)
* (grizzelbee) Fix: program names get localized now
* (grizzelbee) New: moved Admin-UI to jsonConfig
* (grizzelbee) Chg: BREAKING CHANGE: removed duplicate en-/decryption of passwords due to jsonConfig
* (grizzelbee) Chg: Moved some documentation from the readme file to machine_states.md

### V6.3.4 (2022-07-13) (Black Wings)
* (grizzelbee) Fix: [269](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/269) enabled decryption of passwords again since this issue is a bug in Admin 6.2.0

### V6.3.3 (2022-07-13) (Black Wings)
* (grizzelbee) Fix: [258](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/258) Improved error handling in case of line outages 
* (grizzelbee) Fix: [269](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/269) Removed double decryption of passwords
* (grizzelbee) Chg: Dependencies got updated

### V6.3.2 (2022-06-02) (Black Wings)
* (grizzelbee) New: Added new config option "delayed processing" to prevent overload on less powerful hardware
* (grizzelbee) Fix: changed actions info message during polling to log level debug
* (grizzelbee) Fix: Fixed german translation bug "minutes" -> "protokoll" (thanks to rekorboi)

### V6.3.1 (2022-05-25) (Black Wings)
* (grizzelbee) Fix: Fixed bad log entry for error delay (delay is logged bad - but is executed okay)
* (grizzelbee) Chg: Improved connection error handling
* (grizzelbee) Fix: Fixed Sentry error: [MIELECLOUDSERVICE-3K](https://sentry.io/organizations/grizzelbee/issues/3281137250)

### V6.3.0 (2022-05-23) (Black Wings)
* (grizzelbee) New: [247](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/247) Added a User-Agent to http-requests to enable Miele to identify requests made by this adapter 
* (grizzelbee) New: [248](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/248) Added exponential backoff in case of errors
* (grizzelbee) Fix: [249](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/249) Handling undefined devices properly when executing actions
* (grizzelbee) Fix: [250](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/250) Fixed light switch action which did not work due to [228](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/228) 
* (grizzelbee) Fix: [246](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/246) switched http response from warn to debug
* (grizzelbee) Chg: Some minor log improvements
  
### V6.2.2 (2022-05-17) (Black Wings)
* (grizzelbee) Fix: Starting programs on devices is working now.

### V6.2.1 (2022-05-16) (Black Wings)
* (grizzelbee) Fix: [242](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/242) VentilationStep needs to be type number but was boolean
* (grizzelbee) Fix: ACTIONS.programId is invalid: obj.common.type has an invalid value (integer) ...

### V6.2.0 (2022-05-12) (Black Wings)
* (grizzelbee) New: [238](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/238) Reintroduced data polling as a config option for all who has troubles with Server-Sent Events
* (grizzelbee) New: Added some additional error handling code when Server Send Events report errors.
* (grizzelbee) New: [238](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/238) Added reconnect delay in case od an error 
* (grizzelbee) New: [192](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/192) Improved handling of adapter traffic light in case of an error 
* (grizzelbee) New: Waiting for code to complete in case of an occurring event 
* (grizzelbee) Chg: Changed watchdog log entry from info to debug

### V6.1.5 (2022-05-05) (Black Wings)
* (grizzelbee) Fix: Changed State-Changed log entry from info to debug 
* (grizzelbee) Fix: Fixed issue with not initialized auth.ping variable on adapter startup
* (grizzelbee) Fix: Fixed issue with not initialized auth.ping variable after token has been refreshed
* (grizzelbee) Fix: Fixed error in auth expiry calculation

### V6.1.4 (2022-05-03) (Black Wings)
* (grizzelbee) Fix: [233](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/233) Fixed error while setting targetTemperature

### V6.1.3 (2022-05-02) (Black Wings)
* (grizzelbee) Fix: [225](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/225) Fixes error with cooling devices
* (grizzelbee) Fix: [231](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/231) Fixes startup loop when cooling devices are connected
* (grizzelbee) Fix: Fixed SuperCooling switch
* (grizzelbee) Fix: Fixed SuperFreezing switch
* (grizzelbee) New: Added code to run dry tests with local test data 

### V6.1.2 (2022-04-29) (Black Wings)
* (grizzelbee) Fix: [228](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/228) Inverted light switch
* (grizzelbee) Chg: Moved main.js back to the main folder to run unit tests

### V6.1.1 (2022-04-28) (Black Wings)
* (grizzelbee) Fix: added some missing native parts in objects
* (grizzelbee) Chg: Moved main.js to the source folder

### V6.1.0 (2022-04-27) (Black Wings)
* (grizzelbee) Fix: Added some error handling
* (grizzelbee) Chg: Changed PlateStep_x data structure to PlateStepZone-x
* (grizzelbee) Chg: Removed unused ambientLight function
* (grizzelbee) Chg: [225](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/225) Removed unused freezerZone code for knownDevices

### V6.0.0 (2022-04-19) (Black Wings)
* (grizzelbee) New: Adapter entirely rewritten from scratch
* (grizzelbee) New: Added link to request Miele API credentials in config page.
* (grizzelbee) New: Implemented watchdog for broken lines
* (grizzelbee) New: Added donate button to config page and readme file
* (grizzelbee) New: [216](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/216) Added additional (undocumented) data points to dish warmer
* (grizzelbee) Fix: [213](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/213) Login delay works properly now when login fails on Startup
* (grizzelbee) Fix: [207](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/207) powering on device due to querying available programs
* (grizzelbee) Fix: Refresh of expired tokens works properly now
* (grizzelbee) Fix: Light-Switch is working now e.g. for coffee systems
* (grizzelbee) Chg: BREAKING CHANGE: Changed IDs for targetTemperature and temperature 
* (grizzelbee) Chg: targetTemperature and temperature with invalid values (-32768, null, ...) will no longer be created
* (grizzelbee) Chg: startTime has moved to ACTIONS and is intended to work properly
* (grizzelbee) Chg: ACTIONS.*_Button_Active data points have been removed
* (grizzelbee) Chg: Switches in the ACTIONS are simple boolean switches now (no on/off, ...)
* (grizzelbee) Upd: dependencies got updated
* (grizzelbee) Upd: removed separate license file

### V5.0.4 (2022-01-07) (Invincible)
* (grizzelbee) Fix: [MIELECLOUDSERVICE-7](https://sentry.io/organizations/nocompany-6j/issues/2379624775/?project=5735758) handling if there is no auth token for a request
* (grizzelbee) Fix: [MIELECLOUDSERVICE-2J](https://sentry.io/organizations/nocompany-6j/issues/2885488082/?project=5735758) handling if there is no auth token for a request
* (grizzelbee) Fix: [MIELECLOUDSERVICE-2K](https://sentry.io/organizations/nocompany-6j/issues/2886827789/?project=5735758) handling if there is no auth token for a request
* (grizzelbee) Fix: [MIELECLOUDSERVICE-28](https://sentry.io/organizations/nocompany-6j/issues/2787208315/?project=5735758) handling if the device is unknown

### V5.0.3 (2021-12-31) (Invincible)
* (grizzelbee) Fix: [MIELECLOUDSERVICE-8](https://sentry.io/organizations/nocompany-6j/issues/2380318199/?project=5735758) fixed stringifying circular structure
* (grizzelbee) Fix: undefined is not a valid state value for id "xxx.signalDoor"
* (grizzelbee) Fix: undefined is not a valid state value for id "xxx.ACTIONS.programId"

### V5.0.2 (2021-10-27) (Invincible)
* (grizzelbee) Upd: Added listener to error events
* (grizzelbee) Upd: Trying to reconnect if connection has been lost

### V5.0.1 (2021-10-25) (Invincible)
* (grizzelbee) Fix: [178](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/178) Removed: info Received ACTIONS message by SSE.
* (grizzelbee) Fix: [179](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/179) Removed: info Received DEVICES message by SSE.
* (grizzelbee) Fix: [180](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/180) Fixed: Info: State value to set for "mielecloudservice.0.xxx.ACTIONS.Power" has to be type "boolean" but received type "string"
* (grizzelbee) Fix: [181](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/181) Fixed: Program buttons should be fixed and work as soon as Miele fixes the API (as of today it has bugs).
* (grizzelbee) Upd: Removed many debug log output

### V5.0.0 (2021-10-21) (Invincible)
* (grizzelbee) Chg: BREAKING CHANGE: Removed useless grouping folders for device types - check your VIS and scripts
* (grizzelbee) New: [164](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/164) fixed bug in SignalFailure and signalInfo when havin no value
* (grizzelbee) New: [155](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/155) fixed >missing object< bug on arrays
* (grizzelbee) New: [154](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/154) Reintroduced TargetTemp to washer dryers
* (grizzelbee) New: [140](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/140) Switched from data polling to server sent events (push data)
* (grizzelbee) New: [71](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/71) If there is no internet connection on startup retry connecting until connection is established
* (grizzelbee) Fix: estimatedEndTime won't be shown anymore when device is off
* (grizzelbee) Fix: Don't rethrowing errors in APISendRequest anymore
* (grizzelbee) Fix: fixed a few minor bugs
* (grizzelbee) Upd: Updated dependencies
* (grizzelbee) New: Added some additional API languages newly supported by Miele
* (grizzelbee) New: Added support for Miele API V1.0.5
* (grizzelbee) New: Added correct tier of adapter to io-package
* (grizzelbee) New: Added more program phases for tumble dryers to documentation
* (grizzelbee) Fix: Switched type of Power-Switch from string to boolean for being compliant with ioBroker expectation (e.g. for Text2Command adapter) - maybe more to follow. Please delete the data point let it create newly.
* (germanBluefox) Fix: Fixed icon link

### V4.2.0 (2021-05-17) (A new Dimension)
* (grizzelbee) New: Adding Pause action to dish-washers

### V4.1.0 (2021-05-15) (Carry me over)
* (grizzelbee) New: [149](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/149) Adding support (Start, Stop, Pause) for Miele Scout RX2 vacuum cleaner robots
* (Stan23)     New: Added new program phase  soak/Einweichen

### V4.0.22 (2021-05-06) (Twisted mind)
* (grizzelbee) Fix: [142](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/142) Reintroduced TargetTemp for washing machines

### V4.0.21 (2021-05-03) (The Edge)
* (grizzelbee) Fix: Fixed accidental function name: createStateSpinAPIStartActionningSpeed
* (grizzelbee) Fix: Fixed State value to set for "*.PlateStep_1" has to be type "number" but received type "string"

### V4.0.20 (2021-04-30) (Sleepwalkers)
* (grizzelbee) Fix: [137](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/137) Fixed Read-only state "info.connection" has been written without ack-flag with value "false"
* (grizzelbee) Fix: [138](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/138) Fixed State value to set for ".Schleuderdrehzahl" has wrong type "string" but has to be "number"
* (grizzelbee) Fix: [139](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/139) Fixed State value to set for ".ACTIONS.Light" has wrong type "number" but has to be "string"
* (grizzelbee) Upd: Changed device group from channel to folder  as documented [here](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/objectsschema.md)

### V4.0.19 (2021-04-29) (The scarecrow)
* (grizzelbee) Fix: Fixed light switch bug causing an exception when switching - 2nd attempt
* (grizzelbee) Fix: Fixed No-Icon Bug when appliance is unknown

### V4.0.18 (2021-04-28) (Ghostlights)
* (grizzelbee) Fix: Fixed light switch bug causing an exception when switching

### V4.0.17 (2021-04-27) (Ghost in the moon)
* (grizzelbee) New: Added ioBroker sentry plugin to report issues automatically
* (grizzelbee) New: Added Light-Switch to washing machines, Tumble Dryers, Washer dryers and Dish washers
* (grizzelbee) Upd: Updated dependencies

> **Hint:**
> The behavior of the light-switch has slightly changed with this release. It not only tests the action capabilities of
> the device but also shows the state of the light state delivered by the API. If no actions are reported by the API, the
> switch will be without function and only show the current state. If actions have been reported the switch will work as you expect.
> If your device reports no light state and no actions the switch will show 'None' and won't do anything.

### V4.0.16 (2021-04-21) (Black Orchid)
* (grizzelbee) Fix: Units for EcoFeedback will be shown now, even machine is not running during setup
* (stan23)     New: added new program states

### V4.0.15 (2021-04-19) (Moonglow)
* (grizzelbee) Fix: [130](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/130) targetTemp for fridges and freezers will now correctly been updated in action section with current values

### V4.0.14 (2021-04-18) (Alchemy)
* (grizzelbee) Fix: [127](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/127) targetTemp for fridges caused exception and crash of adapter

### V4.0.13 (2021-04-12) (The toy master)
* (grizzelbee) Fix: [90](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/90) targetTemp addresses zones for fridges and freezers dynamically now

### V4.0.12 (2021-04-12) (Promised land)
* (grizzelbee) Fix: [90](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/90) targetTemp addresses zones for fridges and freezers dynamically now

### V4.0.11 (2021-04-11) (Cry just a little)
* (grizzelbee) Fix: targetTemp min and max values are now taken from API - no constant values anymore

### V4.0.10 (2021-04-10) (Another angel down)
* (grizzelbee) Fix: targetTemp min and max values are now taken from API - no constant values anymore

### V4.0.9 (2021-04-09) (Farewell)
* (grizzelbee) Fix: Errors during action execution will be shown correctly
* (grizzelbee) Fix: Actions will be executed correctly

### V4.0.8 (2021-04-09) (The seven angels)
* (grizzelbee) Fix: fixed datatype of VentilationStep data point
* (grizzelbee) Fix: fixed ventilation step switch for hoods (attempt 4)

### V4.0.7 (2021-04-09) (Lost in space)
* (grizzelbee) Fix: [90](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/90) added missing path to object ID; data point will be created in the correct place now
* (grizzelbee) New: targetTemp min and max values are now taken from API - no constant values anymore

### V4.0.6 (2021-04-08) (The great mystery)
* (grizzelbee) Fix: fixes Light switch for hoods and other devices supporting light
* (grizzelbee) Fix: fixes ventilation step switch for hoods (attempt 3)

### V4.0.5 (2021-04-08) (The haunting)
* (grizzelbee) Fix: fixes ventilation step switch for hoods (attempt 2)
* (grizzelbee) Fix: fixes error on creating TargetTemperature data points

### V4.0.4 (2021-04-07) (Wastelands)
* (grizzelbee) Fix: fixes ventilation step switch for hoods
* (grizzelbee) Fix: fixed missing getLightState

### V4.0.3 (2021-04-07) (The raven child)
* (grizzelbee) Fix: [109](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/109) fixes 404 error when querying possible actions for device.
* (grizzelbee) Fix: fixes errors when executing actions on devices with API-Id!=fabNumber

### V4.0.2 (2021-04-07) (Angel of Babylon)
* (grizzelbee) Fix: [107](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/107) fixes #107 and 404 error when device is unknown.

### V4.0.1 (2021-04-06) (Sign of the cross)
* (grizzelbee) Fix: [90](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/90) setting the targetTemperature should work now.
* (grizzelbee) Fix: [96](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/96) Added missing ACTIONS.Action_Information again
* (grizzelbee) Fix: [97](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/97) removed unneeded additional "VentilationStep/Lüfterstufe" in path and fixed warning with this. VentilationStep-switch should work properly now.
* (grizzelbee) Fix: [98](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/98) Color-Action has now valid type 'String'
* (grizzelbee) Fix: [102](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/102) Fixed ACTIONS.VentilationStep has no existing object
* (grizzelbee) Fix: Power switch is write protected now when in state 'None'. State 'None' means: No action permitted.
* (grizzelbee) Fix: Light switch is write protected now when in state 'None'. State 'None' means: No action permitted.
* (grizzelbee) Fix: http error 404 will be catched when requesting device actions

### V4.0.0 (2021-03-18) (Symphony of life)
> ***Hint:*** The adapter received a complete code refactoring! This means that most of the code has been changed and some parts are working now differently than ever before. Update with care and read the change log!
* (grizzelbee) New: FULL support of Miele cloud API v1.0.4
* (grizzelbee) Upd: [83](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/83) estimatedEndTime isn't shown anymore after the device has finished
* (grizzelbee) Upd: [85](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/85) full code refactoring and split into multiple files.
* (grizzelbee) Upd: [86](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/86) every folder and device now gets a nice little icon
* (grizzelbee) Upd: [89](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/89) Washer dryers are fully supported now
* (grizzelbee) Upd: [90](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/90) implemented targetTemperature for fridges & freezers
* (grizzelbee) Upd: Devices get fully created on startup and aren't modified afterwards - only updated
* (grizzelbee) Upd: New folder ecoFeedback to group ecoFeedback states
* (grizzelbee) Upd: New folder IDENT to group ident states
* (grizzelbee) Upd: Removed signalActionRequired - since there is no signalDoor for washing machines, dryers and dishwashers this approach doesn't work
* (grizzelbee) Upd: All folders and states which are being created depend on the capabilities of their devices as described in [this Miele documentation](https://www.miele.com/developer/assets/API_V1.x.x_capabilities_by_device.pdf). So there shouldn't be useless states anymore caused by the generic Miele cloud API.

### V3.0.2 (2021-03-05)
* (grizzelbee) Fix: [79](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/79) When a devices serial is missing, the identNumber is assigned instead.
* (grizzelbee) Upd: Changed folder name cooktops to hobs since this is the more common name
* (grizzelbee) Upd: added PowerOn/Off buttons for Coffee-systems & hoods
* (grizzelbee) Upd: [74](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/74) testing actions better before sending to permit errors

### V3.0.1 (2021-02-25)
> *Hint:* Action_Information and Action_Status objects are created on first action execution and contain infos to the last executed action.
> Please take care of notes regarding [Controlling your devices](#Controlling your devices).
* (grizzelbee) Upd: Improved logging in some parts - objects get stringified.
* (grizzelbee) Fix: [74](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/74) Actions are working again
* (grizzelbee) Upd: Actions are tested before sending whether they are permitted in current device state
* (grizzelbee) Upd: estimatedEndTime doesn't show seconds anymore
* (grizzelbee) Upd: Improved documentation
* (grizzelbee) Upd: removed unused function decrypt
* (grizzelbee) Upd: removed superfluent parameters


### V3.0.0 (2021-02-18)
> Hint: ecoFeedback objects are created on the first run of the device. This allows to only create them, when they contain data.
* (grizzelbee) New: BREAKING CHANGE: Making use of build-in password de-/encryption. This raises the need to re-enter your passwords again, because the old ones can't be decrypted anymore.
* (grizzelbee) New: [70](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/70) Implements Miele API 1.0.4
* (grizzelbee) New: [64](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/64) Introduces data point estimatedFinishingTime
* (grizzelbee) New: [54](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/54) Poll interval can now freely be selected in seconds and minutes
* (grizzelbee) Upd: [73](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/73) BREAKING CHANGE: Removed white-spaces from any ID in device tree. This creates completely new device trees. So please delete the old ones.
* (grizzelbee) Upd: removed david-dm badge
* (grizzelbee) Upd: updated dependencies
* (grizzelbee) Fix: added passwords to encryptedNative
* (grizzelbee) Fix: added passwords to protectedNative
* (grizzelbee) Fix: [63](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/63) added missing info.connection object to io-package
* (grizzelbee) Fix: [63](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/63) Fixed new Warnings introduced with js-controller 3.2
* (grizzelbee) Fix: [74](https://github.com/Grizzelbee/ioBroker.mielecloudservice/issues/74) Light-Actions should work now

### V2.0.3 (2020-09-15)
* (grizzelbee) Upd: Updated country list in config dialog
* (grizzelbee) New: Some more debug code

### V2.0.2 (2020-09-15)
* (grizzelbee) New: Added some debug Code to find an Error
* (grizzelbee) Fix: fixed error on failed authentication preventing a valid error message

### V2.0.1 (2020-09-14)
* (grizzelbee) New: Added some debug Code to find an Error
* (grizzelbee) Fix: fixed error on logout while invalidating token

### V2.0.0 - Support for Miele API V1.0.3 (2020-08-25)
Some breaking changes in this release. Some data points changed their type. May require fixes in scripts. **Update with care!**
Due to the fix that data points with invalid values aren't created any longer, I recommend deleting all data points in Object view.
* (grizzelbee) Change: New Icon
* (grizzelbee) Fix: Number-data points are no longer created as strings due to their unit. They are correct numbers with units now.
* (grizzelbee) Fix: Unit °Celsius is now shown as °C - not longer °Celsius
* (grizzelbee) New: Introduced support for °Fahrenheit
* (grizzelbee) New: Introduced support for new Value "plateStep" for Hobs.
* (grizzelbee) New: Performing a LogOut from Miele API on shutdown to invalidate the Auth-Tokens.
* (grizzelbee) Fix: Data points with invalid values (null/-32768) are no longer created.

### V1.2.4 (2020-06-09)
* (grizzelbee) Fix: fixed No-Data Bug (introduced in V1.2.3)

### V1.2.3 (2020-06-07)
* (grizzelbee) Upd: fixed snyk badge
* (grizzelbee) Upd: Improved error handling

### V1.2.2 (2020-05-23)
* (grizzelbee) Upd: removed node 8 from testing on travis.com
* (grizzelbee) Fix: signalActionRequired should work better now
* (grizzelbee) Upd: Updated documentation
* (grizzelbee) Upd: Improved error handling in function APISendRequest
* (grizzelbee) Fix: Moved testing of Config to On(Ready) and fixed unit tests with this.

### V1.2.1 (2020-04-22)
* (grizzelbee) New: Introduced new boolean state (**signalActionRequired**) that indicates that the machine has finished running, but a human action, like putting the wet clothes to the dryer, ... is needed. State is cleared automatically when the door of the appliance is opened, or it is restarted. State is implemented for washing machines, tumble dryers, washer dryer and dishwashers. **Doesn't work perfectly currently.**
* (grizzelbee) Upd: Updated Documentation
* (grizzelbee) Fix: Fixed warnings with js-Controller >=3.0 (Issue #23)

### V1.2.0 (2020-04-18)
* (grizzelbee) New: Added new boolean state (**Connected**) that indicates whether the device is connected to WLAN or a gateway.
* (grizzelbee) New: Added new boolean state (**signalInUse**) that indicates whether the device is switched off (false) or in Use (true).
* (grizzelbee) Change: replaced the deprecated http-library **request** with **axios**
* (grizzelbee) Change: Made functions communicating with API asynchronous

### V1.1.0 (2020-03-07)
* (grizzelbee) New: Added Actions - Implemented all currently supported and documented Actions for all devices.
> Please remember that Actions will only work if you put your device into the appropriate state (e.g. Mobile Control)
please refer to [Miele-Documentation](#documentation) for more Information on actions.

### V1.0.5 (2020-02-14)
* (grizzelbee) removed node-schedule as a dependency
* (grizzelbee) implemented scheduling via setTimeout, which raises the opportunity
  to schedule with less than a minute in the future

### V1.0.4 (2020-02-12)
* (grizzelbee) removed unneeded setTimeout from main
* (grizzelbee) Clearing scheduler on unload of adapter
* (grizzelbee) Minor updates and fixed typos in Readme

### V1.0.3 (2020-02-06)
* (grizzelbee) removed an overseen logging of Passwords
* (grizzelbee) Fixed createTemperatureDatapoint to work with less than 3 values delivered from API
* (grizzelbee) Added some documentation
* (grizzelbee) Started implementation of DeviceActions


### V1.0.2 (2020-02-05)
* (grizzelbee) removed any logging of Passwords
* (grizzelbee) Fixed bug in config interface introduced during password encryption that config values aren't loaded properly

### V1.0.1 (2020-02-04)
* (grizzelbee) Fixes in environment for getting adapter into the Repo
* (grizzelbee) Passwords are stored encrypted now

### V1.0.0 (2020-02-03)
* (grizzelbee) renamed to MieleCloudService to get the ability to publish; the old Name is still blocked by hash99
* (grizzelbee) Rewritten adapter from scratch - therefore it's incompatible with prior versions and needs to be installed freshly.
* (grizzelbee) Fix: fixed all build-errors
* (grizzelbee) Fix: Fixed "NRefreshToken is not a function"-Bug
* (grizzelbee) Chg: removed Push-API checkbox (maybe introduced newly when API supports this)
* (grizzelbee) Chg: New Icon
* (grizzelbee) New: added support for non-german Miele-Accounts (ALL should be included)
* (grizzelbee) Complete new layout of data points
* (grizzelbee) Device types are grouped now

### 0.9.1 (2019-07-26)
* (grizzelbee) Fix: Fixed small bug introduced in V0.9.0 throwing an exception in debugging code

### 0.9.0 (2019-07-26)
* (grizzelbee) Upd: New versioning due to completeness and stability of the adapter (about 90%)
* (grizzelbee) New: make poll interval configurable  (currently 1,2,3,4,5,7,10,15 Minutes)
* (grizzelbee) Fix: fixed ESLint config
* (grizzelbee) Upd: Changed order of config fields in UI
* (grizzelbee) New: Set 5 Minutes poll interval and english response language as default to get initial values
* (grizzelbee) New: Parent-Datapoint of time values will be used to get a pretty readable time in the format h:mm. The deeper datapoints 0 and 1 will still be updated, but his will be removed in a future version to reduce workload.

### 0.0.5 (2019-07-25)
* (grizzelbee) Upd: some code maintenance
* (grizzelbee) New: added reply-language to config
   - Miele API is currently able to reply in German or English, now you can choose.
* (grizzelbee) New: created new Icon
* (grizzelbee) Fix: fixed translation issues and translated adapter UI using gulp
* (grizzelbee) Upd: Made changes to travis requested by apollon77

### 0.0.4
* (hash99) add devices configuration

### 0.0.3
* (hash99) adapter conform

### 0.0.1
* (hash99) initial release

## sentry.io
This adapter uses sentry.io to collect details on crashes and report it automated to the author. The [ioBroker.sentry](https://github.com/ioBroker/plugin-sentry)
plugin is used for it. Please refer to the [plugin homepage](https://github.com/ioBroker/plugin-sentry) for detailed information
on what the plugin does, which information is collected and how to disable it, if you don't like to support the author with
your information on crashes.

## License
The MIT License (MIT)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

## Copyright
Copyright (c) 2024 grizzelbee <open.source@hingsen.de>
