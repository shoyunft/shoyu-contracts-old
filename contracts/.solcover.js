
module.exports = {
    skipFiles: [
      'sushiswap',
      'mocks',
    ],
    mocha: {
      fgrep: '[skip-on-coverage]',
      invert: true,
    },
  }