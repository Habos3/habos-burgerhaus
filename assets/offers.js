/* HABOS Aktionspreise — Europe/Berlin, Montag=1 ... Sonntag=0. */
(function(root){
  'use strict';
  const WEEK={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  function berlinClock(now){
    const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now||new Date());
    const f=t=>parts.find(x=>x.type===t)?.value;
    return {day:WEEK[f('weekday')],minutes:Number(f('hour'))*60+Number(f('minute'))};
  }
  function minute(s){
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(s||'')))return null;
    const [h,m]=s.split(':').map(Number);return h*60+m;
  }
  function inSchedule(o,now){
    if(!o||o.enabled!==true)return false;
    const start=minute(o.start),end=minute(o.end);
    if(start===null||end===null||start===end)return false;
    const c=berlinClock(now),days=Array.isArray(o.days)?o.days:[];
    if(start<end)return days.includes(c.day)&&c.minutes>=start&&c.minutes<end;
    // Angebote über Mitternacht: nach 0 Uhr gilt noch der Vortag.
    return (c.minutes>=start&&days.includes(c.day)) ||
      (c.minutes<end&&days.includes((c.day+6)%7));
  }
  function getOffer(settings,p,option,orderType,now){
    const o=settings?.offers||{};
    // Schüler-Angebot hat Vorrang, falls beide Regeln überlappen.
    for(const [key,rule] of [['student',o.student],['happyHour',o.happyHour]]){
      if(!inSchedule(rule,now))continue;
      if(rule.orderType!=='Beides'&&rule.orderType!==orderType)continue;
      if(p.cat!==rule.category)continue;
      if(!String(option).toLowerCase().startsWith(String(rule.size||'').toLowerCase()))continue;
      const names=String(rule.products||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
      if(names.length&&!names.includes(String(p.name||'').toLowerCase()))continue;
      const price=Number(rule.price);
      if(!Number.isFinite(price)||price<0)continue;
      return {key,price:Math.round(price*100)/100,name:key==='student'?'Schüler-Angebot':'Happy Hour'};
    }
    return null;
  }
  function unitPrice(settings,p,option,base,orderType,now){
    const normal=Number(base);
    const offer=getOffer(settings,p,option,orderType,now);
    return offer&&offer.price<normal?{price:offer.price,offer:offer.name}:{price:normal,offer:null};
  }
  const api={berlinClock,inSchedule,getOffer,unitPrice};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.HabosOffers=api;
})(typeof window!=='undefined'?window:globalThis);
