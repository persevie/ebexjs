const { execSync } = require("child_process");
const fs = require("fs");
var pjson = require("../src/package.json");
const directoryExists = require("./directoryExists");

const moduleName = pjson.name.split("/")[1];

const releaseType = process.argv[2];

if (!releaseType || !["major", "minor", "patch"].includes(releaseType)) {
    console.error("Please provide a valid release type: major, minor, patch");
    process.exit(1);
}

const dir = "packages";

if (!directoryExists(dir)) {
    console.error(
        `Directory "${dir}" doesn't exists. Please run "npm run build" first`,
    );
    process.exit(1);
}

try {
    console.log(`Set new version to ${moduleName}...`);
    execSync(`npm --prefix src/ version ${releaseType}`, {
        stdio: "inherit",
    });

    console.log(`Copying package.json of ${moduleName} module...`);
    fs.copyFileSync("src/package.json", "packages/package.json");

    console.log(`Publishing ${moduleName}...`);
    execSync("cd ./packages && npm publish", {
        stdio: "inherit",
    });

    console.log(`Removing build ${moduleName}...`);
    execSync("rm -rf ./packages", {
        stdio: "inherit",
    });
} catch (error) {
    console.error(error);
    process.exit(1);
}
