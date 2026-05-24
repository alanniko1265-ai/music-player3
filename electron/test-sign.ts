import { sign } from './qq-music-sign'

console.log('sign("test"):', sign('test'))
console.log('sign({key: "value"}):', sign({ key: 'value' }))
console.log('sign("hello world"):', sign('hello world'))

// Test determinism
const result1 = sign('test')
const result2 = sign('test')
// The hash suffix should be the same even if prefix differs (due to random component)
console.log('result1:', result1)
console.log('result2:', result2)
console.log('Both start with "zza":', result1.startsWith('zza') && result2.startsWith('zza'))
