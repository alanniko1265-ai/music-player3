// Debug: test the sign code execution directly

const signCode = `
(function() {
  var O = (function() {
    if (typeof self !== "undefined") return self;
    if (typeof window !== "undefined") return window;
    if (typeof global !== "undefined") return global;
    throw new Error("unable to locate global object");
  })();
  return typeof O;
})()
`

const result = new Function('return ' + signCode)()
console.log('O type:', result)
