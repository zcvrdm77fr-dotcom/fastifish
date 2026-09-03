import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter, securityHeaders, _resetRateLimitersForTests } from '../security.js';

function mockRes(){
  return {
    headers:new Map(), statusCode:200, body:null,
    setHeader(k,v){ this.headers.set(k,v); },
    status(code){ this.statusCode=code; return this; },
    json(body){ this.body=body; return this; }
  };
}

test('securityHeaders asettaa perusotsakkeet', () => {
  const res=mockRes(); let nextCalled=false;
  securityHeaders({},res,()=>{nextCalled=true;});
  assert.equal(res.headers.get('X-Content-Type-Options'),'nosniff');
  assert.equal(res.headers.get('X-Frame-Options'),'DENY');
  assert.equal(nextCalled,true);
});

test('rate limiter pysäyttää rajan ylittävän pyynnön', () => {
  _resetRateLimitersForTests();
  const limiter=createRateLimiter({windowMs:60000,max:2,keyPrefix:'test'});
  const req={ip:'127.0.0.1'};
  const first=mockRes(); const second=mockRes(); const third=mockRes();
  let passed=0;
  limiter(req,first,()=>passed++);
  limiter(req,second,()=>passed++);
  limiter(req,third,()=>passed++);
  assert.equal(passed,2);
  assert.equal(third.statusCode,429);
  assert.match(third.body.error,/Liikaa pyyntöjä/);
});
