const axios = require("axios");
const fs = require('fs');
const xlsx = require('xlsx');
const stream = require('stream')

xlsx.stream.set_readable(stream.Readable);

const classUrl = "https://files.registrar.uconn.edu/registrar_public/All_Classes_Table_Format_Spring.xlsx"
const classFpath = "class.xlsx";

async function getClassListAsFile() {
  const writer = fs.createWriteStream(classFpath);
  return axios({
    method: 'GET',
    url: classUrl,
    responseType: 'stream',
  }).then(res => {
    return new Promise((resolve, reject) => {
      res.data.pipe(writer);
      let error = null;
      writer.on('error', err => {
        error = err;
        writer.close();
        reject(err);
      })
      writer.on('close', () => {
        if (!error) {
          resolve(true);
        }
      })
    })
  })
}

async function xlsxToJson() {
  getClassListAsJson().then(workbook => {
    // grab the only sheet
    let worksheet = workbook.Sheets[workbook.SheetNames[0]]
    let jsonWorksheet = xlsx.utils.sheet_to_json(worksheet);
    console.log(jsonWorksheet);
  })
}

async function getClassListAsJson() {
  return axios({
    method: 'GET',
    url: classUrl,
    responseType: 'stream',
  }).then(res => {
    return new Promise((resolve, reject) => {
      const readable = stream.Readable.from(res.data);
      let error = null;
      let bufs = []
      
      readable.on("data", (chunk) => {
        // console.log(chunk)
        bufs.push(chunk);
      })
      readable.on('error', (err) => {
        error = err;
        reject(err);
      })
      readable.on("end", () => {
        if (!error) {
          let buf = Buffer.concat(bufs);
          let workbook = xlsx.read(buf);
          console.log("Got buffer to workbook");
          resolve(workbook);
        }
      })
    })
  })
}

module.exports = {
  getClassListAsFile,
  xlsxToJson,
  getClassListAsJson
}
