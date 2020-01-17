const typeHelper = require('./typeHelper');
const commonHelper = require('./commonHelper');
const getExtensions = require('./extensionsHelper');

function getPaths(containers) {
	const paths = {};
	containers.forEach((container, index) => {
		const { name, extensions, isActivated } = container.containerData[0];
		const collections = container.entities.map(collectionId => JSON.parse(container.jsonSchema[collectionId]));
		const containerExtensions = getExtensions(extensions);

		if (!isActivated) {
			paths[`hackoladeCommentStart${index}`] = true; 
		}
		paths[name] = Object.assign({}, getRequestData(collections, container.jsonData, isActivated), containerExtensions);
		if (!isActivated) {
			paths[`hackoladeCommentEnd${index}`] = true;
		}
	});

	return paths;
}

function getRequestData(collections, jsonData, isPathActivated = true) {
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
				operationExtensions,
				isActivated
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
				responses: mapResponses(collections, collectionId, isPathActivated && isActivated),
				security: commonHelper.mapSecurity(security),
				methodName: collectionName,
				isActivated
			}, getExtensions(operationExtensions))
		)
		.reduce((acc, collection, index) => {
			const { methodName, isActivated } = collection;
			delete collection.methodName;
			delete collection.isActivated;

			const shouldCommentedFlagBeInserted = !isActivated && isPathActivated;
			if (shouldCommentedFlagBeInserted) {
				acc[`hackoladeCommentStart${index}`] = true; 
			}
			acc[methodName] = collection;
			if (shouldCommentedFlagBeInserted) {
				acc[`hackoladeCommentEnd${index}`] = true; 
			}
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
				schema: Object.assign({}, typeProps)
			});
		}

		return Object.assign({}, parameterProps, typeProps);
	});
}

function mapResponses(collections, collectionId, isParentActivated) {
	const result = collections
		.filter(collection => collection.entityType === 'response' && collection.parentCollection === collectionId)
		.map(collection => {
			const shouldResponseBeCommented = !collection.isActivated && isParentActivated;
			const response = {};
			if (shouldResponseBeCommented) {
				response[`hackoladeInnerCommentStart`] = true;
			}
			Object.assign(response, {
				description: collection.description || '',
				headers: mapResponseHeaders(collection.properties.headers),
				schema: typeHelper.getType(collection.properties.body),
				examples: getResponseExamples(collection.examples)
			}, getExtensions(collection.operationExtensions));
			if (shouldResponseBeCommented) {
				response[`hackoladeInnerCommentEnd`] = true;
			}
			const responseCode = collection.collectionName;
			return { response, responseCode };
		})
		.reduce((acc, { response, responseCode }) => {
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
