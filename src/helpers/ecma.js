const hasOwnProperty = (object, prop) => Object.prototype.hasOwnProperty.call(object, prop);
const hasOwnProperties = (object, collection) => {
  return (
    Array.isArray(collection) &&
    collection.length > 0 &&
    collection.reduce((acc, el) => (this.hasOwnProperty(object, el) ? acc + 1 : acc), 0) === collection.length
  );
};
const isFn = object => typeof object === 'function';
const isArray = object => Array.isArray(object);
const isPlainObject = object => object !== null && typeof object === 'object' && !Array.isArray(object);
const isNullOrUndefined = value => value === null || value === undefined;

export {hasOwnProperty, hasOwnProperties, isPlainObject, isNullOrUndefined, isFn, isArray};
