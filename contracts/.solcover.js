
module.exports = {
    skipFiles: [
      '0x',
      'sushiswap'
    ],
    mocha: {
      fgrep: '[skip-on-coverage]',
      invert: true,
    },
  }