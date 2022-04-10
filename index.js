const api = require("./api.js");

// api.getClassList().then(() => { console.log("File downloaded"); });
api.getOrganizedJson().then(data => {
  console.log(data);
})


// api.getContentAreaClasses().then((data) => {
//   let catnbr = 'CAT NBR'
//   console.log(data[0])
//   console.log(data[0]['CAT NBR'])
// })

module.exports = {
  
}
