
const cloneDeep = require('lodash.clonedeep'); 

const add = (obj, name, value) => Object.assign({}, obj, { [name]: value });

const getDefinition = (reference, definitions) => {
	const isModel = /\#model/i.test(reference.$ref || '');
	const isInternal = /\#\/definitions/i.test(reference.$ref || '');

	if (isModel) {
		const definitionName = reference.$ref.replace(/\#model\/definitions\//i, '');

		return cloneDeep(definitions.model.properties[definitionName]);
	} else if (isInternal) {
		const definitionName = reference.$ref.replace(/\#\/definitions\//, '');

		return cloneDeep(definitions.internal.properties[definitionName]);
	} else {
		const definitionName = reference.$ref.split('/').pop();

		return cloneDeep(definitions.external.properties[definitionName]);
	}
};

const replaceReferences = (jsonSchema, definitions) => {
	const properties = Object.keys(jsonSchema.properties).reduce((properties, propertyName) => {
		const property = jsonSchema.properties[propertyName];

		if (!property.$ref) {
			return add(properties, propertyName, property);
		}

		const updatedProperty = getDefinition(property, definitions);

		return add(properties, propertyName, updatedProperty);
	}, {});

	return add(jsonSchema, 'properties', properties);
};

const replaceReferencesInParameters = (jsonSchema, definitions) => {
	const properties = Object.keys(jsonSchema.properties).reduce((properties, propertyName) => {
		const property = jsonSchema.properties[propertyName];

		if (propertyName === 'body') {
			return add(properties, propertyName, property);
		}

		if (!property.properties) {
			return add(properties, propertyName, property);
		}

		const updatedProperty = replaceReferences(property, definitions);

		return add(properties, propertyName, updatedProperty);
	}, {});

	return Object.assign({}, jsonSchema, {
		properties
	});
};

const convertReferencesInEntities = ({ entities, jsonSchemas, definitions }) => {
	return entities.reduce((result, entityId) => {
		const jsonSchema = JSON.parse(jsonSchemas[entityId]);
		const internalDefinition = JSON.parse(definitions.internal[entityId]);
		
		if (jsonSchema.entityType !== 'request') {
			return Object.assign({}, result, {
				[entityId]: jsonSchemas[entityId]
			});
		}

		const replacedReferences = replaceReferencesInParameters(jsonSchema, Object.assign({}, definitions, {
			internal: internalDefinition
		}));

		return Object.assign({}, result, {
			[entityId]: JSON.stringify(replacedReferences)
		});
	}, {});
};

const convertReferences = (data) => {
	const containers = data.containers.reduce((containers, container) => {
		const jsonSchema = convertReferencesInEntities({
			entities: container.entities,
			jsonSchemas: container.jsonSchema,
			definitions: {
				internal: container.internalDefinitions,
				model: JSON.parse(data.modelDefinitions),
				external: JSON.parse(data.externalDefinitions)
			}
		});

		return containers.concat(Object.assign({}, container, {
			jsonSchema
		}));
	}, []);

	return Object.assign({}, data, {
		containers
	});
};

module.exports = convertReferences;