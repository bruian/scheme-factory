import {Scheme} from './Scheme';

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

const etalon = {
  id: '',
  name: 'simple name',
  inner: {
    name: 'inner name',
    order: 0,
  },
};

test('default scheme', () => {
  const sut = new Scheme([defaultScheme, innerScheme]);
  const result = sut.createEntity({}, 'default');

  expect(result).toEqual(etalon);
});
