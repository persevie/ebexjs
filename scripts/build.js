const { execSync } = require("child_process");
var pjson = require("../src/package.json");

const moduleName = pjson.name.split("/")[1];

try {
    console.log(`Testing "${moduleName}" module before building ...`);
    execSync("npm run test", {
        stdio: "inherit",
    });

    console.log(`Building ${moduleName}...`);
    execSync("rollup --config rollup.config.js", {
        stdio: "inherit",
    });
    console.log(`Build of ${moduleName} completed`);
} catch (error) {
    console.error(error);
    process.exit(1);
}
