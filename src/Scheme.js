import deepClone from './helpers/deepClone.js';
import { hasOwnProperty, isPlainObject, isFn, isArray } from './helpers/ecma.js';
import { prepareAspectObject } from './AspectProcessing.js';
import { ValueError, CriticalError } from './Errors.js';

class Scheme {
  schemeDescriptions = [];
  attributeHandlers = [];
  methodOptions = undefined;
  rootScheme = undefined;
  errors = {};
  caches = {};
  path = [];
  dto = undefined;

  ContinueSymbol = Symbol('continue');
  SkipResultSymbol = Symbol('skip-result');
  /**
   * Constructor
   * @param {Array|Object} schemeDescriptions
   */
  constructor(schemeDescriptions) {
    if (!Array.isArray(schemeDescriptions)) schemeDescriptions = [schemeDescriptions];

    if (schemeDescriptions.length === 0) {
      throw new CriticalError(
        'Invalid schemeDescriptions argument. Should ba a plain object, describing a used schemes',
      );
    }

    for (const schemeDescription of schemeDescriptions) {
      if (!schemeDescription || !isPlainObject(schemeDescription)) {
        throw new CriticalError(
          'Invalid schemeDescriptions argument. Should ba a plain object, describing a used schemes',
        );
      }

      if (!hasOwnProperty(schemeDescription, '$schemeKey')) {
        throw new CriticalError(
          'Invalid scheme-description object, must have "$schemeKey" attribute',
        );
      }
    }

    this.schemeDescriptions = schemeDescriptions;
  }

  /**
   * Метод который валидирует данные согласно представленной схеме
   * @param {Array||Object} data - datas
   * @param {Object} options - {
   *  ignoreValidationAttribute - игнорирование валидации, возвращаются только критичные ошибки
   *  ignoreMissingAttribute - игнорирование ошибки отсутсвующих аттрибутов схемы в данных
   *  strictValidationType - строгая проверка на тип, без приведения типов (float и integer различны)
   *  validationType - проверка типов
   * }
   */
  dataSchemeValidate(data, rootSchemeKey, options) {
    const localOptions = {
      validationType: true,
      strictValidationType: false,
      ignoreMissingAttribute: false,
      ignoreValidationAttribute: false,
      ...options,
    };

    this.path = [];
    this.data = data;
    this.errors = {};
    this.caches = {};
    this.currentScheme = undefined;
    this.methodOptions = localOptions;

    const elementIterator = _elementIterator.bind(this);

    const localData = Array.isArray(data) ? data : [data];
    localData.forEach((el, elIndex) => elementIterator(this.schemeName, el, elIndex));

    function _elementIterator(schemeName, data, elIndex) {
      const currentScheme = schemas[schemeName];
      if (!currentScheme) {
        this.appendError(schemeName, undefined, undefined, `Wrong scheme`);
        return;
      }

      this.currentScheme = currentScheme;
      this.path.push({ schemeName, id: data.id, index: elIndex });

      const handlers = [];
      for (const key in currentScheme) {
        if (hasOwnProperty(data, key)) {
          if (currentScheme[key].service || key.charAt(0) === '$') continue;
          if (currentScheme[key].handlerAfter)
            handlers.push({ func: currentScheme[key].handlerAfter, key });

          if (!localOptions.ignoreValidationAttribute) {
            if (currentScheme[key].type === 'associatedArray') {
              let validationKeyResult;
              let validationValueResult;

              for (const dataProperty in data[key]) {
                validationKeyResult = validateValue.call(
                  this,
                  currentScheme[key].keyType,
                  currentScheme[key].keyRestrictions,
                  dataProperty,
                  localOptions,
                );

                if (!validationKeyResult.valid) break;

                if (hasOwnProperty(currentScheme[key], 'valueScheme')) {
                  if (typeof currentScheme[key].valueType === 'string') {
                    if (currentScheme[key].valueType === 'array') {
                      for (
                        let index = 0;
                        index < data[key][dataProperty].length;
                        index++
                      ) {
                        elementIterator(
                          currentScheme[key].valueScheme,
                          data[key][dataProperty][index],
                          index,
                        );
                      }
                    } else if (currentScheme[key].valueType === 'object') {
                      elementIterator(
                        currentScheme[key].valueScheme,
                        data[key][dataProperty],
                      );
                    }
                  } else {
                    this.appendError(
                      currentScheme[key].valueScheme,
                      key,
                      data[key][dataProperty],
                      `Wrong scheme attribute type: ${dataProperty}, must be string`,
                    );
                  }
                } else {
                  validationValueResult = validateValue.call(
                    this,
                    currentScheme[key].valueType,
                    currentScheme[key].valueRestrictions,
                    data[key][dataProperty],
                    localOptions,
                  );

                  if (!validationValueResult.valid) break;
                }
              }

              if (validationKeyResult && !validationKeyResult.valid) {
                this.appendError(schemeName, key, data[key], validationKeyResult);
                continue;
              }

              if (validationValueResult && !validationValueResult.valid) {
                this.appendError(schemeName, key, data[key], validationValueResult);
                continue;
              }
            } else {
              const validationResult = validateValue.call(
                this,
                currentScheme[key].type,
                currentScheme[key].restrictions,
                data[key],
                localOptions,
              );

              if (!validationResult.valid) {
                this.appendError(schemeName, key, data[key], validationResult);
                continue;
              }
            }
          }

          if (hasOwnProperty(currentScheme[key], 'scheme')) {
            if (typeof currentScheme[key].type === 'string') {
              if (currentScheme[key].type === 'array') {
                for (let index = 0; index < data[key].length; index++) {
                  elementIterator(currentScheme[key].scheme, data[key][index], index);
                }
              } else if (currentScheme[key].type === 'object' && data[key]) {
                elementIterator(currentScheme[key].scheme, data[key]);
              }
            } else {
              this.appendError(
                schemeName,
                key,
                data[key],
                `Wrong scheme attribute type: ${key}, must be string`,
              );
            }
          }
        } else {
          if (
            !localOptions.ignoreMissingAttribute &&
            hasOwnProperty(currentScheme[key], 'required') &&
            currentScheme[key].required
          ) {
            this.appendError(schemeName, key, data[key], `Missing attribute: ${key}`);
          }
        }
      }

      // Обработка handlerAfter после валидации данных
      for (const handler of handlers) {
        handler.func.call(this, 'validation', {
          resultElement: undefined,
          key: handler.key,
          data,
        });
      }

      this.path.pop();
    }

    return this.errors;
  }

  /**
   * Метод который приводит данные в соответствии со схемой
   * Если нужно преобразует типы к типам описанным в схеме
   * Если нужно удаляет атрибуты, которых нет в схеме или наоборот их дополняет назначая значение по умолчанию
   * @param {Array||Object} dto - объект данных для преобразования
   * @param {Object} options {
   *  excludeUnnecessaryAttributes - исключить атрибуты отсутствующие в схеме
   *  includeMissingAttributes - добавлять атрибуты, которые отсутствуют в данных, но присутствуют в схеме
   *  adjustTypes - приводить типы, к типам указанным в схеме
   * }
   * @returns {Array} - объект с приведёнными данными
   */
  dataAdjust(dto, rootSchemeKey, options) {
    const localOptions = {
      excludeUnnecessaryAttributes: true,
      includeMissingAttributes: true,
      adjustTypes: true,
      ...options,
    };

    this.rootScheme = this.schemeDescriptions.find(
      (el) => el.$schemeKey === rootSchemeKey,
    );
    this.path = [];
    this.dto = Array.isArray(dto) ? dto : [dto];
    this.caches = {};
    this.methodOptions = localOptions;

    const state = {
      rootScheme: this.schemeDescriptions.find((el) => el.$schemeKey === rootSchemeKey),
      path: [],
      dto: Array.isArray(dto) ? dto : [dto],
      caches: {},
      methodOptions: localOptions,
    };

    const elementIterator = _elementIterator.bind(this);

    const result = this.dto.reduce((acc, el, elIndex) => {
      acc.push(elementIterator(this.rootScheme.$schemeKey, el, elIndex));
      return acc;
    }, []);

    function _elementIterator(schemeKey, data, elIndex) {
      let resultElement = {};

      const currentScheme = this.schemeDescriptions.find(
        (el) => el.$schemeKey === schemeKey,
      );
      if (!currentScheme) return resultElement;

      this.path.push({ schemeKey, entity: data, index: elIndex });

      const handlers = [];
      // Приведение данных к схеме
      for (const key in currentScheme) {
        const schemeAttribute = currentScheme[key];
        if (schemeAttribute.service || key.charAt(0) === '$') continue;
        if (schemeAttribute.handlerAfter)
          handlers.push({ func: schemeAttribute.handlerAfter, key });

        // Если в данных нет атрибута, который есть в схеме
        if (!hasOwnProperty(data, key)) {
          if (!localOptions.includeMissingAttributes && !schemeAttribute.required)
            continue;

          // Если есть в схеме значение по умолчанию
          if (hasOwnProperty(schemeAttribute, 'default')) {
            if (isFn(schemeAttribute.default)) {
              resultElement[key] = schemeAttribute.default.call(
                this,
                { resultElement, attributeKey: key, data },
                currentScheme,
              );
            } else {
              resultElement[key] = schemeAttribute.default;
            }
          } else if (hasOwnProperty(schemeAttribute, 'type')) {
          } else {
            resultElement[key] = undefined;
          }

          if (!currentScheme[key].traverseDefault) continue;
        }

        // Если значение в схеме представляет другую схему
        if (hasOwnProperty(currentScheme[key], 'scheme')) {
          if (data[key] === null) {
            resultElement[key] = null;
          } else if (currentScheme[key].type === 'array') {
            resultElement[key] = [];
            for (let index = 0; index < data[key].length; index++) {
              resultElement[key].push(
                elementIterator(currentScheme[key].scheme, data[key][index], index),
              );
            }
          } else if (currentScheme[key].type === 'object') {
            resultElement[key] = elementIterator(
              currentScheme[key].scheme,
              isPlainObject(data[key]) ? data[key] : {},
            );
          }
        } else {
          if (currentScheme[key].type === 'associatedArray') {
            const associatedArray = {};
            for (const dataKey in data[key]) {
              let arrayKey = dataKey;
              let arrayValue = data[key][dataKey];

              if (localOptions.adjustTypes) {
                arrayKey = valueTransformator(currentScheme[key].keyType, arrayKey);
                arrayValue = valueTransformator(currentScheme[key].valueType, arrayValue);
              }

              associatedArray[arrayKey] = arrayValue;
            }

            resultElement[key] = associatedArray;
          } else {
            // Если значение типизировано, то приводится к типу указанному в схеме
            resultElement[key] = localOptions.adjustTypes
              ? valueTransformator(currentScheme[key].type, data[key])
              : data[key];
          }
        }
      }

      // Обработка значений, которые отсутствуют в схеме
      for (const key in data) {
        if (
          !hasOwnProperty(currentScheme, key) &&
          !localOptions.excludeUnnecessaryAttributes
        ) {
          resultElement[key] = data[key];
        }
      }

      // Обработка handlerAfter после преобразования данных
      for (const handler of handlers) {
        handler.func.call(this, 'adjust', { resultElement, key: handler.key, data });
      }

      return resultElement;
    }

    return result;
  }

  /**
   * Method for iterating over data
   * @param {Array|Object} dto - data transfer object
   * @param {String} rootSchemeKey - root schema key
   * @param {String} aspect - data transformation aspect
   * @param {Object} options {
   *  excludeUnnecessaryAttributes - исключить атрибуты отсутствующие в схеме
   *  includeMissingAttributes - добавлять атрибуты, которые отсутствуют в данных, но присутствуют в схеме
   *  adjustTypes - приводить типы, к типам указанным в схеме
   * }
   * @returns {Array} - array of result objects
   */
  dataIterator(dto, rootSchemeKey, aspect, options) {
    const localOptions = {
      excludeUnnecessaryAttributes: true,
      includeMissingAttributes: true,
      adjustTypes: true,
      ...options,
    };

    try {
      aspect = prepareAspectObject(aspect);
    } catch (err) {
      throw err;
    }

    const state = {
      aspect,
      rootScheme: this.schemeDescriptions.find((el) => el.$schemeKey === rootSchemeKey),
      currentScheme: null,
      path: [],
      dto: Array.isArray(dto) ? dto : [dto],
      caches: {},
      methodOptions: localOptions,
    };

    const elementIterator = _elementIterator.bind(this);

    const result = state.dto.reduce((acc, el, elIndex) => {
      acc.push(elementIterator(state.rootScheme.$schemeKey, el, elIndex));
      return acc;
    }, []);

    function _elementIterator(schemeKey, data, elIndex) {
      let resultElement = {};

      const currentScheme = this.schemeDescriptions.find(
        (el) => el.$schemeKey === schemeKey,
      );
      if (!currentScheme) return resultElement;
      state.currentScheme = currentScheme;

      state.path.push({ schemeKey, data, index: elIndex, currentScheme });

      // Before handlers
      if (
        hasOwnProperty(currentScheme, '$handlerBefore') &&
        isFn(currentScheme.$handlerBefore)
      ) {
        currentScheme.$handlerBefore.call(
          this,
          data,
          resultElement,
          undefined,
          '$handlerBefore',
          state,
        );
      }

      // Attributes handlers
      for (const attributeKey in currentScheme) {
        if (attributeKey.charAt(0) === '$') continue;

        let hasContinue = false;
        const schemeAttribute = currentScheme[attributeKey];
        for (const schemeAttributeKey of state.aspect.schemeAttributesOrder) {
          if (!hasOwnProperty(schemeAttribute, schemeAttributeKey)) continue;
          const attributeHandler = this.getAttributeHandler(
            schemeAttributeKey,
            state.aspect,
          );

          let result;
          try {
            result = attributeHandler(
              data,
              resultElement,
              attributeKey,
              schemeAttributeKey,
              state,
            );
          } catch (err) {
            if (err instanceof ValueError) {
              console.log('Make return error value');
            } else {
              throw err;
            }
          }

          if (result === this.ContinueSymbol) {
            hasContinue = true;
            break;
          }
          if (result !== this.SkipResultSymbol) resultElement[attributeKey] = result;
        }

        if (hasContinue) continue;

        continue;
        // Если в данных нет атрибута, который есть в схеме
        if (!hasOwnProperty(data, attributeKey)) {
          if (!localOptions.includeMissingAttributes && !schemeAttribute.required)
            continue;

          // Если есть в схеме значение по умолчанию
          if (hasOwnProperty(schemeAttribute, 'default')) {
            if (isFn(schemeAttribute.default)) {
              resultElement[attributeKey] = schemeAttribute.default.call(
                this,
                { resultElement, attributeKey, data },
                currentScheme,
              );
            } else {
              resultElement[attributeKey] = schemeAttribute.default;
            }
          } else {
            resultElement[attributeKey] = undefined;
          }

          if (!currentScheme[attributeKey].traverseDefault) continue;
        }

        // Если значение в схеме представляет другую схему
        if (hasOwnProperty(currentScheme[attributeKey], 'scheme')) {
          if (data[attributeKey] === null) {
            resultElement[attributeKey] = null;
          } else if (currentScheme[attributeKey].type === 'array') {
            resultElement[attributeKey] = [];
            for (let index = 0; index < data[attributeKey].length; index++) {
              resultElement[attributeKey].push(
                elementIterator(
                  currentScheme[attributeKey].scheme,
                  data[attributeKey][index],
                  index,
                ),
              );
            }
          } else if (currentScheme[attributeKey].type === 'object') {
            resultElement[attributeKey] = elementIterator(
              currentScheme[attributeKey].scheme,
              isPlainObject(data[attributeKey]) ? data[attributeKey] : {},
            );
          }
        } else {
          if (currentScheme[attributeKey].type === 'associatedArray') {
            const associatedArray = {};
            for (const dataKey in data[attributeKey]) {
              let arrayKey = dataKey;
              let arrayValue = data[attributeKey][dataKey];

              if (localOptions.adjustTypes) {
                arrayKey = valueTransformator(
                  currentScheme[attributeKey].keyType,
                  arrayKey,
                );
                arrayValue = valueTransformator(
                  currentScheme[attributeKey].valueType,
                  arrayValue,
                );
              }

              associatedArray[arrayKey] = arrayValue;
            }

            resultElement[attributeKey] = associatedArray;
          } else {
            // Если значение типизировано, то приводится к типу указанному в схеме
            resultElement[attributeKey] = localOptions.adjustTypes
              ? valueTransformator(currentScheme[attributeKey].type, data[attributeKey])
              : data[attributeKey];
          }
        }
      }

      // Обработка значений, которые отсутствуют в схеме
      for (const attributeKey in data) {
        if (
          !hasOwnProperty(currentScheme, attributeKey) &&
          !localOptions.excludeUnnecessaryAttributes
        ) {
          resultElement[attributeKey] = data[attributeKey];
        }
      }

      // After handlers
      if (
        hasOwnProperty(currentScheme, '$handlerAfter') &&
        isFn(currentScheme.$handlerAfter)
      ) {
        currentScheme.$handlerAfter.call(
          this,
          data,
          resultElement,
          undefined,
          '$handlerAfter',
          state,
        );
      }

      state.path.pop();
      return resultElement;
    }

    return result;
  }

  /**
   * Дублирующий dataAdjust метод основанный на использовании генератора
   * Если нужно преобразует типы к типам описанным в схеме
   * Если нужно удаляет атрибуты, которых нет в схеме или наоборот их дополняет назначая значение по умолчанию
   * @param {Array||Object} data - сырые данные
   * @param {Object} options {
   *  excludeUnnecessaryAttributes - исключить атрибуты отсутствующие в схеме
   *  includeMissingAttributes - добавлять атрибуты, которые отсутствуют в данных, но присутствуют в схеме
   *  adjustTypes - приводить типы, к типам указанным в схеме
   * }
   * @returns {Array} - объект с приведёнными данными
   */
  dataAdjustForGenerator(data, options) {
    const localData = Array.isArray(data) ? data : [data];
    const result = localData.reduce((acc, el) => {
      const it = this.dataAdjustGenerator(el, options);

      let dataElement;
      let next = it.next();
      while (!next.done) {
        dataElement = next.value.resultElement;
        next = it.next(dataElement);
      }

      acc.push(dataElement);
      return acc;
    }, []);

    return result;
  }

  /**
   * Генератор, который на каждом уровне рекурсивного обхода схемы отдаёт объект
   * с элементом данных и названием схемы соответствующие обрабатываемому уровню схемы.
   * Объекты отдаются начиная с самого глубоко вложенного потомка, в верх к корню.
   * Внимание! Функция отдаёт не сам объект данных, а итератор. И уже сам итератор
   * после выполнения функции next() содержит отданное генератором значение.
   * @param {Array||Object} data - сырые данные
   * @param {Object} options - параметр такой же, что и функции dataAdjust
   * @returns {iterator}
   */
  *dataAdjustGenerator(data, options) {
    const localOptions = {
      excludeUnnecessaryAttributes: true,
      includeMissingAttributes: true,
      adjustTypes: true,
      ...options,
    };

    this.path = [];
    this.data = data;
    this.caches = {};
    this.currentScheme = undefined;
    this.methodOptions = localOptions;

    const elementIterator = _elementIterator.bind(this);

    function* _elementIterator(schemeName, data, elIndex) {
      let resultElement = {};
      const currentScheme = schemas[schemeName];
      if (!currentScheme) return resultElement;

      this.currentScheme = currentScheme;

      this.path.push({
        schemeName,
        id: isPlainObject(data) && hasOwnProperty(data, 'id') ? data.id : data,
        index: elIndex,
      });

      const handlers = [];
      // Приведение данных к схеме
      for (const key in currentScheme) {
        if (currentScheme[key].service || key.charAt(0) === '$') continue;
        if (currentScheme[key].handlerAfter)
          handlers.push({ func: currentScheme[key].handlerAfter, key });

        // Если в данных нет атрибута, который есть в схеме
        if (!hasOwnProperty(data, key)) {
          if (!localOptions.includeMissingAttributes && !currentScheme[key].required)
            continue;

          // Если есть в схеме значение по умолчанию
          if (hasOwnProperty(currentScheme[key], 'default')) {
            if (isFn(currentScheme[key].default)) {
              resultElement[key] = currentScheme[key].default.call(this, {
                resultElement,
                key,
                data,
              });
            } else {
              resultElement[key] = currentScheme[key].default;
            }
          } else {
            resultElement[key] = undefined;
          }

          if (!currentScheme[key].traverseDefault) continue;
        }

        // Если значение в схеме представляет другую схему
        if (hasOwnProperty(currentScheme[key], 'scheme')) {
          if (data[key] === null) {
            resultElement[key] = null;
          } else if (currentScheme[key].type === 'array') {
            resultElement[key] = [];
            for (let index = 0; index < data[key].length; index++) {
              const element = yield* elementIterator(
                currentScheme[key].scheme,
                data[key][index],
                index,
              );
              resultElement[key].push(element);
            }
          } else if (currentScheme[key].type === 'object') {
            const element = yield* elementIterator(
              currentScheme[key].scheme,
              isPlainObject(data[key]) ? data[key] : {},
            );

            resultElement[key] = element;
          }
        } else {
          if (currentScheme[key].type === 'associatedArray') {
            const associatedArray = {};
            for (const dataKey in data[key]) {
              let arrayKey = dataKey;
              let arrayValue = data[key][dataKey];

              if (localOptions.adjustTypes) {
                arrayKey = valueTransformator(currentScheme[key].keyType, arrayKey);
                arrayValue = valueTransformator(currentScheme[key].valueType, arrayValue);
              }

              associatedArray[arrayKey] = arrayValue;
            }

            resultElement[key] = associatedArray;
          } else {
            // Если значение типизировано, то приводится к типу указанному в схеме
            resultElement[key] = localOptions.adjustTypes
              ? valueTransformator(currentScheme[key].type, data[key])
              : data[key];
          }
        }
      }

      // Обработка значений, которые отсутствуют в схеме
      for (const key in data) {
        if (
          !hasOwnProperty(currentScheme, key) &&
          !localOptions.excludeUnnecessaryAttributes
        ) {
          resultElement[key] = data[key];
        }
      }

      // Обработка handlerAfter после преобразования данных
      for (const handler of handlers) {
        handler.func.call(this, 'adjust', { resultElement, key: handler.key, data });
      }

      return yield { schemeName, resultElement };
    }

    yield* elementIterator(this.schemeName, data, 0);
  }

  appendError(schemeName, schemeAttribute, dataAttribute, error) {
    if (!this.errors[schemeName]) this.errors[schemeName] = [];

    const errorObject = {
      path: deepClone(this.path, { proto: false, circles: false }),
      message: '',
      restriction: undefined,
      dataAttribute,
      schemeAttribute,
      typeError: false,
    };

    if (typeof error === 'object') {
      errorObject.message = error.message;
      errorObject.typeError = error.typeError;
      errorObject.restriction = error.restriction;
    } else {
      errorObject.message = error;
    }

    this.errors[schemeName].push(errorObject);
  }

  /**
   * Метод который создаёт новый элемент данных согласно схеме
   */
  createEntity(dto, rootSchemeKey) {
    const datas = this.dataAdjust(dto, rootSchemeKey, {
      includeMissingAttributes: true,
      adjustTypes: true,
    });
    return Array.isArray(datas) ? datas[0] : datas;
  }

  attributeConfiguration(attributeName) {
    return this.rootScheme[attributeName];
  }

  getAttributeHandler(attributeKey, aspect) {
    if (!hasOwnProperty(aspect.schemeAttributeHandlers, attributeKey))
      return this.SkipResultSymbol;

    const attributeHandler = aspect.schemeAttributeHandlers[attributeKey];
    return attributeHandler.bind(this);
  }
}

function validateValue(type, restrictions, value, options) {
  if (options.validationType) {
    let typeValid = true;
    if (Array.isArray(type)) {
      for (const attributeType of type) {
        typeValid = checkType(attributeType, value, options.strictValidationType);
        if (typeValid) break;
      }
    } else {
      typeValid = checkType(type, value, options.strictValidationType);
    }

    if (!typeValid)
      return { valid: false, message: `Wrong type for value ${value}`, typeError: true };
  }

  if (restrictions) {
    // Тут должен быть валидатор, который берёт правила из restrictions и проверяет значение
    if (hasOwnProperty(restrictions, 'oneOf')) {
      if (!restrictions.oneOf.find((el) => el === value)) {
        return {
          valid: false,
          restriction: 'oneOf',
          message: `The value '${value}' must match one of those listed in the schema`,
          typeError: false,
        };
      }
    }

    if (hasOwnProperty(restrictions, 'min')) {
      const val = type === 'string' ? value.length : value;
      if (val < restrictions.min) {
        return {
          valid: false,
          restriction: 'min',
          message: `The value '${value}' must >= ${restrictions.min}`,
          typeError: false,
        };
      }
    }

    if (hasOwnProperty(restrictions, 'max')) {
      const val = type === 'string' ? value.length : value;
      if (val > restrictions.max) {
        return {
          valid: false,
          restriction: 'max',
          message: `The value '${value}' must <= ${restrictions.max}`,
          typeError: false,
        };
      }
    }

    if (hasOwnProperty(restrictions, 'handler')) {
      const result = restrictions.handler.call(this, value);
      if (result) {
        return {
          valid: false,
          restriction: 'handler',
          message: result,
          typeError: false,
        };
      }
    }
  }

  return { valid: true, restriction: undefined, message: '', typeError: false };
}

function checkType(type, value, strictValidationType) {
  if (type === 'array') {
    return Array.isArray(value);
  } else if (type === null) {
    return value === null;
  } else if (type === undefined) {
    return value === undefined;
  }

  if (strictValidationType) {
    if (type === 'float') {
      return typeof value === 'number' && value % 1 !== 0;
    } else if (type === 'integer') {
      return typeof value === 'number' && value % 1 === 0;
    } else if (type === 'number') {
      return typeof value === 'number';
    }
  } else {
    if (type === 'float') {
      return !isNaN(parseFloat(value));
    } else if (type === 'integer') {
      return !isNaN(parseInt(value));
    } else if (type === 'number') {
      return value == Number(value);
    }
  }

  return typeof value === type;
}

function valueTransformator(type, value) {
  if (isArray(type)) {
    // Если указано несколько типов, то пытаемся привести к первому числовому, если он указан
    for (const t of type) {
      const numberTypes = t === 'number' || t === 'integer' || t === 'float';
      if (numberTypes && !checkType(t, value, true)) {
        return transformValue(t, value);
      }
    }
  } else if (type === 'array' || type === 'object' || type === 'associatedArray') {
    return this.SkipResultSymbol;
  } else if (!checkType(type, value, true)) {
    return transformValue(type, value);
  } else {
    return value;
  }
}

function transformValue(type, value) {
  switch (type) {
    case 'string':
      return String(value);
    case 'number':
      return Number(value);
    case 'boolean':
      return Boolean(value);
    case 'float':
      return parseFloat(value);
    case 'integer':
      return parseInt(value);
    case 'undefined':
    case undefined:
      return undefined;
    case 'null':
    case null:
      return null;
    default:
      return undefined;
  }
}

export { Scheme, validateValue, checkType, valueTransformator };
