const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const row=[];row[0]='Heber Hansen';row[1]='Sr';row[5]='🏈';row[6]='⚽';
const header=Array(5).fill([]);
const accounts=[['Email','Sub','Athlete Name','Gender','Primary','Role'],['private@globeschools.org','private-sub','Heber Hansen','Male','⚽','Student'],['other@globeschools.org','another-sub','Wrong Name','Male','','Student']];
const sheets={'Athlete Metrics (Male)':[...header,row],'Athlete Metrics (Female)':header,'Web App Accounts':accounts};
const c={console,ContentService:{MimeType:{JSON:'application/json'},createTextOutput:s=>({text:s,setMimeType(){return this;}})},mockSpreadsheet:{getSheetByName:n=>sheets[n]?{getDataRange:()=>({getValues:()=>sheets[n]})}:null}};
vm.createContext(c);vm.runInContext(fs.readFileSync('apps-script/Code.gs','utf8'),c);
vm.runInContext("verifyToken_=()=>({email:'coach@globeschools.org'});getSpreadsheet_=()=>mockSpreadsheet;resolveAccount_=()=>({ok:true,role:'Student'});",c);
const post=()=>JSON.parse(c.doPost({postData:{contents:JSON.stringify({action:'coachProfileReview',idToken:'test'})}}).text);
assert.equal(post().code,'FORBIDDEN');
vm.runInContext("resolveAccount_=()=>({ok:true,role:'Coach'});",c);
const result=post();assert.equal(result.ok,true);assert.equal(result.accountsChecked,2);assert.equal(result.issues.length,1);assert.equal(result.issues[0].type,'Account-link name/gender mismatch');
assert(!JSON.stringify(result).includes('@'));assert(!JSON.stringify(result).includes('private-sub'));
console.log('Account audit denies student requests, checks links, redacts identifiers, and needs no Sheet write methods.');

