export default {
  aspectKey: 'adjust',
  schemeAttributesOrder: ['pass', 'required', 'default', 'type'],
  schemeAttributeHandlers: {
    pass: function(data, resultElement, attributeKey, schemeAttributeKey, state) {
      const schemeAttributeValue = state.currentScheme[attributeKey][schemeAttributeKey];
      if (!schemeAttributeValue) return this.ContinueSymbol;
      return data[attributeKey];
    },
    required: function(data, resultElement, attributeKey, schemeAttributeKey, state) {},
    default: function(data, resultElement, attributeKey, schemeAttributeKey, state) {},
    type: function(data, resultElement, attributeKey, schemeAttributeKey, state) {
      const schemeAttributeValue = state.currentScheme[attributeKey][schemeAttributeKey];
      if (!hasOwnProperty(data, attributeKey)) {
        if (hasOwnProperty(resultElement, attributeKey)) return this.SkipResultSymbol;

        if (isFn(schemeAttributeValue))
          return schemeAttributeValue.call(this, data, resultElement, attributeKey, schemeAttributeKey, state);

        if (!isArray(schemeAttributeValue))
          return createTypedValue(schemeAttributeValue);
      } else {
        if (schemeAttributeValue === 'associatedArray') {
          return this.SkipResultSymbol;
        } else {
          if (state.methodOptions.adjustTypes)
            return valueTransformator.call(this, schemeAttributeValue, data[attributeKey]);

          return data[attributeKey];
        }
      }

      return undefined;
    },
  },
};

function createTypedValue(type) {
  switch (type) {
    case 'string':
      return String();
    case 'number':
      return Number();
    case 'boolean':
      return Boolean();
    case 'float':
      return Number();
    case 'integer':
      return Number();
    case 'array':
      return Array();
    case 'associatedArray':
    case 'object':
      return Object();
    case undefined:
      return undefined;
    case null:
      return null;
    default:
      return undefined;
  }
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
  } else if (type === 'array' || type === 'object' || type ==='associatedArray') {
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
