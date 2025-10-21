/**
 *  This file contains all types for the adapter
 */
type actionsMsg = {
    "processAction": number[],
    "light": number[],
    "ambientLight": number[],
    "startTime": number[],
    "ventilationStep": number[],
    "programId": number[],
    "targetTemperature": {
        "zone": number,
        "min": number,
        "max": number
    },
    "deviceName": string,
    "powerOn": boolean,
    "powerOff": boolean,
    "colors": string[],
    "modes": number[],
    "runOnTime": number[]
}

type identMsg = {
    "type": {
        "key_localized": string,
        "value_raw": number,
        "value_localized": string
    },deviceName: string,
    protocolVersion: number,
    deviceIdentLabel: {
        fabNumber: string,
        fabIndex: string,
        techType: string,
        matNumber: string,
        swids: string[]
    },
    xkmIdentLabel: {
        techType: string,
        releaseVersion: string
    }
}
type stateMsg = {
    ProgramID: {
        value_raw: number,
        value_localized: string,
        key_localized: string
    },
    status: {
        value_raw: number,
        value_localized: string,
        key_localized: string
    },
    programType: {
        value_raw: number,
        value_localized: string,
        key_localized: string
    },
    programPhase: {
        value_raw: number,
        value_localized: string,
        key_localized: string
    },
    remainingTime: number[],
    startTime: number[],
    targetTemperature: [
        {
            value_raw: number,
            value_localized: string,
            unit: string
        }
    ],
    coreTargetTemperature: [
        {
            value_raw: number,
            value_localized: string,
            unit: string
        }
    ],
    temperature: [
        {
            value_raw: number,
            value_localized: string,
            unit: string
        }
    ],
    coreTemperature: [
        {
            value_raw: number,
            value_localized: string,
            unit: string
        }
    ],
    signalInfo: boolean,
    signalFailure: boolean,
    signalDoor: boolean,
    remoteEnable: {
        fullRemoteControl: boolean,
        smartGrid: boolean,
        mobileStart: boolean
    },
    light: number,
    elapsedTime: number[],
    spinningSpeed: {
        unit: string,
        value_raw: number,
        value_localized: string,
        key_localized: string
    },
    dryingStep: {
        value_raw: number,
        value_localized: string,
        key_localized: string
    },
    ventilationStep: {
        value_raw: number,
        value_localized: string,
        key_localized: string
    },
    plateStep: [
        {
            value_raw: number,
            value_localized: string,
            key_localized: string
        }
    ],
    ecoFeedback: {
        currentWaterConsumption: {
            unit: string,
            value: number
        },
        currentEnergyConsumption: {
            unit: string,
            value: number
        },
        waterForecast: number,
        energyForecast: number
    },
    batteryLevel: number
}

type deviceMsg = {
    "ident": identMsg,
    "state": stateMsg
};

type devicesMsg = {
    "DeviceID": deviceMsg[]
}

type fillingLevels =
    [{
        "deviceId":
            {
                "fillingLevels":
                    {
                        "twinDosContainer1FillingLevel": number,
                        "twinDosContainer2FillingLevel": number,
                        "powerDiscFillingLevel": number,
                        "saltFillingLevel": number
                        ,"rinseAidFillingLevel": number,
                        "coalFilterSaturation": number,
                        "fatFilterSaturation": number,
                        "descalingCounter": number,
                        "degreasingCounter": number,
                        "milkCleaningCounter": number
                    }
            }
        }]

type errorMsg =
{
    "message": string,
    "errorNumber": number
}

type programs =
    [{
        "programId": number
        "program": string,
        "parameters": {
            "temperature": {
                "min": number,
                "max": number,
                "step": number,
                "mandatory": boolean
            },
            "duration": {
                "min": number[],
                "max": number[],
                "mandatory": boolean
            }
        }
}]

type rooms =
    [{
        "mapId": number,
        "rooms": [{
            "name": string,
            "roomId": number
        }]
}]

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {actionsMsg, identMsg, stateMsg, deviceMsg, devicesMsg, fillingLevels, errorMsg, programs, rooms};