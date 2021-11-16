/** @type {import('@types/babel__core').TransformOptions} */
const config = {
  presets: ["@babel/preset-typescript"],
  env: {
    test: {
      presets: ["@babel/preset-typescript"],
    },
  },
};

module.exports = config;
