const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
  moduleNameMapper: {
    "^types$": "<rootDir>/src/types",
    "^utils$": "<rootDir>/src/utils",
    "^server/(.*)$": "<rootDir>/src/server/$1",
    "^clients/(.*)$": "<rootDir>/src/clients/$1",
  },
};