import {hasOwnProperties, isPlainObject} from './helpers/ecma.js';
import { AspectError } from './Errors.js';

import adjustingAspect from './default-aspects/adjusting-aspect';
import validationAspect from './default-aspects/validation-aspect';
import transformationAspect from './default-aspects/transformation-aspect';

export function prepareAspectObject(aspect) {
  if (isPlainObject(aspect)) {
    if (!hasOwnProperties(aspect, ['aspectKey', 'schemeAttributesOrder', 'schemeAttributeHandlers']))
      throw AspectError('An aspect attribute can be passed a string key of an aspect, or an object describing an aspect in accordance with the specification.');

    return aspect;
  }

  if (typeof aspect !== 'string')
    throw AspectError('An aspect attribute can be passed a string key of an aspect, or an object describing an aspect in accordance with the specification.');

  switch (aspect) {
    case 'adjust':
      return adjustingAspect;
    case 'validation':
      return validationAspect;
    case 'transformation':
      return transformationAspect;
    default:
      throw AspectError('No default aspect found matching passed key');
  }
}
