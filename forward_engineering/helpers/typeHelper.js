function getType(data) {
	if (!data) {
		return null;
	}
	if (Array.isArray(data.type)) {
		return getType(Object.assign({}, data, { type: data.type[0] }));
	}

	if (data.$ref) {
		return {
			$ref: getRef(data.$ref)
		};
	}
	
	return getTypeProps(data);
}

function getTypeProps(data) {
	const { type, properties, items, required } = data;

	switch (type) {
		case 'array':
			return {
				type,
				items: getArrayItemsType(items)
			};
		case 'object':
			if (!properties) {
				return null;
			}
			return {
				type,
				required,
				properties: getObjectProperties(properties)
			};
		case 'parameter':
			if (!properties || properties.length === 0) {
				return null;
			}
			return getType(properties[Object.keys(properties)[0]]);
		default:
			return getPrimitiveTypeProps(data);
	}
}

function getRef(ref) {
	return ref.startsWith('#') ? ref.replace('#model/', '#/') : ref;
}

function getArrayItemsType(items) {
	if (Array.isArray(items)) {
		return Object.assign({}, items.length > 0 ? getType(items[0]) : {});
	}
	return Object.assign({}, items ? getType(items) : {});
}

function getObjectProperties(properties) {
	return Object.keys(properties).reduce((acc, propName) => {
		acc[propName] = getType(properties[propName]);
		return acc;
	}, {});
}

function getPrimitiveTypeProps(data) {
	return {
		type: data.type,
		format: data.format || data.mode,
		minItems: data.minItems,
		maxItems: data.maxItems,
		uniqueItems: data.uniqueItems,
		exclusiveMinimum: data.exclusiveMinimum,
		exclusiveMaximum: data.exclusiveMaximum,
		minimum: data.minimum,
		maximum: data.maximum,
		enum: data.enum,
		pattern: data.pattern,
		default: data.default,
		minLength: data.minLength,
		maxLength: data.maxLength,
		multipleOf: data.multipleOf
	};
}

module.exports = {
	getType
};
