// This file extends the AdapterConfig type from "@types/iobroker"
// using the actual properties present in io-package.json
// in order to provide typings for adapter.config properties

type tokenSet = {
    access_token: string,
    refresh_token: string,
    token_type: string,
    expires_in: number,
    refresh_expires_in: number,
    obtained: number,
    ping: number,
    obtained_HR: string
}

type tokenMsg = {
    access_token: string,
    refresh_token: string,
    token_type: string,
    expires_in: number,
    refresh_expires_in: number,
    obtained: number,
    ping: number,
    id_token: string,
    obtained_HR: string
}
// this is required so the above AdapterConfig is found by TypeScript / type checking
export {tokenSet, tokenMsg};