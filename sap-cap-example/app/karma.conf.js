module.exports = function (config) {
  "use strict";

  config.set({
    frameworks: ["ui5"], ui5: {
      type: "application",
      configPath: "example01/ui5.yaml",
      paths: {
        webapp: "example01/webapp"
      }
    },
    browsers: ["Chrome"],
    browserConsoleLogOptions: {
      level: "error"
    }
  });
};
