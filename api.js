const axios = require("axios");
const fs = require('fs');
const xlsx = require('xlsx');
const stream = require('stream')

xlsx.stream.set_readable(stream.Readable);

const classUrl = "https://files.registrar.uconn.edu/registrar_public/All_Classes_Table_Format_Spring.xlsx"
const contentAreaUrl = "https://files.registrar.uconn.edu/registrar_public/CS_reports/Courses_CA_All_Active.xlsx"
const classFpath = "class.xlsx";

// download the target xlsx workbook
async function getClassListAsFile(url=classUrl, fpath=classFpath) {
  const writer = fs.createWriteStream(fpath);
  return axios({
    method: 'GET',
    url: url,
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

// convert xlsx workbook to json
async function xlsxToJson(workbook=null) {
  if (workbook == null) return await getClassListAsJson().then(workbook => {
    // grab the only sheet
    let worksheet = workbook.Sheets[workbook.SheetNames[0]]
    let jsonWorksheet = xlsx.utils.sheet_to_json(worksheet);
    console.log("Worksheet converted to json");
    return jsonWorksheet;
  })
  else return xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
}

// returns xlsx workbook object
async function getClassListAsJson(url=classUrl) {
  return axios({
    method: 'GET',
    url: url,
    responseType: 'stream',
  }).then(res => {
    return new Promise((resolve, reject) => {
      // stream directly into 
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
      readable.on("end", async () => {
        if (!error) {
          console.log("Grabbed xlsx file");
          let buf = Buffer.concat(bufs);
          let workbook = xlsx.read(buf);
          let jsonWorksheet = await xlsxToJson(workbook);
          resolve(jsonWorksheet);
        }
      })
    })
  })
}

// What we need/can get from the spreadsheet
//  term, sessionType*, campus, courseNum, courseId, catalogNum,
//  subject(ACCT), subjectLong(Accounting)
//  section, component(LEC), componentLong(Lecture)
//  desc, TODO: get long desc from scraping
//  meetDays, startTime, endTime
//  school (engr, arts, etc...), profFname, profLname, instructType(Online)
//  enrollCapacity, enrollTotal, waitCapacity, waitTotal
//  TODO: multiple prof support?

async function getOrganizedJson(cd=null) {
  if (cd == null) cd = await getClassListAsJson();
  const caData = await getContentAreaClasses();

  let promises = []
  for (let i=0; i<cd.length; i++) {
    promises[i] = new Promise((resolve, reject) => {
      // fullname seperation (if there is one)
      let fullname = [null, null];
      let mInit = null
      try {
        fullname = cd[i].Define_CLASSM_INSTRUCTOR_NAME.split(',')
        mInit = fullname[1].split(" ")[1].slice(0, -1);
        fullname[1] = fullname[1].split(" ")[0];
      } catch (err) { } // empty fullname section AKA multiple instructors

      // check for contentarea
      let caObj = caData.find(obj => { return obj.subject===cd[i].CLASS_SUBJECT_CD && obj.catalogNum===cd[i].CLASS_CATALOG_NBR; })
      let ca = null;
      if (caObj) { ca = caObj.contentArea; }
      

      // return the organized object (no OOP >:( )
      resolve({
        term: cd[i].CLASS_TERM_LDESC, // Ex. Spring 2022
        sessionType: cd[i].CLASS_SESSION_LDESC, // Ex. Regular Academic
        campus: cd[i].CLASS_CAMPUS_LDESC,
        // I'm not sure we need these but its here
        courseNum: cd[i].CLASS_CLASS_NBR,
        courseId: cd[i].CLASS_COURSE_ID,
        catalogNum: cd[i].CLASS_CATALOG_NBR, // tells if class is Q, W, or E. Could be seperated here
        subject: cd[i].CLASS_SUBJECT_CD, // Ex. ACCT
        subjectLong: cd[i].CLASS_SUBJECT_LDESC, // Ex. Accounting
        section: cd[i].CLASS_SECTION,
        component: cd[i].CLASS_COMPONENT_CD, // LEC, LAB, etc...
        componentLong: cd[i].CLASS_COMPONENT_LDESC, // Lecture, Lab, etc...
        desc: cd[i].CLASS_DESCR, // Aka long title
        descLong: null, //TODO: get long description from scraping
        meetDays: {
          MON: cd[i].CLASSM_MONDAY,
          TUE: cd[i].CLASSM_TUESDAY,
          WED: cd[i].CLASSM_WEDNESDAY,
          THUR: cd[i].CLASSM_THURSDAY,
          FRI: cd[i].CLASSM_FRIDAY,
          SAT: cd[i].CLASSM_SATURDAY,
          SUN: cd[i].CLASSM_SUNDAY,
        },
        // TODO: find out what format we want the time to be in
        // we'd set it up there
        startTime: cd[i].CLASSM_MEETING_TIME_START,
        endTime: cd[i].CLASSM_MEETING_TIME_START,
        school: null, //TODO: get school type
        // could have this hold profData too? 
        // depends if we want it to be two seperate requests
        profFname: fullname[0],
        profLname: fullname[1],
        profMinit: mInit,
        instructType: cd[i].CLASS_INSTRUCTION_MODE_LDESC, // Online, Distant Learning, In Person
        enrollCapacity: cd[i].CLASS_ENRL_CAP,
        enrollTotal: cd[i].CLASS_ENRL_TOT,
        waitCapacity: cd[i].CLASS_WAIT_CAP,
        waitTotal: cd[i].CLASS_WAIT_TOT,
        contentArea: ca, 
      })
    })
  }
  
  try {
    let data = []
    await Promise.all(promises).then(vals => {
      // console.log(vals);
      for (let i=0; i<vals.length; i++) {
        data = data.concat(vals[i]);
      }
    });
    return data;
  } catch (err) {
    console.error(err);
  }
}

async function getContentAreaClasses() {
  let data = await getClassListAsJson(contentAreaUrl);
  for (let i=0; i<data.length; i++) {
    data[i] = {
      contentArea: data[i].CA,
      subject: data[i].SUBJ,
      catalogNum: data[i]['CAT NBR']
    }
  }
  return data;
}

module.exports = {
  getClassListAsFile,
  xlsxToJson,
  getClassListAsJson,
  getOrganizedJson,
  getContentAreaClasses,
}
