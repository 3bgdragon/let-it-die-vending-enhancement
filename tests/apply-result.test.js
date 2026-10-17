'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{format}=require('../src/apply-result'),language=require('../src/language');
for(const lang of ['ko','en']){
 test('first install reports its real new backup, '+lang,()=>{language.setLanguage(lang);const text=format({changed:true,rows:106,backup:'GAME/LID-Mod-State/backups/NEW',backupDirectory:'GAME/LID-Mod-State/backups'});assert(text.includes('106'));assert(text.includes('GAME/LID-Mod-State/backups/NEW'));assert(!text.includes('undefined'));});
 test('no-op explicitly reports no new backup, '+lang,()=>{language.setLanguage(lang);const text=format({changed:false,rows:106,backup:null,existingBackups:1,backupDirectory:'GAME/LID-Mod-State/backups'});assert(text.includes(lang==='ko'?'새 백업을 만들지 않았습니다':'no new backup'));assert(text.includes(lang==='ko'?'기존 자판기 백업 기록: 1':'Existing vending backup records: 1'));assert(!text.includes('null'));});
 test('missing backup records produce a warning, '+lang,()=>{language.setLanguage(lang);const text=format({changed:false,rows:106,backup:null,existingBackups:0,backupDirectory:'GAME/LID-Mod-State/backups'});assert(text.includes(lang==='ko'?'주의:':'Warning:'));});
 test('repair reports actual repaired rows separately from full catalog size, '+lang,()=>{language.setLanguage(lang);const text=format({changed:true,rows:106,repairedMaterials:5,backup:'NEW',backupDirectory:'ROOT'});assert(text.includes(lang==='ko'?'복구: 5':'restored: 5'));});
}
