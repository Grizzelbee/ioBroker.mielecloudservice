![Logo](admin/mieleathome.png)
# ioBroker.mieleathome
![Number of Installations](http://iobroker.live/badges/mieleathome-installed.svg) ![Number of Installations](http://iobroker.live/badges/mieleathome-stable.svg) =================

This adapter is a Miele@Home for Miele API. 


## Steps 
To install, excecute the following command 
in /opt/iobroker/node_modules:

1. Install via Admin: https://github.com/Grizzelbee/ioBroker.mieleathome.git

2. create an account for Miele@Home 

3. Add the Miele-Device to the App

4. Get client_secret and client_id from Miele-developer Team via Mail: developer@miele.com.

3. Fill in the client_secret and client_id received from Miele-developer Team and acoount-id and password.


## Requirements

Miele@Home Account
Client_secret
Client_id

## Changelog

### 0.0.1
* (hash99) initial release

### 0.0.3
* (hash99) adapter conform

### 0.0.4
* (hash99) add devices configuration

### 0.0.5
* (grizzelbee) Upd: some code maintenance
* (grizzelbee) New: added reply-language to config
                    - Miele API is currently able to reply in German or English, now you can choose.
* (grizzelbee) New: created new Icon
* (grizzelbee) Fix: fixed translation issues and translated adapter UI using gulp
* (grizzelbee) Upd: Made changes to travis requested by apollon77

### 0.9.0
* (grizzelbee) Upd: New versioning due to completeness and stability of the adapter (about 90%)
* (grizzelbee) New: make poll interval configurable
* (grizzelbee) Fix: fixed ESLint config
* (grizzelbee) Upd: Changed order of config fields in UI
* (grizzelbee) New: Set 5 Minutes poll interval and english response language as default to get initial values 
* (grizzelbee) New: Parent-Datapoint of timevalues will be used to get a pretty readable time in the format h:mm. The deeper datapoints 0 and 1 will still be updated, but his will be removed removed in a future version to reduce workload.  
 
## Next Steps
* Device Integration rdevice type related Button-Creation
* add support for UK Miele-Accounts (-> vg: de-DE | en-EN)


## License
The MIT License (MIT)

Copyright (c) 2019 Hash99 <hash99@iesy.net>

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
