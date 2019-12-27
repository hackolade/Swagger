const getExtensions = require('./extensionsHelper');
const { prepareReferenceName } = require('../utils/utils');

function getType(data) {
	if (!data) {
		return null;
	}

	if (data.allOf) {
		return {
			allOf: data.allOf.map(getType)
		};
	}

	if (Array.isArray(data.type)) {
		return getType(Object.assign({}, data, { type: data.type[0] }));
	}

	if (data.$ref) {
		return {
			$ref: prepareReferenceName(
				getRef(data.$ref)
			)
		};
	}
	
	return getTypeProps(data);
}

function getTypeProps(data) {
	const { type, properties, items, required, additionalProperties } = data;

	switch (type) {
		case 'array':
			return {
				type,
				items: getArrayItemsType(items),
				collectionFormat: data.collectionFormat,
				minItems: data.minItems,
				maxItems: data.maxItems,
				uniqueItems: data.uniqueItems,
				discriminator: data.discriminator,
				readOnly: data.readOnly,
				xml: getXml(data.xml)
			};
		case 'object':
			if (!properties && !additionalProperties) {
				return null;
			}
			return {
				type,
				required,
				properties: getObjectProperties(properties),
				minProperties: data.minProperties,
				maxProperties: data.maxProperties,
				additionalProperties: data.additionalProperties,
				discriminator: data.discriminator,
				readOnly: data.readOnly,
				xml: getXml(data.xml)
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
	if (ref.startsWith('#')) {
		return prepareReferenceName(ref.replace('#model/', '#/'));
	}

	const [ pathToFile, relativePath] = ref.split('#/');
	if (!relativePath) {
		return prepareReferenceName(ref);
	}

	const hasResponse = relativePath.split('/')[2] !== 'properties';
	const path = relativePath.split('/');
	if (path[0] === 'definitions') {
		return `${pathToFile}#/definitions/${path.slice(2).join('/')}`;
	}

	const schemaIndex = path.indexOf('schema');
	const schemaPath = schemaIndex === -1 ? [] : path.slice(schemaIndex);
	const pathWithoutSlashes = path.slice(0, schemaIndex).filter(item => item !== 'properties');

	const bucketWithRequest = pathWithoutSlashes.slice(0, 2);

	if (!hasResponse) {
		const pathToParameter = [ ...bucketWithRequest, 'parameters', '0' ];
		const parameterSchemaPath = pathWithoutSlashes.slice(4);
		return `${pathToFile}#/paths/${[ ...pathToParameter, ...parameterSchemaPath, ...schemaPath].join('/')}`;
	}

	const response = pathWithoutSlashes[2];
	const hasHeaders = pathWithoutSlashes[3] === 'headers';
	
	const pathToItem = hasHeaders ? pathWithoutSlashes.slice(3) : pathWithoutSlashes.slice(4);

	const pathWithResponses = [ ...bucketWithRequest, 'responses', response, ...pathToItem, ...schemaPath ];

	return `${pathToFile}#/paths/${pathWithResponses.join('/')}`;
};

function getArrayItemsType(items) {
	if (Array.isArray(items)) {
		return Object.assign({}, items.length > 0 ? getType(items[0]) : {});
	}
	return Object.assign({}, items ? getType(items) : {});
}

function getObjectProperties(properties = {}) {
	return Object.keys(properties).reduce((acc, propName) => {
		acc[propName] = getType(properties[propName]);
		return acc;
	}, {});
}

function getXml(data) {
	if (!data) {
		return undefined;
	}

	return Object.assign({}, {
		name: data.xmlName,
		namespace: data.xmlNamespace,
		prefix: data.xmlPrefix,
		attribute: data.xmlAttribute,
		wrapped: data.xmlWrapped
	}, getExtensions(data.scopesExtensions));
}

function getPrimitiveTypeProps(data) {
	return {
		type: data.type,
		format: data.format || data.mode,
		description: data.description,
		exclusiveMinimum: data.exclusiveMinimum,
		exclusiveMaximum: data.exclusiveMaximum,
		minimum: data.minimum,
		maximum: data.maximum,
		enum: data.enum,
		pattern: data.pattern,
		default: data.default,
		minLength: data.minLength,
		maxLength: data.maxLength,
		multipleOf: data.multipleOf,
		xml: getXml(data.xml),
		example: data.sample
	};
}

module.exports = {
	getType
};
