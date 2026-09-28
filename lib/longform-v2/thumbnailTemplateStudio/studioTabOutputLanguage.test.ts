import assert from 'node:assert/strict'
import {
  normalizeTabOutputLanguage,
  tabOutputLanguageShort,
} from './studioTabOutputLanguage'

assert.equal(normalizeTabOutputLanguage('ko'), 'ko')
assert.equal(normalizeTabOutputLanguage('English'), 'English')
assert.equal(normalizeTabOutputLanguage('invalid', 'English'), 'English')
assert.equal(normalizeTabOutputLanguage(undefined, 'ko'), 'ko')
assert.equal(tabOutputLanguageShort('English'), 'EN')
assert.equal(tabOutputLanguageShort('ko'), 'KO')

console.log('studioTabOutputLanguage.test.ts: ok')
