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
                    - Miele API is currently able to answer in German or English, now you can choose.
* (grizzelbee) New: created new Icon
* (grizzelbee) Fix: fixed translation issues and translated adapter UI using gulp


## Next Steps
* Device Integration rdevice type related Button-Creation
* add support for UK Miele-Accounts (-> vg: de-DE | en-EN)
* create automatically new datapoint for combined nicely shown time values
  currently elapsedTime and remainingTime are quite useless cause hours and minutes are separate values and minutes are shown without leading 0
  combine these values into a new datapoint to "h:mm" values
* make poll interval configurable (currently 10 Minutes)


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
