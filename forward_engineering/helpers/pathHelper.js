const typeHelper = require('./typeHelper');
const commonHelper = require('./commonHelper');
const getExtensions = require('./extensionsHelper');

function getPaths(containers) {
	const paths = {};
	containers.forEach(container => {
		const { name, extensions } = container.containerData[0];
		const collections = container.entities.map(collectionId => JSON.parse(container.jsonSchema[collectionId]));
		const containerExtensions = getExtensions(extensions);

		paths[name] = Object.assign({}, getRequestData(collections, container.jsonData), containerExtensions);
	});

	return paths;
}

function getRequestData(collections, jsonData) {
	return collections
		.filter(collection => collection.entityType === 'request')
		.map(
			({
				tags,
				summary,
				description,
				operationId,
				consumes,
				produces,
				properties,
				collectionName,
				deprecated,
				externalDocs,
				schemes,
				security,
				GUID: collectionId,
				operationExtensions
			}) => Object.assign({}, {
				tags: commonHelper.mapArrayFieldByName(tags, 'tag'),
				summary,
				description,
				externalDocs: commonHelper.mapExternalDocs(externalDocs),
				operationId,
				consumes: commonHelper.mapArrayFieldByName(consumes, 'consumesMimeTypeDef'),
				produces: commonHelper.mapArrayFieldByName(produces, 'producesMimeTypeDef'),
				schemes,
				deprecated,
				parameters: mapParameters(properties, collectionId, jsonData),
				responses: mapResponses(collections, collectionId, jsonData),
				security: commonHelper.mapSecurity(security),
				methodName: collectionName
			}, getExtensions(operationExtensions))
		)
		.reduce((acc, collection) => {
			const { methodName } = collection;
			delete collection.methodName;
			acc[methodName] = collection;
			return acc;
		}, {});
}

function mapParameters(parameters, collectionId, jsonData) {
	if (!parameters) {
		return null;
	}
	return Object.keys(parameters)
		.map(parameterType => {
			return getParameterProps(parameterType, parameters, collectionId, jsonData);
		})
		.filter(param => param)
		.reduce((acc, param) => acc.concat(param), [])
}

function getParameterProps(parameterType, parameters, collectionId, jsonData) {
	const isSchemaWithRef = (typeProps = {}) => typeProps.$ref || (typeProps.items && typeProps.items.$ref);
	if (!parameters[parameterType].properties) {
		return null;
	}
	return Object.keys(parameters[parameterType].properties).map(propName => {
		const parameterProps = {
			name: propName,
			in: parameterType,
			description: parameters[parameterType].properties[propName].description,
			required: (parameters[parameterType].required && parameters[parameterType].required.includes(propName)) || false
		};
		const typeProps = typeHelper.getType(parameters[parameterType].properties[propName]);

		if (parameterType === 'body') {
			return Object.assign({}, parameterProps, {
				schema: Object.assign({}, typeProps, !isSchemaWithRef(typeProps) && {
					example: getRequestExample(collectionId, jsonData)
				})
			});
		}

		return Object.assign({}, parameterProps, typeProps);
	});
}

function mapResponses(collections, collectionId, jsonData) {
	const result = collections
		.filter(collection => collection.entityType === 'response' && collection.parentCollection === collectionId)
		.map(collection => Object.assign({}, {
			responseCode: collection.collectionName,
			description: collection.description || '',
			headers: mapResponseHeaders(collection.properties.headers),
			schema: typeHelper.getType(collection.properties.body),
			examples: getResponseExamples(collection.examples)
		}, getExtensions(collection.operationExtensions)))
		.reduce((acc, response) => {
			const { responseCode } = response;
			delete response.responseCode;
			acc[responseCode] = response;
			return acc;
		}, {});
	return result;
}

function mapResponseHeaders(data) {
	if (!data || !data.properties) {
		return null;
	}

	return Object.keys(data.properties).reduce((headers, name) => {
		headers[name] = Object.assign({}, { description: data.properties[name].description }, typeHelper.getType(data.properties[name]));
		return headers;
	}, {});
}

function getRequestExample(collectionId, jsonData) {
	if (!jsonData || !jsonData[collectionId]) {
		return null;
	}
	const { body } = JSON.parse(jsonData[collectionId]);
	if (!body || Object.keys(body).length === 0) {
		return null;
	}
	return body;
}

function getResponseExamples(data = []) {
	return data.reduce((acc, example) => {
		acc[example.examplesMimeType] = example.examplesValue;
		return acc;
	}, {});
}

module.exports = getPaths;
