import type { Config } from "@jest/types";

const config: Config.InitialOptions = {
    verbose: true,
    transform: {
        "^.+\\.ts?$": "ts-jest",
    },
    rootDir: "./src",
    testEnvironmentOptions: {
        customExportConditions: ["jsdom", "node", "node-addons"],
    },
    testEnvironment: "jsdom",
    preset: "ts-jest",
    collectCoverage: true,
    collectCoverageFrom: [
        "**/*.{js,jsx,ts,tsx}",
        "!**/node_modules/**",
        "!**/vendor/**",
        "!**/packages/**",
        "!**/coverage/**",
        "!**/*.config.{js,ts}",
        "!**/index.ts",
    ],
    coverageThreshold: {
        global: {
            branches: 10,
            functions: 10,
            lines: 10,
            statements: 10,
        },
    },
    coverageReporters: ["lcov", "text"],
};
export default config;
