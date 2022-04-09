const api = require("./api.js");

// api.getClassList().then(() => { console.log("File downloaded"); });
api.xlsxToJson();

const xlsxToJson = () => {
  return api.xlsxToJson();
}

module.exports = {
  xlsxToJson
}
