const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const requests=[];
const context={console,AbortController,setTimeout,clearTimeout,
 chrome:{storage:{sync:{get:async()=>({apiReasoning:'medium'})}}},
 fetch:async(url,options)=>{requests.push(JSON.parse(options.body));return {ok:true,status:200,json:async()=>({output_text:'Hello fixture,\n\nMain point.\n\nClosing.'})};}};
vm.createContext(context);
for(const file of ['src/shared/utils.js','src/prompts.js','src/background/openai-service.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
(async()=>{
 const base={apiKey:'fixture',model:'gpt-5.6-sol',prompt:'Write a greeting',includeProfile:false,includeStrategy:false,profile:{name:'Excluded fixture'},strategyCore:'Excluded strategy'};
 assert.equal(await context.LEFOpenAIService.callOpenAIFreePrompt({...base,reasoningEffort:'low'}),'Hello fixture,\n\nMain point.\n\nClosing.');
 assert.equal(context.LEFUtils.clampText('One\n\nTwo',100),'One Two');
 assert.equal(context.LEFUtils.clampText('One\r\n\r\nTwo',100,true),'One\n\nTwo');
 assert(JSON.stringify(requests[0].input).includes('blank line'));
 assert.equal(requests[0].model,'gpt-5.6-sol');assert.equal(requests[0].reasoning.effort,'low');
 assert.equal(requests[0].max_output_tokens,4096);
 assert(!JSON.stringify(requests[0].input).includes('Excluded'));
 await context.LEFOpenAIService.callOpenAIFreePrompt(base);
 assert.equal(requests[1].reasoning.effort,'medium');
 console.log('PASS: API model, reasoning override/default, output budget and context inclusion.');
})().catch(e=>{console.error(e);process.exitCode=1;});
