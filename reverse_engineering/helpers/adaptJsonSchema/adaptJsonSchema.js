const mapJsonSchema = require('./mapJsonSchema');
const commonHelper = require('../commonHelper');

const convertToString = (jsonSchema) => {
	return Object.assign({}, jsonSchema, {
		type: 'string',
	});
};

const handleNumericType = (jsonSchema) => {
	if (jsonSchema.mode === 'int') {
		return {
			...jsonSchema,
			type: 'integer'
		}
	}
	if (jsonSchema.mode === 'decimal') {
		return {
			...jsonSchema,
			type: 'number',
			mode: 'double'
		}
	}

	return jsonSchema;
};

const adaptSchema = (jsonSchema) => {
	return mapJsonSchema(jsonSchema, (jsonSchemaItem) => {
		if (jsonSchemaItem.type === 'number') {
			return handleNumericType(jsonSchemaItem);
		} else if (jsonSchemaItem.type !== 'null') {
			return jsonSchemaItem;
		}

		return convertToString(jsonSchemaItem);
	});
};

const adaptJsonSchema = (data, logger, callback) => {
	logger.log('info', 'Adaptation of JSON Schema started...', 'Adapt JSON Schema');
	try {
		const jsonSchema = JSON.parse(data.jsonSchema);

		const adaptedJsonSchema = adaptSchema(jsonSchema);

		logger.log('info', 'Adaptation of JSON Schema finished.', 'Adapt JSON Schema');

		callback(null, {
			jsonSchema: JSON.stringify(adaptedJsonSchema)
		});
	} catch(e) {
		callback(commonHelper.handleErrorObject(e, 'Adapt JSON Schema'), data);
	}
};

module.exports = { adaptJsonSchema };
