import assert from "node:assert/strict";
import test from "node:test";
import { starterCloset } from "../lib/demo-data.ts";
import { generateDailyDecision } from "../lib/outfit-engine.ts";
import { analyzeShoppingCandidate, shoppingSimilarity } from "../lib/shopping-decision.ts";
import { decryptCalendarToken, encryptCalendarToken, normalizeCalendarTitle } from "../lib/calendar-security.ts";

const owned=(id)=>({...starterCloset.find(item=>item.id===id),inventoryType:"owned",active:true,laundry:false});
const context={date:"2026-08-24",timezone:"America/Chicago",dayType:"Office",activities:["Office"],source:"manual",weather:{departureFeelsLike:68,dayHigh:74,eveningFeelsLike:65,rainProbability:10,walking:true}};
const profile={preferredFormality:3,favoriteColors:["Pale blue","Charcoal"],avoidRules:[],styleVibe:"Polished feminine"};

test("owned engine builds only complete owned outfits",()=>{
  const garments=[owned("g02"),owned("g04"),owned("g09"),owned("g06")];
  const decision=generateDailyDecision({garments,context,profile,now:new Date("2026-08-24T12:00:00Z")});
  assert.ok(decision.recommendations.length>=1);
  for(const recommendation of decision.recommendations){assert.ok(recommendation.garmentIds.every(id=>garments.some(item=>item.id===id)));assert.ok(recommendation.garmentIds.includes("g02"));assert.ok(recommendation.garmentIds.includes("g04"));assert.ok(recommendation.garmentIds.includes("g09"));}
});

test("owned engine never fills a missing slot with starter samples",()=>{
  const decision=generateDailyDecision({garments:[owned("g02"),owned("g04")],context,profile});
  assert.equal(decision.recommendations.length,0);assert.deepEqual(decision.missingCategories,["Shoes","Outerwear"]);assert.equal(decision.cta,"Add shoes");
});

test("laundry and recent wear remove or penalize pieces",()=>{
  const shoe=owned("g09");shoe.laundry=true;const decision=generateDailyDecision({garments:[owned("g02"),owned("g04"),shoe],context,profile});assert.equal(decision.recommendations.length,0);
  const available={...shoe,laundry:false};const worn=generateDailyDecision({garments:[owned("g02"),owned("g04"),available,owned("g06")],context,profile,signals:[{garmentIds:["g02","g04","g09","g06"],wornOn:"2026-08-23",style:"not_for_me"}],now:new Date("2026-08-24T12:00:00Z")});assert.ok(worn.recommendations[0].factors.rotation<0);assert.ok(worn.recommendations[0].factors.feedback<0);
});

test("shopping similarity and thresholds produce truthful guidance",()=>{
  const garments=[owned("g02"),owned("g04"),owned("g09"),owned("g06")];
  const candidate={name:"Blue relaxed shirt",category:"Tops",subcategory:"Button-down",color:"Pale blue",material:"Cotton",pattern:"Solid",silhouette:"Button-down",formality:3,warmth:2,occasions:["Office"],confidence:.95,rainCompatible:true};
  assert.ok(shoppingSimilarity(candidate,garments[0]).score>=.65);
  const result=analyzeShoppingCandidate({candidate,garments,context,profile});assert.ok(["save","skip"].includes(result.decision));assert.ok(result.duplicateScore>=.65);
});

test("Calendar normalization never exposes raw titles and tokens round-trip",async()=>{
  assert.equal(normalizeCalendarTitle("Dinner at Aba with Maya"),"Dinner");assert.equal(normalizeCalendarTitle("Client presentation – 123 Main St"),"Office");
  const key=Buffer.alloc(32,7).toString("base64");const encrypted=await encryptCalendarToken("refresh-secret",key);assert.notEqual(encrypted,"refresh-secret");assert.equal(await decryptCalendarToken(encrypted,key),"refresh-secret");
});
