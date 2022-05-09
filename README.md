This repository is a monorepo including the ShoyuNFT exchange smart contracts and sdk. Each public sub-package is independently published to NPM.

[![Coverage Status](https://coveralls.io/repos/github/shoyunft/shoyu-contracts/badge.svg?branch=master)](https://coveralls.io/github/shoyunft/shoyu-contracts?branch=master)

## Packages

### Solidity Packages

TODO

### TypeScript/Javascript Packages

| Package                         | Version                                                                                         | Description              |
| ------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------ |
| [`shoyunft-sdk`](/packages/sdk) | [![npm](https://img.shields.io/npm/v/shoyunft-sdk)](https://www.npmjs.com/package/shoyunft-sdk) | Shoyu Exchange Contracts |

## Usage

### Prerequisites

- Yarn (If unfamilair consult https://yarnpkg.com/getting-started/install to get started and familiarise yourself)
- Node v16.5.0 (Can be set with `nvm use`)

### Install dependencies

```sh
yarn
```

### Build all packages

```sh
yarn build
```

### Test all packages

```sh
yarn test
```
