![Logo](admin/mielecloudservice.png)
# ioBroker.MieleCloudService
![Number of Installations](http://iobroker.live/badges/mielecloudservice-installed.svg)
[![Downloads](https://img.shields.io/npm/dm/iobroker.mielecloudservice.svg)](https://www.npmjs.com/package/iobroker.mielecloudservice)
[![NPM version](https://img.shields.io/npm/v/iobroker.mielecloudservice.svg)](https://www.npmjs.com/package/iobroker.mielecloudservice)
[![License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat)](https://github.com/grizzelbee/iobroker.mielecloudservice/blob/master/LICENSE) 
[![Dependency Status](https://img.shields.io/david/Grizzelbee/iobroker.mieleathome.svg)](https://david-dm.org/Grizzelbee/iobroker.mielecloudservice)
[![Known Vulnerabilities](https://snyk.io/test/github/Grizzelbee/ioBroker.mieleathome/badge.svg)](https://snyk.io/test/github/Grizzelbee/ioBroker.mielecloudservice)
 
 [![NPM](https://nodei.co/npm/iobroker.mielecloudservice.png?downloads=true)](https://nodei.co/npm/iobroker.mielecloudservice/)
 
 **Tests:**: [![Travis-CI](http://img.shields.io/travis/Grizzelbee/ioBroker.mielecloudservice/master.svg)](https://travis-ci.com/Grizzelbee/ioBroker.mielecloudservice)
 
 =================
## Description
This adapter is for retrieving information about all your Miele@Home devices from the official Miele 3rd-party API. 


## Steps 
To install, excecute the following:

1. Install via Admin: https://github.com/Grizzelbee/ioBroker.mielecloudservice.git
2. create an App-Account for Miele@Home in the Miele Smartphone App
3. Create an developer account at https://www.miele.com/f/com/en/register_api.aspx 
4. Add your Miele-Devices to the App (if not added automatically)
6. Fill in the client_secret and client_id received from Miele-developer Team and acoount-id and password from the App.


## Requirements
* Miele@Home User (Smartphone App)
* Miele@Home Password (Smartphone App)
* Miele Client_id (from https://www.miele.com/developer/)
* Miele Client_secret (from https://www.miele.com/developer/ )

## Changelog

### 1.0.0 (2020-02-03)
* (grizzelbee) renamed to MieleCloudService to get the ability to publish; the old Name is still blocked by hash99
* (grizzelbee) Rewritten adapter from scratch - therefor it's incompatible with prior versions and needs to be installed freshly. 
* (grizzelbee) Fix: fixed all build-errors
* (grizzelbee) Fix: Fixed "NRefreshToken is not a function"-Bug 
* (grizzelbee) Chg: removed Push-API checkbox (may be introduced newly when API supports this)
* (grizzelbee) Chg: New Icon
* (grizzelbee) New: added support for Non german Miele-Accounts (ALL should be included)
* (grizzelbee) Completely new layout of datapoints
* (grizzelbee) Devicetypes are grouped now 


### 0.9.1 (2019-07-26)
* (grizzelbee) Fix: Fixed small bug introduced in V0.9.0 throwing an exception in debugging code

### 0.9.0 (2019-07-26)
* (grizzelbee) Upd: New versioning due to completeness and stability of the adapter (about 90%)
* (grizzelbee) New: make poll interval configurable  (currently 1,2,3,4,5,7,10,15 Minutes)
* (grizzelbee) Fix: fixed ESLint config
* (grizzelbee) Upd: Changed order of config fields in UI
* (grizzelbee) New: Set 5 Minutes poll interval and english response language as default to get initial values 
* (grizzelbee) New: Parent-Datapoint of timevalues will be used to get a pretty readable time in the format h:mm. The deeper datapoints 0 and 1 will still be updated, but his will be removed in a future version to reduce workload.  

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

 
## Next Steps
* New: (longer) poll interval when no device is active
* New: Sleeptime for complete inactivity (e.g. at night)


## License
The MIT License (MIT)

Copyright (c) 2019 grizzelbee <captain.tzk@gmail.com>

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
