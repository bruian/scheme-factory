const {isArray} = Array;
const {toString: toStringFunction} = Function.prototype;
const {hasOwnProperty, propertyIsEnumerable} = Object.prototype;

const {
    create,
    defineProperty,
    getOwnPropertyDescriptor,
    getOwnPropertyNames,
    getOwnPropertySymbols,
    getPrototypeOf,
} = Object;

/**
 * @enum
 *
 * @const {Object} SUPPORTS
 *
 * @property {boolean} SYMBOL_PROPERTIES are symbol properties supported
 * @property {boolean} WEAKMAP is WeakMap supported
 */
const SUPPORTS = {
    SYMBOL_PROPERTIES: typeof getOwnPropertySymbols === 'function',
    WEAKMAP: typeof WeakMap === 'function',
};

/**
 * get the flags to apply to the copied regexp
 *
 * @param regExp the regexp to get the flags of
 * @returns the flags for the regexp
 */
const getRegExpFlags = regExp => {
    let flags = '';

    if (regExp.global) {
        flags += 'g';
    }

    if (regExp.ignoreCase) {
        flags += 'i';
    }

    if (regExp.multiline) {
        flags += 'm';
    }

    if (regExp.unicode) {
        flags += 'u';
    }

    if (regExp.sticky) {
        flags += 'y';
    }

    return flags;
};

const GLOBAL_THIS = (() => {
    if (typeof self !== 'undefined') {
        return self;
    }

    if (typeof window !== 'undefined') {
        return window;
    }

    if (typeof global !== 'undefined') {
        return global;
    }

    if (console && console.error) {
        console.error('Unable to locate global object, returning "this".');
    }
})();

/**
 * Получение нового объекта кеша для предотвращения циклических ссылок
 */
const createCache = function () {
    if (SUPPORTS.WEAKMAP) return new WeakMap();

    // простая реализация WeakMap
    const object = create({
        has: key => !!~object._keys.indexOf(key),
        set: (key, value) => {
            object._keys.push(key);
            object._values.push(value);
        },
        get: key => object._values[object._keys.indexOf(key)],
    });

    object._keys = [];
    object._values = [];

    return object;
};

/**
 * Получить пустую версию объекта с тем же прототипом
 */
export const getCleanClone = (object, realm) => {
    if (!object.constructor) return create(null);

    const {constructor: Constructor} = object;
    const prototype = object.__proto__ || getPrototypeOf(object);

    if (Constructor === realm.Object) {
        return prototype === realm.Object.prototype ? {} : create(prototype);
    }

    if (~toStringFunction.call(Constructor).indexOf('[native code]')) {
        try {
            return new Constructor();
            // eslint-disable-next-line no-empty
        } catch {}
    }

    return create(prototype);
};

/**
 * Получить клон объекта на основе свободных правил, то есть все перечислимые
 * ключи и символы копируются, но дескрипторы свойств не рассматриваются
 */
const getObjectCloneLoose = (object, realm, handleCopy, cache) => {
    const clone = getCleanClone(object, realm);

    cache.set(object, clone);

    for (const key in object) {
        if (hasOwnProperty.call(object, key)) {
            clone[key] = handleCopy(object[key], cache);
        }
    }

    if (SUPPORTS.SYMBOL_PROPERTIES) {
        const symbols = getOwnPropertySymbols(object);

        const {length} = symbols;

        if (length) {
            for (let index = 0, symbol; index < length; index++) {
                symbol = symbols[index];

                if (propertyIsEnumerable.call(object, symbol)) {
                    clone[symbol] = handleCopy(object[symbol], cache);
                }
            }
        }
    }

    return clone;
};

/**
 * Получить клон объекта на основе строгих правил, то есть все ключи и
 * символы копируются на основе исходных дескрипторов свойств
 */
const getObjectCloneStrict = (object, realm, handleCopy, cache) => {
    const clone = getCleanClone(object, realm);

    cache.set(object, clone);

    const properties = SUPPORTS.SYMBOL_PROPERTIES
        ? getOwnPropertyNames(object).concat(getOwnPropertySymbols(object))
        : getOwnPropertyNames(object);

    const {length} = properties;

    if (length) {
        for (let index = 0, property, descriptor; index < length; index++) {
            property = properties[index];

            if (property !== 'callee' && property !== 'caller') {
                descriptor = getOwnPropertyDescriptor(object, property);

                if (descriptor) {
                    // Only clone the value if actually a value, not a getter / setter.
                    if (!descriptor.get && !descriptor.set) {
                        descriptor.value = handleCopy(object[property], cache);
                    }

                    try {
                        defineProperty(clone, property, descriptor);
                    } catch (error) {
                        // Tee above can fail on node in edge cases, so fall back to the loose assignment.
                        clone[property] = descriptor.value;
                    }
                } else {
                    // In extra edge cases where the property descriptor cannot be retrived, fall back to
                    // the loose assignment.
                    clone[property] = handleCopy(object[property], cache);
                }
            }
        }
    }

    return clone;
};

/**
 * Глубокое копирование объекта
 *
 * В 'strict' режиме, все свойства (включая not-enumerable) копируются вместе
 * с их дескрипторами свойств
 *
 * @param {object} object объект для клонирования
 * @param {object} options опции клонирования
 * @returns копия объекта
 */
function deepClone(object, options) {
    const isStrict = !!(options && options.isStrict);
    const realm = (options && options.realm) || GLOBAL_THIS;
    const objectHandler = (options && options.objectHandler) || undefined;

    const getObjectClone = isStrict ? getObjectCloneStrict : getObjectCloneLoose;

    /**
     * Рекурсивное копирование, в зависимости от типа
     */
    const handleCopy = (object, cache) => {
        if (!object || typeof object !== 'object') {
            return object;
        }

        if (cache.has(object)) {
            return cache.get(object);
        }

        const {constructor: Constructor} = object;

        // plain objects
        if (Constructor === realm.Object) {
            return objectHandler
                ? objectHandler(getObjectClone(object, realm, handleCopy, cache))
                : getObjectClone(object, realm, handleCopy, cache);
        }

        let clone;
        // arrays
        if (isArray(object)) {
            // if strict, include non-standard properties
            if (isStrict) {
                return getObjectCloneStrict(object, realm, handleCopy, cache);
            }

            const {length} = object;

            clone = new Constructor();
            cache.set(object, clone);

            for (let index = 0; index < length; index++) {
                clone[index] = handleCopy(object[index], cache);
            }

            return clone;
        }

        // dates
        if (object instanceof realm.Date) {
            return new Constructor(object.getTime());
        }

        // regexps
        if (object instanceof realm.RegExp) {
            clone = new Constructor(object.source, object.flags || getRegExpFlags(object));

            clone.lastIndex = object.lastIndex;

            return clone;
        }

        // maps
        if (realm.Map && object instanceof realm.Map) {
            clone = new Constructor();
            cache.set(object, clone);

            object.forEach((value, key) => {
                clone.set(key, handleCopy(value, cache));
            });

            return clone;
        }

        // sets
        if (realm.Set && object instanceof realm.Set) {
            clone = new Constructor();
            cache.set(object, clone);

            object.forEach(value => {
                clone.add(handleCopy(value, cache));
            });

            return clone;
        }

        // blobs
        if (realm.Blob && object instanceof realm.Blob) {
            clone = new Blob([object], {type: object.type});
            return clone;
        }

        // buffers (node-only)
        if (realm.Buffer && realm.Buffer.isBuffer(object)) {
            clone = realm.Buffer.allocUnsafe ? realm.Buffer.allocUnsafe(object.length) : new Constructor(object.length);

            cache.set(object, clone);
            object.deepClone(clone);

            return clone;
        }

        // arraybuffers / dataviews
        if (realm.ArrayBuffer) {
            // dataviews
            if (realm.ArrayBuffer.isView(object)) {
                clone = new Constructor(object.buffer.slice(0));
                cache.set(object, clone);
                return clone;
            }

            // arraybuffers
            if (object instanceof realm.ArrayBuffer) {
                clone = object.slice(0);
                cache.set(object, clone);
                return clone;
            }
        }

        // if the object cannot / should not be cloned, don't
        if (
            // promise-like
            typeof object.then === 'function' ||
            // errors
            object instanceof Error ||
            // weakmaps
            (realm.WeakMap && object instanceof realm.WeakMap) ||
            // weaksets
            (realm.WeakSet && object instanceof realm.WeakSet)
        ) {
            return object;
        }

        // assume anything left is a custom constructor
        return getObjectClone(object, realm, handleCopy, cache);
    };

    return handleCopy(object, createCache());
}

/**
 * Клонирование объекта с предустановленной опцией `strict`
 */
deepClone.strict = function strictCopy(object, options) {
    return deepClone(object, {
        isStrict: true,
        realm: options ? options.realm : void 0,
    });
};

export default deepClone;
