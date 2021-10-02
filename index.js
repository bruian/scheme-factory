import {Scheme, validateValue, checkType, valueTransformator} from './src/Scheme.js';

const etalon = {passThroughAttribute: 'pass-through'};
const defaultScheme = {$schemeKey: 'default', passThroughAttribute: {pass: true}};
const dto = {passThroughAttribute: 'pass-through'};

const result = new Scheme([defaultScheme]).dataIterator(dto, 'default', 'adjust');

// const result = new Scheme([defaultScheme])
//   .dataIterator(dto, 'default', 'adjust', {includeMissingAttributes: true, adjustTypes: true});

console.log(result);
