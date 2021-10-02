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
