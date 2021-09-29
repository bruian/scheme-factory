import {Scheme, validateValue, checkType, valueTransformator} from './src/Scheme.js';

const dto = {};
const defaultScheme = {
  $schemeKey: 'default',
  id: {
    type: 'string',
    required: true,
    default: '',
  },
  name: {
    type: 'string',
    required: false,
    default: 'simple name',
  },
  inner: {
    type: 'object',
    scheme: 'innerScheme',
    traverseDefault: true,
  },
};

const innerScheme = {
  $schemeKey: 'innerScheme',
  name: {
    type: 'string',
    default: 'inner name',
  },
  order: {
    type: 'number',
    required: false,
    default: 0,
  },
};

const scheme = new Scheme([defaultScheme, innerScheme]);
const entity = scheme.createEntity(dto, 'default');

console.log(entity);
