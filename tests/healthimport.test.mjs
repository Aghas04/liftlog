import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChunk } from '../js/healthimport.js';

test('parses bodyweight, body fat and waist with unit conversion', () => {
  const xml = `
  <Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Scale" unit="kg" creationDate="2026-10-01 08:00:00 -0500" startDate="2026-10-01 07:59:00 -0500" endDate="2026-10-01 07:59:00 -0500" value="81.6"/>
  <Record type="HKQuantityTypeIdentifierBodyMass" unit="lb" startDate="2026-10-02 07:00:00 -0500" value="179.4"/>
  <Record type="HKQuantityTypeIdentifierBodyFatPercentage" unit="%" startDate="2026-10-02 07:00:00 -0500" value="0.182"/>
  <Record type="HKQuantityTypeIdentifierWaistCircumference" unit="cm" startDate="2026-10-03 07:00:00 -0500" value="84"/>
  <Record type="HKQuantityTypeIdentifierStepCount" unit="count" startDate="2026-10-03 07:00:00 -0500" value="5000"/>`;
  const out = {};
  parseChunk(xml, out);
  assert.equal(out.weight['2026-10-01'], 179.9);
  assert.equal(out.weight['2026-10-02'], 179.4);
  assert.equal(out.bodyfat['2026-10-02'], 18.2);
  assert.equal(out.waist['2026-10-03'], 33.1);
  assert.equal(Object.keys(out).length, 3);
});
