import cloneDeep from 'lodash/cloneDeep';

import { Scheme } from './Scheme';
import { CriticaError } from './Errors';

test('default test', () => {
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

  const sut = new Scheme([defaultScheme, innerScheme]);
  const result = sut.createEntity({}, 'default');

  expect(result).toEqual(etalon);
});

describe('Base callings', () => {
  describe('Constructing object', () => {
    test('construct by default with single description', () => {
      const schemeDescription = { $schemeKey: 'default' };
      const SUT = new Scheme(schemeDescription);

      expect(SUT).toBeInstanceOf(Scheme);
      expect(SUT.schemeDescriptions).toEqual([schemeDescription]);
    });
    test('construct by default with array description', () => {
      const SUT = new Scheme([{ $schemeKey: 'default' }]);

      expect(SUT).toBeInstanceOf(Scheme);
    });
    test('construct without description', () => {
      function CreateSUT() {
        new Scheme([]);
      }

      expect(CreateSUT).toThrowError(CriticaError);
    });
    test.each([[1], [undefined], [{}], [null]])(
      'construct with description is %i',
      (a) => {
        function createSUT() {
          new Scheme(a);
        }

        expect(createSUT).toThrowError(CriticaError);
      },
    );
  });
});

describe('Attribute types', () => {
  test('string type', () => {
    const etalon = { testedAttribute: undefined };
    const defaultScheme = {
      $schemeKey: 'default',
      testedAttribute: {
        type: 'string',
      },
    };

    const result = new Scheme([defaultScheme]).createEntity({}, 'default');

    expect(result).toEqual(etalon);
  });
});

describe('dataIterator: data adjusting', () => {
  describe('Default argument transformation', () => {
    test('Dont pass attribute when no scheme-attribute', () => {
      const etalon = {};
      const defaultScheme = { $schemeKey: 'default' };
      const dto = { passThroughAttribute: 'pass-through' };

      const result = new Scheme([defaultScheme]).dataIterator(dto, 'default', 'adjust');

      expect(result).toEqual([etalon]);
    });
    test('Pass attribute', () => {
      const etalon = { passThroughAttribute: 'pass-through' };
      const defaultScheme = {
        $schemeKey: 'default',
        passThroughAttribute: { pass: true },
      };
      const dto = { passThroughAttribute: 'pass-through' };

      const result = new Scheme(defaultScheme).dataIterator(dto, 'default', 'adjust');

      expect(result).toEqual([etalon]);
    });
    test('Dont pass attribute', () => {
      const etalon = {};
      const defaultScheme = {
        $schemeKey: 'default',
        passThroughAttribute: { pass: false },
      };
      const dto = { passThroughAttribute: 'pass-through' };

      const result = new Scheme(defaultScheme).dataIterator(dto, 'default', 'adjust');

      expect(result).toEqual([etalon]);
    });
    test('Skip processing other attributes when pass is false', () => {
      const etalon = {};
      const defaultScheme = {
        $schemeKey: 'default',
        passThroughAttribute: { pass: false, type: 'string' },
      };
      const dto = { passThroughAttribute: 10 };

      const result = new Scheme(defaultScheme).dataIterator(dto, 'default', 'adjust');

      expect(result).toEqual([etalon]);
    });
  });

  describe('Attribute: type', () => {
    test('Checking for the creation of valid types', () => {
      const etalon = {
        stringAttribute: '',
        numberAttribute: 0,
        booleanAttribute: false,
        floatAttribute: 0,
        integerAttribute: 0,
        arrayAttribute: [],
        associatedArrayAttribute: {},
        objectAttribute: {},
        undefinedAttribute: undefined,
        nullAttribute: null,
        defaultAttribute: undefined,
        multipleTypesAttribute: undefined,
        handlerTypeAttribute: true,
      };
      const defaultScheme = {
        $schemeKey: 'default',
        stringAttribute: { type: 'string' },
        numberAttribute: { type: 'number' },
        booleanAttribute: { type: 'boolean' },
        floatAttribute: { type: 'float' },
        integerAttribute: { type: 'integer' },
        arrayAttribute: { type: 'array' },
        associatedArrayAttribute: { type: 'associatedArray' },
        objectAttribute: { type: 'object' },
        undefinedAttribute: { type: undefined },
        nullAttribute: { type: null },
        defaultAttribute: { type: '' },
        multipleTypesAttribute: { type: ['string', 'number', 'boolean'] },
        handlerTypeAttribute: {
          type: function () {
            return Boolean(true);
          },
        },
      };

      const result = new Scheme([defaultScheme]).dataIterator({}, 'default', 'adjust', {
        includeMissingAttributes: true,
        adjustTypes: true,
      });

      expect(result).toEqual([etalon]);
    });

    test('Checking for the adjusting types', () => {
      const etalon = {
        stringAttribute: 'String',
        likeAString: '0',
        likeANumber: 10,
        likeAFloat: 10.1,
        likeAInteger: 10,
        likeABoolean: true,
        likeABooleanFromNumber: false,
        likeABooleanFromObject: true,
        likeABooleanFromEmptyString: false,
        likeABooleanFromUndefined: false,
        likeABooleanFromNull: false,
        likeANullFromString: null,
        likeAUndefinedFromString: undefined,
        likeAUnknownType: undefined,
        forgottenAttribute: '',

        // booleanAttribute: false,
        // floatAttribute: 0,
        // integerAttribute: 0,
        // arrayAttribute: [],
        // associatedArrayAttribute: {},
        // objectAttribute: {},
        // undefinedAttribute: undefined,
        // nullAttribute: null,
        // defaultAttribute: undefined,
        // multipleTypesAttribute: undefined,
        // handlerTypeAttribute: true,
      };
      const defaultScheme = {
        $schemeKey: 'default',
        stringAttribute: { type: 'string' },
        likeAString: { type: 'string' },
        likeANumber: { type: 'number' },
        likeAFloat: { type: 'float' },
        likeAInteger: { type: 'integer' },
        likeABoolean: { type: 'boolean' },
        likeABooleanFromNumber: { type: 'boolean' },
        likeABooleanFromObject: { type: 'boolean' },
        likeABooleanFromEmptyString: { type: 'boolean' },
        likeABooleanFromUndefined: { type: 'boolean' },
        likeABooleanFromNull: { type: 'boolean' },
        likeANullFromString: { type: null },
        likeAUndefinedFromString: { type: undefined },
        likeAUnknownType: { type: 'unkno' },
        forgottenAttribute: { type: 'string' },
        passThroughAttribute: { pass: true },
        noPassThroughAttribute: { pass: false },
        // floatAttribute: {type: 'float'},
        // integerAttribute: {type: 'integer'},
        // arrayAttribute: {type: 'array'},
        // associatedArrayAttribute: {type: 'associatedArray'},
        // objectAttribute: {type: 'object'},
        // undefinedAttribute: {type: undefined},
        // nullAttribute: {type: null},
        // defaultAttribute: {type: ''},
        // multipleTypesAttribute: {type: ['string', 'number', 'boolean']},
        // handlerTypeAttribute: {type: function () { return Boolean(true) }},
      };
      const dto = {
        stringAttribute: 'String',
        likeAString: 0,
        likeANumber: '10',
        likeAFloat: '10.1',
        likeAInteger: '10.1',
        likeABoolean: 'false',
        likeABooleanFromNumber: 0,
        likeABooleanFromObject: {},
        likeABooleanFromEmptyString: '',
        likeABooleanFromUndefined: undefined,
        likeABooleanFromNull: null,
        likeANullFromString: 'null',
        likeAUndefinedFromString: 'undefined',
        likeAUnknownType: 'i dont known',
        passThroughAttribute: 'pass-through',
        noPassThroughAttribute: 'no pass',
      };

      const result = new Scheme([defaultScheme]).dataIterator(dto, 'default', 'adjust', {
        includeMissingAttributes: true,
        adjustTypes: true,
      });

      expect(result).toEqual([etalon]);
    });
  });
});

/* Attributes
  $schemeKey: string, service attribute,
  {
    $key: string, service attribute,
    $handlerAfter: fn,
    $handlerBefore: fn,
    $attributeOrder: ['type', 'default', ...],
    attribute: {
      $schemeAttributeOrder: ['type', 'default', ...],
      type: 'string' | ['string', 'number', 'associatedArray', undefined, null, 'boolean', 'array', ...],
      required: true | false,
      default: any | fn | constructor,
      keyType: 'string' | ...,
      valueType: 'string' | ...,
      valueScheme: schemeKey,
      valueRestrictions: {
        handler: function (value) {
          if (ES.hasOwnProperty(this.methodOptions, 'handlerPayload')) {
            const fnc = this.methodOptions.handlerPayload;
            return fnc(value);
          }
        },
        |
        min: 1,
        max: 255,
        oneOf: [...Object.values(ExperimentTypes)],
      },
      scheme: schemeKey | schemeDescription,
      traverseDefault: true | false,
    }
  }
*/
