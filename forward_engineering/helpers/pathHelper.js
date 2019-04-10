const typeHelper = require('./typeHelper');
const commonHelper = require('./commonHelper');
const getExtensions = require('./extensionsHelper');

const JSON_MIME_TYPE = 'application/json';

function getPaths(containers) {
	const paths = {};
	containers.forEach(container => {
		const { name } = container.containerData[0];
		const collections = container.entities.map(collectionId => JSON.parse(container.jsonSchema[collectionId]));

		paths[name] = getRequestData(collections, container.jsonData);
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
	if (!parameters[parameterType].properties) {
		return null;
	}
	return Object.keys(parameters[parameterType].properties).map(propName => {
		const parameterProps = {
			name: propName,
			in: parameterType,
			description: parameters[parameterType].properties[propName].description,
			required: parameters[parameterType].required && parameters[parameterType].required.includes(propName)
		};
		const typeProps = typeHelper.getType(parameters[parameterType].properties[propName]);

		if (parameterType === 'body') {
			return Object.assign({}, parameterProps, {
				schema: Object.assign({}, typeProps, !typeProps.$ref && {
					example: getExamples(collectionId, jsonData)
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
			examples: getExamples(collection.GUID, jsonData)
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

function getExamples(collectionId, jsonData) {
	if (!jsonData || !jsonData[collectionId]) {
		return null;
	}
	const { body } = JSON.parse(jsonData[collectionId]);
	if (!body || Object.keys(body).length === 0) {
		return null;
	}
	return {
		[JSON_MIME_TYPE]: body
	};
}

module.exports = getPaths;
